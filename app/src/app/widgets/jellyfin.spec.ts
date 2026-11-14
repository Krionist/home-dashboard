import { describe, expect, it } from 'vitest';
import { toPlaying } from './jellyfin';

describe('toPlaying', () => {
  it('keeps playing sessions, labels episodes, computes progress', () => {
    expect(toPlaying([
      { Id: 'idle', UserName: 'a' },
      { Id: 's1', UserName: 'tibi', DeviceName: 'TV', PlayState: { PositionTicks: 25, IsPaused: true },
        NowPlayingItem: { Id: 'e1', Name: 'Pilot', Type: 'Episode', SeriesId: 'ser', SeriesName: 'Show', ParentIndexNumber: 1, IndexNumber: 2, RunTimeTicks: 100 } },
      { Id: 's2', NowPlayingItem: { Id: 'm1', Name: 'Film', Type: 'Movie' } },
    ])).toEqual([
      { id: 's1', title: 'Show', sub: 'S01E02 · Pilot', who: 'tibi · TV', img: '/jellyfin/Items/ser/Images/Primary?maxHeight=120', pct: 25, paused: true },
      { id: 's2', title: 'Film', sub: '', who: '', img: '/jellyfin/Items/m1/Images/Primary?maxHeight=120', pct: 0, paused: false },
    ]);
  });
});
