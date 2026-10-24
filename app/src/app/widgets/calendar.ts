import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { CalEvent, TodoItem, dayKey, gridRange, groupByDay, monthGrid, todoEvents } from '../calendar';
import { W } from '../config';
import { HaService } from '../ha.service';

interface Resp { response: Record<string, { events: CalEvent[] }> }
interface TodoResp { response: Record<string, { items: TodoItem[] }> }

const WEEKDAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];

@Component({
  selector: 'app-calendar',
  template: `
    <section class="card">
      <div class="cam-head">
        <h2>{{ w().title }}</h2>
        <!-- desk calendar showing the selected day; the page flips in whenever the day changes -->
        <svg class="desk-cal" viewBox="0 0 56 62" aria-hidden="true">
          <rect class="back" x="3" y="9" width="50" height="50" rx="6" />
          @for (d of [sel()]; track d.key) {
            <g class="page">
              <rect class="paper" x="3" y="9" width="50" height="50" rx="6" />
              <path class="band" d="M3 15a6 6 0 0 1 6-6h38a6 6 0 0 1 6 6v6H3z" />
              <text class="mon" x="28" y="19">{{ d.mon }}</text>
              <text class="num" x="28" y="45">{{ d.day }}</text>
              <text class="wd" x="28" y="54">{{ d.wd }}</text>
            </g>
          }
          @for (x of [17, 39]; track x) { <rect class="ring" [attr.x]="x - 2" y="3" width="4" height="11" rx="2" /> }
          @if (items().length) { <g class="badge"><circle cx="50" cy="12" r="7" /><text x="50" y="15">{{ items().length }}</text></g> }
        </svg>
      </div>
      <div class="row cal-head">
        <button (click)="shift(-1)">‹</button>
        <span>{{ monthLabel() }}</span>
        <button (click)="shift(1)">›</button>
      </div>
      <div class="cal-grid">
        @for (d of WEEKDAYS; track d) { <span class="muted">{{ d }}</span> }
        @for (c of cells(); track c.key) {
          <button [class.out]="!c.inMonth" [class.today]="c.key === today" [class.sel]="c.key === selected()"
                  (click)="selected.set(c.key)">
            {{ +c.key.slice(8) }}
            <i class="dots">@for (l of busy().get(c.key) ?? []; track l) { <b [style.background]="colors()[l]"></b> }</i>
          </button>
        }
      </div>
      <div class="day">{{ selected() === today ? 'Ma' : dayLabel(selected()) }}</div>
      @for (i of items(); track $index) {
        <div class="row">
          <span><b class="pip" [style.background]="colors()[i.label]"></b>{{ i.summary }}</span>
          <span class="muted cal-meta"><b class="val">{{ i.time }}</b> {{ i.label }}</span>
        </div>
      } @empty {
        <div class="muted">Nincs esemény</div>
      }
      @if (failed().length) { <div class="err">Failed: {{ failed().join(', ') }}</div> }
    </section>`,
})
export class CalendarWidget {
  private readonly ha = inject(HaService);
  readonly w = input.required<W<'calendar'>>();
  readonly WEEKDAYS = WEEKDAYS;
  readonly today = dayKey(new Date());
  readonly month = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly selected = signal(this.today);
  private readonly loaded = signal<{ label: string; events: CalEvent[] }[]>([]);
  readonly failed = signal<string[]>([]);
  readonly cells = computed(() => monthGrid(this.month().getFullYear(), this.month().getMonth()));
  private readonly days = computed(() => groupByDay(this.loaded()));
  // day -> the sources that have something on it (one coloured dot each)
  readonly busy = computed(() => new Map(this.days().map(d => [d.day, [...new Set(d.items.map(i => i.label))]])));
  readonly colors = computed(() => Object.fromEntries(this.w().entities.map(e => [e.label, e.color ?? '#8b8d94'])));
  readonly items = computed(() => this.days().find(d => d.day === this.selected())?.items ?? []);
  readonly sel = computed(() => {
    const d = new Date(`${this.selected()}T12:00`);
    return { key: this.selected(), day: d.getDate(), mon: d.toLocaleDateString('hu', { month: 'short' }).replace('.', '').toUpperCase(),
      wd: d.toLocaleDateString('hu', { weekday: 'short' }) };
  });
  readonly monthLabel = computed(() => this.month().toLocaleDateString('hu', { year: 'numeric', month: 'long' }));
  readonly dayLabel = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('hu', { weekday: 'long', month: 'long', day: 'numeric' });

  constructor() {
    effect(() => {
      this.month(); // reload when the month changes
      if (this.ha.connected()) untracked(() => this.load());
    });
    const id = setInterval(() => this.ha.connected() && this.load(), 30 * 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  shift(by: number) {
    const m = this.month();
    this.month.set(new Date(m.getFullYear(), m.getMonth() + by, 1));
  }

  // one call per source, so an unreachable one (e.g. the NAS) only marks itself as failed
  private async load() {
    const w = this.w();
    const month = this.month();
    const [gridFrom, to] = gridRange(this.cells());
    // Past days are not queried: HA's CalDAV get_events fails (500) for the whole range if any old event's .ics is malformed
    const from = Math.max(gridFrom, new Date().setHours(0, 0, 0, 0));
    if (from >= to) {
      this.loaded.set([]);
      this.failed.set([]);
      return;
    }
    const res = await Promise.allSettled(
      w.entities.map(async c => {
        if ('ids' in c) {
          const t = await this.ha.ws<TodoResp>({
            type: 'call_service', domain: 'todo', service: 'get_items',
            target: { entity_id: c.ids }, service_data: { status: 'needs_action' }, return_response: true,
          });
          return { label: c.label, events: todoEvents(Object.values(t.response).flatMap(l => l.items), from, to) };
        }
        const r = await this.ha.ws<Resp>({
          type: 'call_service', domain: 'calendar', service: 'get_events',
          target: { entity_id: c.id },
          service_data: { start_date_time: new Date(from).toISOString(), end_date_time: new Date(to).toISOString() },
          return_response: true,
        });
        return { label: c.label, events: r.response[c.id]?.events ?? [] };
      }),
    );
    if (month !== this.month()) return; // the user moved on while this was loading
    this.loaded.set(res.flatMap(r => (r.status === 'fulfilled' ? [r.value] : [])));
    this.failed.set(w.entities.filter((_, i) => res[i].status === 'rejected').map(c => c.label));
  }
}
