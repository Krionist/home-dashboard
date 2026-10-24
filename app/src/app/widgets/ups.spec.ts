import { pmClass } from './purifier';
import { upsMode } from './ups';

describe('ups / purifier helpers', () => {
  it('maps NUT status flags', () => {
    expect(upsMode('OL')).toBe('line');
    expect(upsMode('OL CHRG')).toBe('line');
    expect(upsMode('OB DISCHRG')).toBe('battery');
    expect(upsMode('OB LB')).toBe('low');
    expect(upsMode('')).toBe('unknown');
  });
  it('bands PM2.5', () => {
    expect([pmClass(5), pmClass(20), pmClass(80)]).toEqual(['ok', 'warn', 'bad']);
  });
});

import { pulse } from './power';
describe('power pulse', () => {
  it('speeds up with load, clamped', () => {
    expect(pulse(0)).toBe(3);
    expect(pulse(60)).toBe(2);
    expect(pulse(10000)).toBe(.4);
  });
});
