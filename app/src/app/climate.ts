import type { HassEntities } from 'home-assistant-js-websocket';

export interface ClimateRow {
  id: string; name: string; state: string;
  current: number | null; target: number | null;
  step: number; min: number; max: number; modes: string[];
  active: boolean; // actually heating/cooling right now, not just switched on
}

// hvac_action when the integration reports it; otherwise guess from current vs target (floor heating has no hvac_action)
export function isActive(state: string, action: string | undefined, cur: number | null, tgt: number | null, modes: string[]): boolean {
  if (state === 'off') return false;
  if (action) return action !== 'idle' && action !== 'off';
  if (cur === null || tgt === null) return true;
  if (state === 'heat') return cur < tgt;
  if (state === 'cool') return cur > tgt;
  if (state === 'heat_cool' || state === 'auto') return cur < tgt || (modes.includes('cool') && cur > tgt);
  return true; // dry / fan_only run regardless of temperature
}

export function toClimate(entities: HassEntities, ids: string[]): ClimateRow[] {
  return ids.flatMap(id => {
    const e = entities[id];
    if (!e) return [];
    const a = e.attributes;
    return [{
      id, name: a.friendly_name ?? id, state: e.state,
      current: a['current_temperature'] ?? null, target: a['temperature'] ?? null,
      step: a['target_temp_step'] ?? 0.5, min: a['min_temp'] ?? 5, max: a['max_temp'] ?? 35,
      modes: a['hvac_modes'] ?? [],
      active: isActive(e.state, a['hvac_action'], a['current_temperature'] ?? null, a['temperature'] ?? null, a['hvac_modes'] ?? []),
    }];
  });
}

export function nextTarget(r: ClimateRow, dir: 1 | -1): number {
  const next = Math.round(((r.target ?? r.min) + dir * r.step) * 10) / 10;
  return Math.min(r.max, Math.max(r.min, next));
}

export function nextMode(r: ClimateRow): string {
  return r.modes[(r.modes.indexOf(r.state) + 1) % r.modes.length] ?? r.state;
}
