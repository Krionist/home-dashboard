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
  ...Object.fromEntries(['sonarr', 'radarr'].map(a => [`/${a}`, {
    target: `http://${a}.lan`,
    changeOrigin: true,
    pathRewrite: { [`^/${a}`]: '' },
    headers: { 'X-Api-Key': process.env[`${a.toUpperCase()}_API_KEY`] ?? '' },
  }])),
  '/firefly': {
    target: 'http://firefly.lan',
    changeOrigin: true,
    pathRewrite: { '^/firefly': '' },
    headers: { Authorization: `Bearer ${process.env.FIREFLY_TOKEN ?? ''}` },
  },
  '/sparky': {
    target: 'http://192.168.1.230',
    changeOrigin: true,
    pathRewrite: { '^/sparky': '' },
    headers: { 'x-api-key': process.env.SPARKY_API_KEY ?? '' },
  },
  '/lubelogger': { target: 'http://lublogger.lan', changeOrigin: true, pathRewrite: { '^/lubelogger': '' } },
  // k8s: run `kubectl proxy` (port 8001); it adds your kubeconfig credentials
  ...Object.fromEntries(Object.entries({ nodes: '/api/v1/nodes', 'node-metrics': '/apis/metrics.k8s.io/v1beta1/nodes', pods: '/api/v1/pods?includeObject=None' })
    .map(([k, path]) => [`/k8s/${k}`, { target: 'http://127.0.0.1:8001', pathRewrite: () => path, headers: k === 'pods' ? { Accept: 'application/json;as=Table;v=v1;g=meta.k8s.io' } : {} }])),
  '/waqi': {
    target: 'https://api.waqi.info',
    changeOrigin: true,
    rewrite: p => `${p.replace(/^\/waqi/, '')}?token=${process.env.WAQI_TOKEN ?? ''}`,
  },
};
