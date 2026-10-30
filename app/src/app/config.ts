export interface Bang { shortcut: string; url: string }
export interface Link { title: string; url: string; icon?: string } // icon: dashboard-icons slug override
export interface Feed { name: string; url: string; kind?: 'json' | 'jellyfin'; tab?: string; icon?: string; web?: string } // tab: feeds with the same tab share one tab (mode: tabs) // json = [{title, link, date}] from the sidecar // jellyfin = /Items response, web = Jellyfin base for item links
// a calendar entity, or a set of todo lists (items with a due date show up as events)
export type CalSource = { id: string; label: string; color?: string } | { kind: 'todo'; ids: string[]; label: string; color?: string; url?: string } // url: where the overdue banner links to;

export type Widget =
  | { type: 'clock-weather'; entity: string }
  | { type: 'search'; bangs: Bang[] }
  | { type: 'bookmarks'; title?: string; groups: { title: string; links: Link[] }[] }
  | { type: 'monitor'; title: string; sites: { title: string; url: string; checkUrl?: string; icon?: string; queue?: 'sonarr' | 'radarr' }[] }
  | { type: 'iframe'; title: string; url: string; height?: number }
  | { type: 'rss'; title: string; mode: 'merged' | 'tabs'; limit?: number; feeds: Feed[] }
  | { type: 'ha-entities'; title: string; entities: string[]; gauge?: { value: string; max: string; label?: string }; view?: 'tiles' }
  | { type: 'calendar'; title: string; entities: CalSource[] }
  | { type: 'longhorn'; title: string }
  | { type: 'linkwarden'; title: string; entity: string; recent?: number } // HA sensor with links/collections attributes
  | { type: 'waqi'; title: string; lat: number; lon: number }
  | { type: 'camera'; title: string; entities: string[]; refreshSec?: number }
  | { type: 'climate'; title: string; entities: string[] }
  | { type: 'pihole'; title: string; switch: string; status: string; domains: string; ads: string; percent: string }
  | { type: 'torrent'; title: string; status: string; active: string; down: string; up: string; alt?: string }
  | { type: 'purifier'; title: string; fan: string; pm25: string; filter: string }
  | { type: 'ups'; title: string; status: string; charge: string; load: string; input: string; output: string }
  | { type: 'power'; title: string; switch: string; power: string; current: string; voltage: string; energy: string }
  | { type: 'ha-button'; title?: string; url?: string } // url defaults to haUrl
  | { type: 'devices'; title: string; devices: { name: string; level: string; state: string; charger?: string; kind?: 'phone' | 'tablet' | 'watch' }[] }
  | { type: 'network'; title: string; nodes: { name: string; kind: 'router' | 'server' | 'nas' | 'ups' | 'nvr' | 'camera' | 'ha'; entity?: string; url?: string; proxmox?: string; parent?: string; powers?: string[] }[] }
  // status from entity, else HTTP check of url; proxmox = PVE node name (load bars + click for guests); parent = data link target (by name); powers = nodes it feeds
  | { type: 'servers'; title: string; servers: { name: string; status: string; cpu: string; mem: string; drives?: string[]; extra?: string[] }[] };

export type W<T extends Widget['type']> = Extract<Widget, { type: T }>;
export interface Column { size: 'small' | 'full'; widgets: Widget[] }
export interface Page { name: string; columns: Column[] }
export interface Config { haUrl: string; pages: Page[] }

const TYPES = ['clock-weather', 'search', 'bookmarks', 'monitor', 'iframe', 'rss', 'ha-entities', 'calendar', 'longhorn', 'linkwarden', 'waqi', 'camera', 'climate', 'servers', 'pihole', 'torrent', 'purifier', 'ups', 'power', 'ha-button', 'devices', 'network'];

// ponytail: shallow validation (type names only); add per-widget checks if config typos keep biting
export function parseConfig(raw: unknown): Config {
  const c = raw as Config;
  if (typeof c?.haUrl !== 'string' || !Array.isArray(c.pages)) throw new Error('config: haUrl and pages required');
  for (const p of c.pages)
    for (const col of p.columns)
      for (const w of col.widgets)
        if (!TYPES.includes(w.type)) throw new Error(`config: unknown widget type "${w.type}" on page "${p.name}"`);
  return c;
}
