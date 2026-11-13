import { describe, it, expect } from 'vitest';
import { dueSoon } from './todo-due';

const now = new Date('2026-11-13T19:00:00');
const it_ = (uid: string, due?: string, status = 'needs_action') => ({ uid, summary: uid, due, status });

describe('dueSoon', () => {
  it('keeps late and upcoming items within the window, soonest first', () => {
    const r = dueSoon({
      'todo.a': [it_('far', '2026-11-30'), it_('soon', '2026-11-15'), it_('late', '2026-11-10'), it_('nodue')],
      'todo.b': [it_('today', '2026-11-13T08:00:00+01:00'), it_('done', '2026-11-12', 'completed')],
    }, 7, now);
    expect(r.map(d => [d.uid, d.days, d.list])).toEqual([['late', -3, 'todo.a'], ['today', 0, 'todo.b'], ['soon', 2, 'todo.a']]);
  });
});
