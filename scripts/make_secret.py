#!/usr/bin/env python3
"""kubectl -n glance get cm glance-config -o json | JELLYFIN_TOKEN=... python3 scripts/make_secret.py | kubectl apply -f -"""
import json, os, re, sys
import yaml

glance = yaml.safe_load(json.load(sys.stdin)['data']['glance.yml'])


def walk(ws):
    for w in ws:
        yield from walk(w['widgets']) if w['type'] == 'group' else [w]


ws = [w for p in glance['pages'] for col in p['columns'] for w in walk(col['widgets'])]
aq = next(w for w in ws if w.get('title') == 'Air Quality')
print(yaml.safe_dump({
    'apiVersion': 'v1', 'kind': 'Secret',
    'metadata': {'name': 'home-dashboard-secrets', 'namespace': 'home-dashboard'},
    'stringData': {'WAQI_TOKEN': re.search(r'token=([^&\s"]+)', aq['url']).group(1),
                   'JELLYFIN_TOKEN': os.environ['JELLYFIN_TOKEN']},  # Jellyfin dashboard → API keys
}))
