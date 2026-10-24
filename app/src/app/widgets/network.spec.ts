import { entityStatus, isK8s, layout } from './network';

describe('network map helpers', () => {
  it('reads HA states as up / down / unknown', () => {
    expect(['online', 'normal', 'OL', 'idle', 'unavailable', 'offline', undefined].map(entityStatus))
      .toEqual(['up', 'up', 'up', 'up', 'down', 'down', 'unknown']);
  });
  it('puts routers on top, core in the middle, cameras at the bottom right', () => {
    const p = layout(['router', 'server', 'nas', 'camera', 'camera']);
    expect(p.map(q => q.y)).toEqual([34, 108, 108, 204, 204]);
    expect(p[0].x).toBe(320); // single router centred
    expect(p[3].x).toBeGreaterThan(320); // cameras under the right half
  });
  it('spots Kubernetes guests by name', () => {
    expect(['talos-kubernetes-1', 'k8s-worker', 'jellyfin', 'ha'].map(isK8s)).toEqual([true, true, false, false]);
  });
});
