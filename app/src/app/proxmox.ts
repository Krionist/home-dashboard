import type { HassEntities } from 'home-assistant-js-websocket';

// Proxmox VE integration entities: sensor.node_<node>_*, sensor.(qemu|lxc)_<name>_<vmid>_* with a *_node sensor naming the host
export interface Guest { id: string; vmid: number; name: string; type: 'VM' | 'CT'; running: boolean; cpu: number | null; mem: number | null; memGb: number | null; ip: string | null }
export interface NodeStats {
  cpu: number | null; mem: number | null; memUsed: number | null; memTotal: number | null; disk: number | null;
  load: string | null; io: number | null; boot: string | null; version: string | null; updates: number | null; failed: number | null;
}

const num = (e: HassEntities, id: string) => {
  const v = Number(e[id]?.state);
  return e[id] && Number.isFinite(v) ? v : null;
};
const str = (e: HassEntities, id: string) => {
  const s = e[id]?.state;
  return s && s !== 'unknown' && s !== 'unavailable' ? s : null;
};

export function nodeStats(e: HassEntities, node: string): NodeStats {
  const p = `sensor.node_${node}_`;
  const used = num(e, p + 'memory_used'), free = num(e, p + 'memory_free');
  return {
    cpu: num(e, p + 'cpu_used'), mem: num(e, p + 'memory_used_percentage'), memUsed: used, memTotal: used !== null && free !== null ? used + free : null,
    disk: num(e, p + 'disk_used_percentage'), load: str(e, p + 'load_average_1_min'), io: num(e, p + 'io_delay'), boot: str(e, p + 'last_boot'),
    version: str(e, p + 'version'), updates: num(e, p + 'total_updates'), failed: num(e, p + 'failed_tasks'),
  };
}

// every VM / container whose *_node sensor says it lives on `node`; running first, busiest first
export function guestsOf(e: HassEntities, node: string): Guest[] {
  return Object.keys(e).flatMap(id => {
    const m = id.match(/^sensor\.(qemu|lxc)_(.+)_(\d+)_node$/);
    if (!m || e[id].state !== node) return [];
    const p = id.slice(0, -'node'.length);
    // "LXC jellyfin (107) Status" → "jellyfin"; fall back to the entity slug
    const name = String(e[p + 'status']?.attributes['friendly_name'] ?? '').match(/^\S+\s+(.+?)\s+\(\d+\)/)?.[1] ?? m[2].replace(/_/g, '-');
    return [{
      id: p, vmid: +m[3], name, type: m[1] === 'lxc' ? 'CT' : 'VM', running: e[p + 'status']?.state === 'running',
      cpu: num(e, p + 'cpu_used'), mem: num(e, p + 'memory_used_percentage'), memGb: num(e, p + 'memory_used'), ip: str(e, p + 'ip_address'),
    } satisfies Guest];
  }).sort((a, b) => +b.running - +a.running || (b.cpu ?? 0) - (a.cpu ?? 0));
}

// "2026-08-14T12:21:27+00:00" → "71 napja"
export function uptime(boot: string | null, now = Date.now()): string {
  const t = boot ? Date.parse(boot) : NaN;
  if (!Number.isFinite(t)) return '–';
  const h = Math.floor((now - t) / 3_600_000);
  return h < 48 ? `${h} órája` : `${Math.floor(h / 24)} napja`;
}
