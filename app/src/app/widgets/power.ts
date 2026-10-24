import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { W } from '../config';
import { HaService } from '../ha.service';
import { sparkPath } from '../ha-rows';

type History = Record<string, { s: string }[]>;

// seconds per current pulse along the cord: faster the more it draws (clamped so idle still moves and peaks stay readable)
export const pulse = (watts: number) => Math.max(.4, Math.min(3, 120 / Math.max(watts, 1)));

// smart plug: wall socket → cord with current pulses → server; 24h power area chart below
@Component({
  selector: 'app-power',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      <div class="ph-head">
        <span><i class="flag" [class.on]="v().on"></i> {{ v().on ? 'Áram alatt' : 'Kikapcsolva' }}</span>
        <span class="pw-now"><b>{{ v().w }}</b> W</span>
      </div>
      <svg class="pw-scene" [class.off]="!v().on" viewBox="0 0 260 64">
        <g class="socket"><rect x="8" y="14" width="36" height="36" rx="9" /><circle cx="20" cy="32" r="2.6" /><circle cx="32" cy="32" r="2.6" /></g>
        <path class="cord" d="M44 32C90 32 100 50 140 50S190 32 208 32" />
        <path class="cord flow" d="M44 32C90 32 100 50 140 50S190 32 208 32" [style.animation-duration.s]="v().pulse" />
        <g class="srv">
          <rect x="208" y="10" width="44" height="44" rx="5" />
          @for (k of [0, 1, 2]; track k) { <line x1="214" [attr.y1]="20 + k * 12" x2="236" [attr.y2]="20 + k * 12" /><circle class="led" cx="245" [attr.cy]="20 + k * 12" r="1.8" [style.animation-delay.s]="-k * .4" /> }
        </g>
      </svg>
      @if (chart(); as c) {
        <svg class="pw-chart" viewBox="0 0 260 46" preserveAspectRatio="none"><path class="area" [attr.d]="c.p[1]" /><path [attr.d]="c.p[0]" /></svg>
        <div class="pw-range muted"><span>24h</span><span>min {{ c.min }} · átl {{ c.avg }} · max {{ c.max }} W</span></div>
      }
      <div class="ph-stats">
        <div><b class="val">{{ v().a }} A</b><small class="muted">áram</small></div>
        <div><b class="val">{{ v().volt }} V</b><small class="muted">feszültség</small></div>
        <div><b class="val">{{ v().kwh }}</b><small class="muted">kWh össz.</small></div>
      </div>
    </section>`,
})
export class PowerWidget {
  readonly ha = inject(HaService);
  readonly w = input.required<W<'power'>>();
  readonly chart = signal<{ p: [string, string]; min: number; max: number; avg: number } | null>(null);
  readonly v = computed(() => {
    const e = this.ha.entities(), w = this.w();
    const n = (id: string) => Number(e[id]?.state) || 0;
    const f = (x: number, d: number) => x.toLocaleString('hu-HU', { maximumFractionDigits: d });
    const watts = n(w.power);
    return {
      on: e[w.switch]?.state === 'on', w: f(watts, 0), pulse: pulse(watts),
      a: f(n(w.current), 2), volt: f(n(w.voltage), 0), kwh: f(n(w.energy), 1),
    };
  });

  constructor() {
    // ponytail: no toggle on purpose, one misclick would cut power to the whole server
    effect(() => { if (this.ha.connected()) untracked(() => this.load()); });
    const id = setInterval(() => this.ha.connected() && this.load(), 10 * 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  private async load() {
    const id = this.w().power;
    try {
      const h = await this.ha.ws<History>({
        type: 'history/history_during_period', start_time: new Date(Date.now() - 24 * 3600_000).toISOString(),
        entity_ids: [id], minimal_response: true, no_attributes: true, significant_changes_only: false,
      });
      const ys = (h[id] ?? []).map(p => Number(p.s)).filter(Number.isFinite);
      if (ys.length < 2) return;
      const r = (x: number) => Math.round(x);
      this.chart.set({ p: sparkPath(ys, 260, 46), min: r(Math.min(...ys)), max: r(Math.max(...ys)), avg: r(ys.reduce((a, b) => a + b) / ys.length) });
    } catch { /* ponytail: chart is decoration, live values still show */ }
  }
}
