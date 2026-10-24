import { describe, it, expect } from 'vitest';
import type { HassEntities } from 'home-assistant-js-websocket';
import { isActive, nextMode, nextTarget, toClimate } from './climate';

const ents = {
  'climate.floor': {
    state: 'heat_cool',
    attributes: { friendly_name: 'Termosztát', current_temperature: 23.7, temperature: 23.5, target_temp_step: 0.5, min_temp: 5, max_temp: 30, hvac_modes: ['off', 'heat_cool'] },
  },
  'climate.ac': { state: 'off', attributes: { friendly_name: 'AC', current_temperature: 25, temperature: 16, min_temp: 16, max_temp: 30, hvac_modes: ['off', 'cool'] } },
} as unknown as HassEntities;

describe('toClimate', () => {
  it('maps attributes and skips missing entities', () => {
    const rows = toClimate(ents, ['climate.floor', 'climate.gone']);
    expect(rows).toEqual([
      { id: 'climate.floor', name: 'Termosztát', state: 'heat_cool', current: 23.7, target: 23.5, step: 0.5, min: 5, max: 30, modes: ['off', 'heat_cool'], active: false },
    ]);
  });
  it('defaults the step to 0.5', () => {
    expect(toClimate(ents, ['climate.ac'])[0].step).toBe(0.5);
  });
});

describe('nextTarget', () => {
  const [floor, ac] = toClimate(ents, ['climate.floor', 'climate.ac']);
  it('steps up and down', () => {
    expect(nextTarget(floor, 1)).toBe(24);
    expect(nextTarget(floor, -1)).toBe(23);
  });
  it('clamps to min/max', () => {
    expect(nextTarget(ac, -1)).toBe(16);
    expect(nextTarget({ ...floor, target: 30 }, 1)).toBe(30);
  });
});

describe('nextMode', () => {
  const row = (state: string) => ({ id: 'c', name: '', state, current: null, target: null, step: 1, min: 0, max: 1, modes: ['off', 'cool', 'heat'], active: true });
  it('cycles and wraps', () => {
    expect(nextMode(row('cool'))).toBe('heat');
    expect(nextMode(row('heat'))).toBe('off');
  });
});

describe('isActive', () => {
  it('trusts hvac_action when present', () => {
    expect(isActive('heat', 'idle', 18, 22, [])).toBe(false);
    expect(isActive('heat', 'heating', 25, 22, [])).toBe(true);
  });
  it('guesses from temperatures otherwise', () => {
    expect(isActive('heat_cool', undefined, 24.5, 23.5, ['off', 'heat_cool'])).toBe(false); // floor heating above target: idle
    expect(isActive('heat_cool', undefined, 22, 23.5, ['off', 'heat_cool'])).toBe(true);
    expect(isActive('heat_cool', undefined, 26, 23, ['off', 'cool', 'heat_cool'])).toBe(true); // AC can cool down
    expect(isActive('cool', undefined, 22, 24, [])).toBe(false);
    expect(isActive('off', 'heating', 10, 22, [])).toBe(false);
  });
});
