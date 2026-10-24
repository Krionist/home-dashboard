import { describe, it, expect, vi, afterEach } from 'vitest';
import { isUp, toQueue } from './monitor';

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

describe('toQueue', () => {
  it('names episodes and movies, computes progress', () => {
    expect(toQueue([
      { title: 'rel', size: 200, sizeleft: 50, timeleft: '00:10:00', status: 'downloading', series: { title: 'Show' }, episode: { seasonNumber: 1, episodeNumber: 2 } },
      { title: 'rel2', size: 0, sizeleft: 0, status: 'queued', movie: { title: 'Film' } },
    ])).toEqual([
      { name: 'Show S01E02', pct: 75, left: '00:10:00', status: 'downloading' },
      { name: 'Film', pct: 0, left: '', status: 'queued' },
    ]);
  });
});
