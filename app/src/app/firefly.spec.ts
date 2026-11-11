import { describe, expect, it } from 'vitest';
import { toBudgets } from './firefly';

describe('toBudgets', () => {
  it('joins names, sums limits, abs spent, sorts by pct', () => {
    const b = { data: [{ id: '1', attributes: { name: 'Food' } }, { id: '2', attributes: { name: 'Fun' } }, { id: '3', attributes: { name: 'None' } }] };
    const l = { data: [
      { id: 'a', attributes: { budget_id: '1', amount: '100000', spent: '-25000' } },
      { id: 'b', attributes: { budget_id: '2', amount: '10000', spent: [{ sum: '-9000' }] } },
      { id: 'c', attributes: { budget_id: '3', amount: '0', spent: '0' } },
    ] };
    expect(toBudgets(b, l)).toEqual([{ name: 'Fun', spent: 9000, limit: 10000, pct: 90 }, { name: 'Food', spent: 25000, limit: 100000, pct: 25 }]);
  });
});
