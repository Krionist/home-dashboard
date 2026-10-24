import type { HassEntities } from 'home-assistant-js-websocket';

// bar: percentage, spark: numeric with unit (24h sparkline), flag: on/off, text: anything else
export type Kind = 'bar' | 'spark' | 'flag' | 'text';
// icon: which SVG a tile view draws for this entity
export type Icon = 'thermo' | 'drop' | 'battery' | 'down' | 'up' | 'ring' | 'wallet' | 'receipt' | 'coins' | 'count' | 'flag' | 'text';
export interface Row { id: string; name: string; state: string; unit: string; toggle: boolean; kind: Kind; num: number | null; lowBad: boolean; icon: Icon }
const TOGGLE = ['switch', 'light', 'input_boolean', 'fan'];

export function toRows(entities: HassEntities, ids: string[]): Row[] {
  return ids.map(id => {
    const e = entities[id];
    const state = e?.state ?? 'unavailable';
    const unit = e?.attributes.unit_of_measurement ?? '';
    const n = parseFloat(state);
    const num = state.trim() !== '' && Number.isFinite(Number(state)) ? n : null;
    const kind: Kind = num !== null && unit === '%' ? 'bar' : num !== null && unit ? 'spark' : state === 'on' || state === 'off' ? 'flag' : 'text';
    return {
      id,
      name: e?.attributes.friendly_name ?? id,
      state,
      unit,
      toggle: TOGGLE.includes(id.split('.')[0]) && state !== 'unavailable',
      kind,
      num,
      lowBad: e?.attributes.device_class === 'battery',
      icon: iconOf(id, unit, e?.attributes.device_class ?? '', kind),
    };
  });
}

function iconOf(id: string, unit: string, dc: string, kind: Kind): Icon {
  if (kind === 'flag') return 'flag';
  if (kind === 'text') return 'text';
  if (unit.startsWith('°')) return 'thermo';
  if (/^(HUF|Ft|EUR|USD|€|\$)$/.test(unit)) return /keret|budget/.test(id) ? 'wallet' : /kolt|spent/.test(id) ? 'receipt' : 'coins';
  if (dc === 'battery' || /batt|elem/.test(id)) return 'battery';
  if (dc === 'humidity' || /humid|parat/.test(id)) return 'drop';
  if (unit.endsWith('/s')) return /upload|feltolt/.test(id) ? 'up' : 'down';
  return unit === '%' ? 'ring' : 'count';
}

/** SVG path for a sparkline in a w×h box; returns [line, closed area]. */
export function sparkPath(ys: number[], w: number, h: number): [string, string] {
  if (ys.length < 2) return ['', ''];
  const min = Math.min(...ys), span = Math.max(...ys) - min || 1;
  const pts = ys.map((y, i) => `${((i / (ys.length - 1)) * w).toFixed(1)},${(h - 1 - ((y - min) / span) * (h - 2)).toFixed(1)}`);
  const line = 'M' + pts.join('L');
  return [line, `${line}L${w},${h}L0,${h}Z`];
}
