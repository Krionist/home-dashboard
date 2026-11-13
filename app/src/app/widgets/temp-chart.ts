import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { W } from '../config';
import { HaService } from '../ha.service';

type History = Record<string, { s: string; lu: number }[]>; // lu: unix seconds
const COLORS = ['#f0a640', '#4aa8ff', '#4fd18b', '#c77dff', '#ff5a5f'];
const VW = 300, VH = 110, HOURS = 24;
// compact legend: an icon instead of the name, guessed from the entity id / name
const ICONS: [RegExp, string][] = [[/outside|outdoor|kint|kül|szonda|probe/i, '🌳'], [/garage|garázs/i, '🚗'], [/server|szerver/i, '🖥️'], [/indoor|benti|szoba|nappali|living/i, '🏠']];
const iconFor = (s: string) => ICONS.find(([re]) => re.test(s))?.[1] ?? '🌡️';

// several sensors' last 24 h on one shared scale, current values underneath
@Component({
  selector: 'app-temp-chart',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      @if (chart(); as c) {
        <svg class="tc-chart" [attr.viewBox]="'0 0 ' + VW + ' ' + VH" preserveAspectRatio="none" aria-hidden="true">
          @for (g of c.grid; track g.y) { <line class="tc-grid" x1="0" [attr.y1]="g.y" [attr.x2]="VW" [attr.y2]="g.y" /> }
          @for (l of c.lines; track l.id) { <polyline [attr.points]="l.pts" [attr.stroke]="l.color" /> }
        </svg>
        <div class="tc-axis muted"><span>{{ c.max }}°</span><span>{{ c.min }}°</span></div>
      }
      <div class="tc-legend" [class.mini]="w().compact">
        @for (n of now(); track n.id) {
          <div [style.--c]="n.color" [title]="n.name"><i></i>@if (w().compact) { <span class="tc-ico">{{ n.icon }}</span> } @else { <span class="muted">{{ n.name }}</span> }<b class="val">{{ n.value }}</b></div>
        }
      </div>
      @if (humidity(); as h) {
        <div class="tc-hum">
          <span class="muted">💧@if (!w().compact) { Páratartalom }</span><b class="val">{{ h }}%</b>
          <i><b [style.width.%]="h"></b></i>
        </div>
      }
    </section>`,
})
export class TempChartWidget {
  readonly w = input.required<W<'temp-chart'>>();
  private readonly ha = inject(HaService);
  private readonly hist = signal<History>({});
  readonly VW = VW; readonly VH = VH;

  constructor() {
    effect(() => { if (this.ha.connected()) untracked(() => this.load()); });
    const id = setInterval(() => this.ha.connected() && this.load(), 10 * 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  readonly now = computed(() => {
    const e = this.ha.entities();
    return this.w().entities.map((id, i) => {
      const s = e[id], n = Number(s?.state);
      return {
        id, color: COLORS[i % COLORS.length], icon: iconFor(id + ' ' + (s?.attributes['friendly_name'] ?? '')),
        name: (s?.attributes['friendly_name'] as string | undefined)?.replace(/\s*(szonda )?(hőmérséklete?|temperature)$/i, '') ?? id,
        value: Number.isFinite(n) ? `${n.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} ${s.attributes['unit_of_measurement'] ?? ''}` : '–',
      };
    });
  });

  readonly humidity = computed(() => {
    const id = this.w().humidity, n = id ? Number(this.ha.entities()[id]?.state) : NaN;
    return Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n))) : null;
  });

  readonly chart = computed(() => {
    const h = this.hist(), t0 = Date.now() / 1000 - HOURS * 3600;
    const series = this.w().entities.map((id, i) => ({
      id, color: COLORS[i % COLORS.length],
      pts: (h[id] ?? []).map(p => [Math.max(p.lu, t0), Number(p.s)] as const).filter(p => Number.isFinite(p[1])),
    })).filter(s => s.pts.length); // one point is enough, the line is extended to now
    if (!series.length) return null;
    const ys = series.flatMap(s => s.pts.map(p => p[1]));
    const min = Math.floor(Math.min(...ys)), max = Math.ceil(Math.max(...ys)), span = max - min || 1;
    const y = (v: number) => (VH - 4 - ((v - min) / span) * (VH - 8)).toFixed(1);
    const x = (t: number) => (((t - t0) / (HOURS * 3600)) * VW).toFixed(1);
    return {
      min, max,
      grid: [0, 0.5, 1].map(f => ({ y: y(min + f * span) })),
      lines: series.map(s => ({ id: s.id, color: s.color, pts: [...s.pts, [Date.now() / 1000, s.pts.at(-1)![1]]].map(p => `${x(p[0])},${y(p[1])}`).join(' ') })),
    };
  });

  private async load() {
    try {
      this.hist.set(await this.ha.ws<History>({
        type: 'history/history_during_period', start_time: new Date(Date.now() - HOURS * 3600_000).toISOString(),
        entity_ids: this.w().entities, minimal_response: true, no_attributes: true, significant_changes_only: false,
      }));
    } catch { /* ponytail: chart is decoration, the legend still shows live values */ }
  }
}
