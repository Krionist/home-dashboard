// Firefly III /api/v1/budgets (names) + /budgets/limits (amount, spent) → one row per budget that has a limit this month
export type Budget = { name: string; spent: number; limit: number; pct: number };
type Res<T> = { data: { id: string; attributes: T }[] };
type Limit = { budget_id: string; amount: string; spent?: string | { sum: string }[] };

export function toBudgets(budgets: Res<{ name: string }>, limits: Res<Limit>): Budget[] {
  const names = new Map(budgets.data.map(b => [b.id, b.attributes.name]));
  const sum = new Map<string, Budget>();
  for (const { attributes: l } of limits.data) {
    const s = Math.abs(Number(typeof l.spent === 'object' ? l.spent[0]?.sum : l.spent) || 0); // spent is negative; some versions return [{sum}]
    const name = names.get(l.budget_id) ?? l.budget_id;
    const cur = sum.get(name) ?? { name, spent: 0, limit: 0, pct: 0 };
    cur.spent += s; cur.limit += Number(l.amount) || 0; // a budget can have several limits in one month
    sum.set(name, cur);
  }
  return [...sum.values()].filter(b => b.limit > 0).map(b => ({ ...b, pct: Math.round((b.spent / b.limit) * 100) })).sort((a, b) => b.pct - a.pct);
}

export async function loadBudgets(now = new Date()): Promise<Budget[]> {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const q = `start=${iso(new Date(now.getFullYear(), now.getMonth(), 1))}&end=${iso(new Date(now.getFullYear(), now.getMonth() + 1, 0))}&limit=100`;
  const [b, l] = await Promise.all(['budgets', 'budgets/limits'].map(async p => {
    const r = await fetch(`/firefly/api/v1/${p}?${q}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`firefly ${p} ${r.status}`);
    return r.json();
  }));
  return toBudgets(b, l);
}
