# Home Dashboard

A self-hosted start page for a home lab, driven by Home Assistant. It is an Angular single-page app served by nginx. nginx also proxies the third-party APIs and keeps their tokens on the server, and a small Python sidecar fetches the Reddit feeds.

Everything on the page comes from one `config.json`: tabs, columns and widgets. Most widgets read live state from Home Assistant over its websocket API. They are animated SVGs rather than plain lists.

## Widgets

| Type | What it shows |
|---|---|
| `clock-weather` | Clock, weather, and the sun's position across the day |
| `search` | Search box with `!bang` shortcuts |
| `bookmarks` | Grouped links with brand icons |
| `rss` | RSS/Atom, Reddit (via the sidecar) and Jellyfin feeds, merged or in tabs. CVE feeds get severity and affected-tech badges |
| `calendar` | Month grid built from HA calendars and to-do lists |
| `linkwarden` | Latest links plus one tab per collection, from a HA sensor |
| `waqi` | Air quality index |
| `ha-entities` | Any HA entities as rows (bars, sparklines, flags) or tiles |
| `camera` | HA camera snapshots, cached by nginx |
| `climate` | ACs and thermostats with +/− and mode buttons. Animates only while actually heating or cooling |
| `purifier` | Air purifier with PM2.5, filter life and preset modes |
| `ups` | NUT UPS: power flow, battery, load, voltages |
| `power` | Smart-plug power draw with a 24 h chart |
| `devices` | Phone and tablet batteries |
| `ha-button` | Large link to Home Assistant with connection status |
| `network` | Home-lab map: routers, servers, NAS, UPS power lines, NVR and cameras. Click a Proxmox node to see its VMs and containers |
| `servers` | Proxmox / Synology CPU, RAM, disks |
| `monitor` | Up/down checks for web services |
| `pihole`, `torrent`, `longhorn` | Pi-hole, qBittorrent and Longhorn status |
| `iframe` | Embed any page |

The background is an animated SVG scene that follows the real weather from HA: season, day/dusk/night, clouds, rain, snow, fog, lightning and wind. To preview a combination, add `?scene=winter,night,snowy` to the URL.

## Layout

```
app/        Angular app (widgets in src/app/widgets, config schema in src/app/config.ts)
nginx/      nginx config template: SPA, API proxies, camera cache, RSS feed routes
sidecar/    Python helper: Reddit JSON and /up checks, on 127.0.0.1:8082 inside the pod
deploy/     Kubernetes Namespace, Deployment and Service
.github/    CI: builds both images to ghcr.io when a v* tag is pushed
```

## Configuration

Copy `app/public/config.example.json` to `app/public/config.json` and edit it. The real `config.json` is git-ignored and never baked into the image; in Kubernetes it is mounted from a ConfigMap.

- `haUrl`: your Home Assistant URL. The browser logs in with HA's normal OAuth flow, so no token is needed in the config.
- `pages[].columns[]`: `size: "small"` (300 px) or `"full"`, each with a list of `widgets`. The per-widget fields are typed in `app/src/app/config.ts`.

Secrets are environment variables, never part of the config:

| Variable | Used for |
|---|---|
| `WAQI_TOKEN` | Air-quality API ([aqicn.org/data-platform/token](https://aqicn.org/data-platform/token/)) |
| `JELLYFIN_TOKEN` | Jellyfin API key (Dashboard → API Keys) |
| `HA_UPSTREAM` | HA base URL that nginx proxies camera snapshots to |

## Development

Requires Node 20.19+ or 22.12+.

```sh
cd app
npm ci
printf 'WAQI_TOKEN=...\nJELLYFIN_TOKEN=...\n' > .env   # git-ignored; the dev proxy reads it
npx ng serve                                           # http://localhost:4200
npx ng test --watch=false
```

For the Reddit feeds, also run the sidecar: `pip install -r sidecar/requirements.txt && python sidecar/app.py`. The dev proxy in `app/proxy.conf.mjs` mirrors the nginx routes.

## Deployment (Kubernetes)

Pushing a version tag builds and pushes both images through `.github/workflows/images.yml`, tagged with the version and `latest`:

- `ghcr.io/krionist/home-dashboard`: nginx and the app
- `ghcr.io/krionist/home-dashboard-sidecar`

```sh
git tag v1.0.0 && git push origin v1.0.0
```

First install:

```sh
kubectl create namespace home-dashboard
kubectl -n home-dashboard create secret generic home-dashboard-secrets --from-env-file=app/.env
kubectl -n home-dashboard create configmap home-dashboard-config --from-file=config.json=app/public/config.json
kubectl apply -f deploy/home-dashboard.yaml
```

The Service is a MetalLB `LoadBalancer` with a fixed IP. Change the `metallb.io/loadBalancerIPs` annotation to match your network.

After a config change, or to pull a new image:

```sh
kubectl -n home-dashboard create configmap home-dashboard-config --from-file=config.json=app/public/config.json \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n home-dashboard rollout restart deploy/home-dashboard
```
