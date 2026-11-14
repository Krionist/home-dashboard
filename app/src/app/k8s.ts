// Kubernetes API (read-only ServiceAccount behind nginx /k8s/*) → per-node load + pod health
type Node = { metadata: { name: string }; status: { allocatable: Record<string, string>; conditions: { type: string; status: string }[] } };
type Usage = { metadata: { name: string }; usage: Record<string, string> };
type Table = { rows: { cells: string[] }[] }; // pods as=Table: Name, Ready, Status, Restarts, Age, IP, Node, …

export type K8sNode = { name: string; ready: boolean; cpu: number; mem: number; pods: number };
export type K8sView = { nodes: K8sNode[]; running: number; done: number; bad: { name: string; status: string; restarts: string }[] };

// "444m", "1187934880n", "2" (cores) / "7752Mi", "13663580Ki", "8G" (bytes)
const SUFFIX: Record<string, number> = { n: 1e-9, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9, Ki: 2 ** 10, Mi: 2 ** 20, Gi: 2 ** 30, Ti: 2 ** 40 };
export function qty(s = '0'): number {
  const m = /^([\d.]+)([a-zA-Z]*)$/.exec(s);
  return m ? Number(m[1]) * (SUFFIX[m[2]] ?? 1) : 0;
}

export function toView(nodes: { items: Node[] }, usage: { items: Usage[] }, pods: Table): K8sView {
  const use = new Map(usage.items.map(u => [u.metadata.name, u.usage]));
  const perNode = new Map<string, number>();
  let running = 0, done = 0;
  const bad: K8sView['bad'] = [];
  for (const [name, ready, status, restarts, , , node] of pods.rows.map(r => r.cells)) {
    const [r, of] = ready.split('/');
    if (status === 'Completed' || status === 'Succeeded') done++;
    else if (status === 'Running' && r === of) running++;
    else bad.push({ name, status: status === 'Running' ? `${ready} kész` : status, restarts: restarts.split(' ')[0] }); // restarts may read "3 (2d ago)"
    if (status !== 'Completed' && status !== 'Succeeded') perNode.set(node, (perNode.get(node) ?? 0) + 1);
  }
  const pct = (used: number, of: number) => (of > 0 ? Math.min(100, Math.round((used / of) * 100)) : 0);
  return {
    nodes: nodes.items.map(n => {
      const u = use.get(n.metadata.name), a = n.status.allocatable;
      return {
        name: n.metadata.name,
        ready: n.status.conditions.some(c => c.type === 'Ready' && c.status === 'True'),
        cpu: pct(qty(u?.['cpu']), qty(a['cpu'])), mem: pct(qty(u?.['memory']), qty(a['memory'])),
        pods: perNode.get(n.metadata.name) ?? 0,
      };
    }).sort((a, b) => a.name.localeCompare(b.name)),
    running, done, bad,
  };
}

export async function loadK8s(): Promise<K8sView> {
  const [n, u, p] = await Promise.all(['nodes', 'node-metrics', 'pods'].map(async path => {
    const r = await fetch('/k8s/' + path);
    if (!r.ok) throw new Error(`k8s ${path} ${r.status}`);
    return r.json();
  }));
  return toView(n, u, p);
}
