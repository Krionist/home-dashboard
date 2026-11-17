import { describe, expect, it } from 'vitest';
import { tileOf } from './radar';

describe('tileOf', () => {
  it('matches the slippy-map tile of a known point', () => {
    const t = tileOf(47.347, 21.567, 7);
    expect(Math.floor(t.x)).toBe(71);
    expect(Math.floor(t.y)).toBe(44);
    expect(tileOf(0, 0, 1)).toEqual({ x: 1, y: 1 });
  });
});
