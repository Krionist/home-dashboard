import { describe, it, expect } from 'vitest';
import type { HassEntities } from 'home-assistant-js-websocket';
import { sparkPath, toRows } from './ha-rows';

const ents = {
  'switch.pi_hole': { state: 'on', attributes: { friendly_name: 'Pi-hole' } },
  'sensor.t': { state: '21.5', attributes: { friendly_name: 'Temp', unit_of_measurement: '°C' } },
  'sensor.b': { state: '80', attributes: { friendly_name: 'Bat', unit_of_measurement: '%', device_class: 'battery' } },
  'sensor.s': { state: 'ok', attributes: { friendly_name: 'S' } },
  'sensor.firefly_havi_koltes': { state: '1000', attributes: { unit_of_measurement: 'HUF' } },
  'light.gone': { state: 'unavailable', attributes: {} },
} as unknown as HassEntities;

describe('toRows', () => {
  it('maps names, units, toggle flags and display kind', () => {
    const rows = toRows(ents, ['switch.pi_hole', 'sensor.t', 'sensor.b', 'sensor.s', 'light.gone', 'sensor.missing']);
    expect(rows).toEqual([
      { id: 'switch.pi_hole', name: 'Pi-hole', state: 'on', unit: '', toggle: true, kind: 'flag', num: null, lowBad: false, icon: 'flag' },
      { id: 'sensor.t', name: 'Temp', state: '21.5', unit: '°C', toggle: false, kind: 'spark', num: 21.5, lowBad: false, icon: 'thermo' },
      { id: 'sensor.b', name: 'Bat', state: '80', unit: '%', toggle: false, kind: 'bar', num: 80, lowBad: true, icon: 'battery' },
      { id: 'sensor.s', name: 'S', state: 'ok', unit: '', toggle: false, kind: 'text', num: null, lowBad: false, icon: 'text' },
      { id: 'light.gone', name: 'light.gone', state: 'unavailable', unit: '', toggle: false, kind: 'text', num: null, lowBad: false, icon: 'text' },
      { id: 'sensor.missing', name: 'sensor.missing', state: 'unavailable', unit: '', toggle: false, kind: 'text', num: null, lowBad: false, icon: 'text' },
    ]);
  });
});

describe('toRows icons', () => {
  it('picks money icons by entity name', () => {
    expect(toRows(ents, ['sensor.firefly_havi_koltes'])[0].icon).toBe('receipt');
  });
});

describe('sparkPath', () => {
  it('scales points into the box (y flipped)', () => {
    expect(sparkPath([0, 10], 100, 20)).toEqual(['M0.0,19.0L100.0,1.0', 'M0.0,19.0L100.0,1.0L100,20L0,20Z']);
  });
  it('needs two points', () => {
    expect(sparkPath([5], 100, 20)).toEqual(['', '']);
  });
});
