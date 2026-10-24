import { describe, it, expect } from 'vitest';
import { groupByDay, gridRange, monthGrid, todoEvents } from './calendar';

describe('monthGrid', () => {
  it('covers whole Monday-first weeks around the month (Oct 2026 starts on a Thursday)', () => {
    const cells = monthGrid(2026, 9);
    expect(cells).toHaveLength(35);
    expect(cells[0]).toEqual({ key: '2026-09-28', inMonth: false });
    expect(cells[3]).toEqual({ key: '2026-10-01', inMonth: true });
    expect(cells[34]).toEqual({ key: '2026-11-01', inMonth: false });
  });
  it('adds a sixth week when needed (Aug 2026 starts on a Saturday)', () => {
    const cells = monthGrid(2026, 7);
    expect(cells).toHaveLength(42);
    expect(cells[0].key).toBe('2026-07-27');
  });
  it('gridRange runs from the first cell to the end of the last one', () => {
    const [from, to] = gridRange(monthGrid(2026, 9));
    expect(from).toBe(new Date(2026, 8, 28).getTime());
    expect(to).toBe(new Date(2026, 10, 2).getTime());
  });
});

describe('todoEvents', () => {
  const from = Date.parse('2026-10-23T00:00:00+02:00');
  const to = Date.parse('2026-11-06T00:00:00+01:00');

  it('keeps open items with a due date inside the window, date-only or timed', () => {
    const ev = todoEvents([
      { summary: 'date only', due: '2026-10-27', status: 'needs_action' },
      { summary: 'timed', due: '2026-11-04T11:00:00+01:00', status: 'needs_action' },
    ], from, to);
    expect(ev).toEqual([
      { summary: 'date only', start: '2026-10-27' },
      { summary: 'timed', start: '2026-11-04T11:00:00+01:00' },
    ]);
  });
  it('drops items without due date, completed, overdue and beyond the window', () => {
    const ev = todoEvents([
      { summary: 'no due', status: 'needs_action' },
      { summary: 'done', due: '2026-10-27', status: 'completed' },
      { summary: 'overdue', due: '2026-10-20', status: 'needs_action' },
      { summary: 'later', due: '2026-11-30', status: 'needs_action' },
    ], from, to);
    expect(ev).toEqual([]);
  });
});

describe('groupByDay', () => {
  it('merges sources, groups by day and sorts all-day first, then by time', () => {
    const days = groupByDay([
      { label: 'Sonarr', events: [{ summary: 'Show S01E02', start: '2026-10-27' }] },
      { label: 'Radarr', events: [{ summary: 'The Dog Stars', start: '2026-10-26' }] },
      { label: 'Synology', events: [
        { summary: 'Fogorvos', start: '2026-10-27T12:30:00+00:00' },
        { summary: 'Reggeli', start: '2026-10-27T07:00:00+00:00' },
      ] },
    ]);
    expect(days.map(d => d.day)).toEqual(['2026-10-26', '2026-10-27']);
    expect(days[1].items.map(i => i.summary)).toEqual(['Show S01E02', 'Reggeli', 'Fogorvos']);
    expect(days[1].items[0]).toEqual({ summary: 'Show S01E02', label: 'Sonarr', time: '' });
    expect(days[1].items[1].label).toBe('Synology');
    expect(days[1].items[1].time).toMatch(/^\d\d:\d\d$/);
  });
  it('accepts the REST object form too', () => {
    const days = groupByDay([{ label: 'Radarr', events: [{ summary: 'Film', start: { date: '2026-10-26' } }] }]);
    expect(days).toEqual([{ day: '2026-10-26', items: [{ summary: 'Film', label: 'Radarr', time: '' }] }]);
  });
  it('returns nothing for empty sources', () => {
    expect(groupByDay([{ label: 'X', events: [] }])).toEqual([]);
  });
});
