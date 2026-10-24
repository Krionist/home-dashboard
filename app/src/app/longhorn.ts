export interface Volume { robustness: string; size: string }

export function summarizeVolumes(v: Volume[]) {
  const by: Record<string, number> = {};
  let bytes = 0;
  for (const x of v) {
    by[x.robustness] = (by[x.robustness] ?? 0) + 1;
    bytes += Number(x.size);
  }
  return { count: v.length, by, gib: Math.round(bytes / 2 ** 30) };
}

export interface LhNode {
  name: string;
  conditions: Record<string, { status: string }>;
  disks: Record<string, { storageMaximum: number; storageAvailable: number }>;
}

/** per node: Ready flag and disk usage summed over its disks */
export function summarizeNodes(nodes: LhNode[]) {
  return nodes.map(n => {
    const disks = Object.values(n.disks);
    const max = disks.reduce((a, d) => a + d.storageMaximum, 0);
    const used = max - disks.reduce((a, d) => a + d.storageAvailable, 0);
    return { name: n.name, ready: n.conditions['Ready']?.status === 'True', usedGib: Math.round(used / 2 ** 30), maxGib: Math.round(max / 2 ** 30), pct: max ? Math.round((used / max) * 100) : 0 };
  });
}
