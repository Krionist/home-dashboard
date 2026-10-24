import { describe, it, expect, vi, afterEach } from 'vitest';
import { isUp } from './monitor';

afterEach(() => vi.unstubAllGlobals());

describe('isUp', () => {
  it('is true when fetch resolves', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({}));
    expect(await isUp('http://x')).toBe(true);
  });
  it('is false when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('net')));
    expect(await isUp('http://x')).toBe(false);
  });
  it('is false after timeout', async () => {
    vi.stubGlobal('fetch', vi.fn((_u: string, o: { signal: AbortSignal }) =>
      new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new Error('abort'))))));
    expect(await isUp('http://x', 10)).toBe(false);
  });
});
