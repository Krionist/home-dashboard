import { describe, it, expect, beforeEach } from 'vitest';
import { cached } from './cache';

describe('cached', () => {
  beforeEach(() => localStorage.clear());
  it('reuses a fresh value and refetches a stale one', async () => {
    let n = 0;
    const fn = async () => ++n;
    expect(await cached('k', 1000, fn)).toBe(1);
    expect(await cached('k', 1000, fn)).toBe(1);
    localStorage.setItem('k', JSON.stringify({ at: Date.now() - 2000, v: 1 }));
    expect(await cached('k', 1000, fn)).toBe(2);
  });
  it('does not cache failures', async () => {
    await expect(cached('e', 1000, async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(await cached('e', 1000, async () => 5)).toBe(5);
  });
});
