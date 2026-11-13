"""Reddit listing proxy. Reddit blocks plain clients by TLS fingerprint, so this impersonates Firefox
and uses the guest-token flow (same trick as Glance's reddit widget). GET /r/<sub> -> [{title, link, date}]
GET /up?url=http://x.lan/ -> 200/503: server-side status check for sites the browser can't probe (CORP same-origin)
GET/PUT /config.json: the dashboard config on the PVC (seeded from the ConfigMap once); PUT needs a valid HA bearer token"""
import html
import json
import os
import shutil
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from curl_cffi import requests

CHALLENGE = re.compile(r'await\(async \w+\s*=>\s*\w+\s*\+\s*\w+\)\("([^"]+)"\)')
JSC_TOKEN = re.compile(r'name="jsc_token"\s+value="([^"]+)"')
SUB = re.compile(r'^[A-Za-z0-9_]{2,21}$')
TOKEN_TTL, LIST_TTL = 6 * 3600, 600

session = requests.Session(impersonate='firefox')
lock = threading.RLock()  # ponytail: one request at a time, fine for ~10 subs every 15 min
token = {'value': '', 'at': 0.0}
cache: dict[str, tuple[float, list]] = {}


def fetch_token() -> str:
    session.cookies.clear()  # with old reddit cookies the homepage is served without the challenge
    home = session.get('https://www.reddit.com/')
    c, t = CHALLENGE.search(home.text), JSC_TOKEN.search(home.text)
    if not (c and t):
        raise RuntimeError('reddit challenge not found (page format changed?)')
    session.get('https://www.reddit.com/', params={'solution': c.group(1) * 2, 'js_challenge': '1', 'jsc_token': t.group(1)})
    value = session.cookies.get('token_v2')
    if not value:
        raise RuntimeError('no token_v2 cookie')
    return value


def guest_token(force: bool = False) -> str:
    with lock:
        if force or not token['value'] or time.time() - token['at'] > TOKEN_TTL:
            token.update(value=fetch_token(), at=time.time())
        return token['value']


def to_items(listing: dict) -> list[dict]:
    posts = (c['data'] for c in listing['data']['children'])
    return [{'title': html.unescape(p['title']), 'link': 'https://www.reddit.com' + p['permalink'], 'date': int(p['created'] * 1000),
             **({'image': html.unescape(p['thumbnail'])} if p.get('thumbnail', '').startswith('http') else {})}
            for p in posts if not (p.get('stickied') or p.get('pinned'))]  # thumbnail is 'self'/'default'/'nsfw' when there is none


def hot(sub: str) -> list[dict]:
    with lock:
        hit = cache.get(sub)
        if hit and time.time() - hit[0] < LIST_TTL:
            return hit[1]
        for force in (False, True):  # retry once with a fresh token
            r = session.get(f'https://oauth.reddit.com/r/{sub}/hot.json', headers={'Authorization': 'Bearer ' + guest_token(force)})
            if r.status_code == 200:
                break
        else:
            raise RuntimeError(f'reddit answered {r.status_code}')
        items = to_items(r.json())
        cache[sub] = (time.time(), items)
        return items


def allowed(url: str) -> bool:
    u = urllib.parse.urlsplit(url)
    return u.scheme in ('http', 'https') and (u.hostname or '').endswith('.lan')  # ponytail: LAN-only, no open proxy


def is_up(url: str) -> bool:
    try:
        urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=5)
    except urllib.error.HTTPError as e:
        return e.code < 500  # 4xx: the app answered; 5xx: *.lan resolves to the ingress, which says 502/503 when the app is down
    except OSError:
        return False
    return True


CONFIG = os.environ.get('CONFIG_PATH', '/data/config.json')
SEED = os.environ.get('SEED_PATH', '/seed/config.json')
HA_URL = os.environ.get('HA_URL', '')
MAX_CONFIG = 1 << 20


def check_config(new, old: dict) -> str:
    """'' if `new` may replace `old`, else why not. haUrl is fixed: changing it would send logins elsewhere."""
    if not isinstance(new, dict) or not isinstance(new.get('pages'), list):
        return 'config must be an object with pages'
    if new.get('haUrl') != old.get('haUrl'):
        return 'haUrl cannot be changed from the UI'
    return ''


def ha_ok(auth: str) -> bool:
    if not (HA_URL and auth.startswith('Bearer ')):
        return False
    try:
        urllib.request.urlopen(urllib.request.Request(HA_URL + '/api/', headers={'Authorization': auth}), timeout=5)
        return True
    except (urllib.error.HTTPError, OSError):
        return False


def save_config(cfg: dict):
    tmp = CONFIG + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    if os.path.exists(CONFIG):
        shutil.copyfile(CONFIG, CONFIG + '.bak')  # one step of undo, by hand: kubectl exec ... cp config.json.bak config.json
    os.replace(tmp, CONFIG)


class Handler(BaseHTTPRequestHandler):
    def do_PUT(self):
        if self.path != '/config.json':
            return self.reply(404, {'error': 'not found'})
        if not ha_ok(self.headers.get('Authorization', '')):
            return self.reply(401, {'error': 'HA login required'})
        n = int(self.headers.get('Content-Length') or 0)
        if not 0 < n <= MAX_CONFIG:
            return self.reply(413, {'error': 'bad size'})
        try:
            new = json.loads(self.rfile.read(n))
            with open(CONFIG, encoding='utf-8') as f:
                why = check_config(new, json.load(f))
        except (ValueError, OSError) as e:
            return self.reply(400, {'error': str(e)})
        if why:
            return self.reply(400, {'error': why})
        with lock:
            save_config(new)
        self.reply(200, {'ok': True})

    def do_GET(self):
        if self.path.split('?')[0] == '/config.json':
            try:
                with open(CONFIG, 'rb') as f:
                    return self.reply(200, json.load(f))
            except (ValueError, OSError) as e:
                return self.reply(500, {'error': str(e)})
        if self.path.startswith('/up?'):
            url = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get('url', [''])[0]
            if not allowed(url):
                return self.reply(400, {'error': 'only http(s)://*.lan allowed'})
            up = is_up(url)
            return self.reply(200 if up else 503, {'up': up})
        m = re.fullmatch(r'/r/([^/?]+)', self.path.split('?')[0])
        if not (m and SUB.match(m[1])):
            return self.reply(404, {'error': 'not found'})
        try:
            self.reply(200, hot(m[1]))
        except Exception as e:
            self.reply(502, {'error': str(e)})

    def reply(self, code: int, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == '__main__':
    if os.path.exists(SEED) and not os.path.exists(CONFIG):
        os.makedirs(os.path.dirname(CONFIG), exist_ok=True)
        shutil.copyfile(SEED, CONFIG)  # first start: the ConfigMap becomes the editable copy
    ThreadingHTTPServer(('127.0.0.1', 8082), Handler).serve_forever()
