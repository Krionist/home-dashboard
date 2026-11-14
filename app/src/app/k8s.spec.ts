import { describe, expect, it } from 'vitest';
import { qty, toView } from './k8s';

describe('qty', () => {
  it('parses cpu and memory quantities', () => {
    expect(qty('444m')).toBeCloseTo(0.444);
    expect(qty('1187934880n')).toBeCloseTo(1.188, 3);
    expect(qty('4')).toBe(4);
    expect(qty('2Ki')).toBe(2048);
    expect(qty('7752Mi')).toBe(7752 * 2 ** 20);
    expect(qty('junk')).toBe(0);
  });
});

describe('toView', () => {
  it('sums pods per node and lists unhealthy ones', () => {
    const node = (name: string, ready: string) => ({ metadata: { name }, status: { allocatable: { cpu: '4', memory: '8Gi' }, conditions: [{ type: 'Ready', status: ready }] } });
    const row = (...cells: string[]) => ({ cells });
    const v = toView(
      { items: [node('kub2', 'True'), node('kub1', 'False')] },
      { items: [{ metadata: { name: 'kub2' }, usage: { cpu: '1000m', memory: '2Gi' } }] },
      { rows: [
        row('a', '1/1', 'Running', '0', '1d', '', 'kub2'),
        row('b', '0/1', 'Running', '5 (2m ago)', '1d', '', 'kub2'),
        row('c', '0/1', 'CrashLoopBackOff', '12', '1d', '', 'kub1'),
        row('d', '0/1', 'Completed', '0', '1d', '', 'kub1'),
      ] },
    );
    expect(v.nodes).toEqual([
      { name: 'kub1', ready: false, cpu: 0, mem: 0, pods: 1 },
      { name: 'kub2', ready: true, cpu: 25, mem: 25, pods: 2 },
    ]);
    expect([v.running, v.done]).toEqual([1, 1]);
    expect(v.bad).toEqual([{ name: 'b', status: '0/1 kész', restarts: '5' }, { name: 'c', status: 'CrashLoopBackOff', restarts: '12' }]);
  });
});
