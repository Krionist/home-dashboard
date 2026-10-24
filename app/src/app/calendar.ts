// the get_events service returns a string, the REST calendar API an object; accept both
export type Start = string | { date?: string; dateTime?: string };
export interface CalEvent { summary: string; start: Start }
export interface Item { summary: string; label: string; time: string } // time '' = all-day
export interface Day { day: string; items: Item[] }

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface Cell { key: string; inMonth: boolean }

// whole Monday-first weeks covering the month (5 or 6 rows); month is 0-based
export function monthGrid(year: number, month: number): Cell[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const weeks = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(year, month, 1 - offset + i);
    return { key: dayKey(d), inMonth: d.getMonth() === month };
  });
}

// [start of first cell, start of the day after the last cell) in ms
export function gridRange(cells: Cell[]): [number, number] {
  const day = (key: string) => new Date(`${key}T00:00`);
  const last = day(cells[cells.length - 1].key);
  return [day(cells[0].key).getTime(), new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).getTime()];
}

export interface TodoItem { summary: string; due?: string; status?: string }

// open todo items (e.g. Vikunja via CalDAV) with a due date, as calendar events; `due` is 'YYYY-MM-DD' or a datetime
export function todoEvents(items: TodoItem[], from: number, to: number): CalEvent[] {
  return items.flatMap(t => {
    if (!t.due || t.status === 'completed') return [];
    const ms = t.due.length === 10 ? new Date(`${t.due}T00:00`).getTime() : Date.parse(t.due);
    return ms >= from && ms < to ? [{ summary: t.summary, start: t.due }] : [];
  });
}

// HA gives all-day events as 'YYYY-MM-DD' and timed ones as ISO datetimes with an offset
function split(raw: Start): { day: string; time: string } {
  const start = typeof raw === 'string' ? raw : (raw.dateTime ?? raw.date ?? '');
  if (start.length === 10) return { day: start, time: '' };
  const d = new Date(start);
  return { day: dayKey(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

export function groupByDay(sources: { label: string; events: CalEvent[] }[]): Day[] {
  const days = new Map<string, Item[]>();
  for (const s of sources)
    for (const e of s.events) {
      const { day, time } = split(e.start);
      days.set(day, [...(days.get(day) ?? []), { summary: e.summary, label: s.label, time }]);
    }
  return [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, items]) => ({ day, items: items.sort((a, b) => a.time.localeCompare(b.time) || a.label.localeCompare(b.label)) }));
}
