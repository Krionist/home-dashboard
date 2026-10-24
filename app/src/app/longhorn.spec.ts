import { describe, it, expect } from 'vitest';
import { summarizeNodes, summarizeVolumes } from './longhorn';

describe('summarizeVolumes', () => {
  it('counts robustness and sums size in GiB', () => {
    const s = summarizeVolumes([
      { robustness: 'healthy', size: String(2 * 2 ** 30) },
      { robustness: 'healthy', size: String(3 * 2 ** 30) },
      { robustness: 'degraded', size: String(2 ** 30) },
    ]);
    expect(s).toEqual({ count: 3, by: { healthy: 2, degraded: 1 }, gib: 6 });
  });
});

describe('summarizeNodes', () => {
  it('sums disks and reads the Ready condition', () => {
    const G = 2 ** 30;
    expect(summarizeNodes([
      { name: 'kub1', conditions: { Ready: { status: 'True' } }, disks: { a: { storageMaximum: 100 * G, storageAvailable: 75 * G } } },
      { name: 'kub2', conditions: { Ready: { status: 'False' } }, disks: {} },
    ])).toEqual([
      { name: 'kub1', ready: true, usedGib: 25, maxGib: 100, pct: 25 },
      { name: 'kub2', ready: false, usedGib: 0, maxGib: 0, pct: 0 },
    ]);
  });
});
