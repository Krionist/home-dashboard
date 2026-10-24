// dev only: mirrors the nginx /feed/<host>/ routes from ../nginx/feeds.conf
import { readFileSync } from 'node:fs';
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';

// Node's 250ms happy-eyeballs attempt is too short for far hosts (api.waqi.info, Japan) → ETIMEDOUT
setDefaultAutoSelectFamilyAttemptTimeout(2000);
// tokens (WAQI_TOKEN, JELLYFIN_TOKEN) from app/.env, gitignored; real env vars win
try { process.loadEnvFile('.env'); } catch { /* no .env: rely on the environment */ }

const haUrl = JSON.parse(readFileSync('public/config.json', 'utf8')).haUrl;
const hosts = [...readFileSync('../nginx/feeds.conf', 'utf8').matchAll(/location \/feed\/([^/]+)\//g)].map(m => m[1]);

const feeds = Object.fromEntries(hosts.map(h => [`/feed/${h}`, {
  target: `https://${h}`,
  changeOrigin: true,
  pathRewrite: { [`^/feed/${h}`]: '' },
  headers: { 'User-Agent': 'home-dashboard/1.0' },
  // don't leak browser identity upstream (lobste.rs 403s anything that says "Brave" in sec-ch-ua)
  configure: proxy => proxy.on('proxyReq', req => {
    for (const h of req.getHeaderNames()) if (/^(sec-|cookie$|referer$)/.test(h)) req.removeHeader(h);
  }),
}]));

// reddit sidecar: run `python sidecar/app.py` locally
// cluster services via their .lan names; tokens come from app/.env (the container gets them from a k8s Secret)
export default {
  ...feeds,
  '/reddit': { target: 'http://127.0.0.1:8082', pathRewrite: { '^/reddit': '' } },
  '/longhorn': { target: 'http://longhorn.lan', changeOrigin: true, pathRewrite: { '^/longhorn': '' } },
  '/camera': { target: haUrl, changeOrigin: true, pathRewrite: { '^/camera': '' } }, // no cache in dev
  '/jellyfin': {
    target: 'http://jellyfin.lan',
    changeOrigin: true,
    pathRewrite: { '^/jellyfin': '' },
    headers: { Authorization: `MediaBrowser Token="${process.env.JELLYFIN_TOKEN ?? ''}"` },
  },
  '/waqi': {
    target: 'https://api.waqi.info',
    changeOrigin: true,
    rewrite: p => `${p.replace(/^\/waqi/, '')}?token=${process.env.WAQI_TOKEN ?? ''}`,
  },
};
