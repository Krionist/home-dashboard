import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { W } from '../config';
import { HaService } from '../ha.service';

interface Fc { datetime: string; condition?: string; temperature: number; templow?: number; precipitation?: number; precipitation_probability?: number; wind_speed?: number; wind_bearing?: number }

const EMOJI: Record<string, string> = {
  'clear-night': '🌙', cloudy: '☁️', fog: '🌫️', hail: '🌨️', lightning: '🌩️', 'lightning-rainy': '⛈️', partlycloudy: '⛅',
  pouring: '🌧️', rainy: '🌦️', snowy: '❄️', 'snowy-rainy': '🌨️', sunny: '☀️', windy: '💨', 'windy-variant': '💨', exceptional: '⚠️',
};
const DAY = new Intl.DateTimeFormat('hu-HU', { weekday: 'short' });
const W_ = 300, H = 110, PAD = 18; // daily chart viewBox

@Component({
  selector: 'app-forecast',
  template: `
    <section class="card fc">
      <h2>{{ w().title }}</h2>
      @if (w().mode === 'rain') {
        @if (rain(); as r) {
          <div class="rain-sum">{{ r.next }}</div>
          <div class="rain-bars">
            @for (b of r.bars; track b.t) {
              <div [title]="b.mm + ' mm · ' + b.p + '%'">
                <small class="val">{{ b.mm ? b.mm : '' }}</small>
                <i><b [style.height.%]="b.h" [style.opacity]="0.35 + b.p / 150"></b></i>
                <small class="muted">{{ b.label }}</small>
              </div>
            }
          </div>
        } @else { <div class="muted">…</div> }
      } @else {
      @if (hourly().length) {
        <div class="fc-hours">
          @for (h of hourly(); track h.datetime) {
            <div><small class="muted">{{ hour(h) }}</small><span>{{ ico(h) }}</span><b class="val">{{ round(h.temperature) }}°</b></div>
          }
        </div>
      }
      @if (chart(); as c) {
        <svg class="fc-chart" [attr.viewBox]="'0 0 ' + W_ + ' ' + H" aria-hidden="true">
          @for (p of c.pts; track $index) {
            @if (p.rain) { <rect class="rain" [attr.x]="p.x - 12" [attr.y]="H - p.rain" width="24" [attr.height]="p.rain" rx="2" /> }
          }
          <polyline class="hi" [attr.points]="c.hi" />
          @if (c.lo) { <polyline class="lo" [attr.points]="c.lo" /> }
          @for (p of c.pts; track $index) {
            <circle class="hi" [attr.cx]="p.x" [attr.cy]="p.yHi" r="2.5" />
            <text class="hi" [attr.x]="p.x" [attr.y]="p.yHi - 7">{{ p.tHi }}°</text>
            @if (p.tLo !== null) {
              <circle class="lo" [attr.cx]="p.x" [attr.cy]="p.yLo" r="2.5" />
              <text class="lo" [attr.x]="p.x" [attr.y]="p.yLo + 15">{{ p.tLo }}°</text>
            }
          }
        </svg>
        <div class="fc-days">
          @for (d of daily(); track d.datetime) {
            <div><b>{{ day(d) }}</b><span>{{ ico(d) }}</span>
              @if (d.precipitation) { <small class="rainv">{{ round(d.precipitation) }} mm</small> }
              @if (d.wind_speed !== undefined) { <small class="muted">{{ int(d.wind_speed) }} km/h</small> }
            </div>
          }
        </div>
      } @else { <div class="muted">…</div> }
      }
    </section>`,
})
export class ForecastWidget {
  readonly w = input.required<W<'forecast'>>();
  private readonly ha = inject(HaService);
  readonly hourly = signal<Fc[]>([]);
  readonly daily = signal<Fc[]>([]);
  readonly W_ = W_; readonly H = H;

  constructor() {
    const unsubs: Promise<() => void>[] = [];
    // subscribe once the socket is up; the library keeps it alive across reconnects
    effect(() => {
      if (!this.ha.connected() || unsubs.length) return;
      untracked(() => {
        const id = this.w().entity;
        const rain = this.w().mode === 'rain';
        for (const [t, sink, n] of (rain ? [['hourly', this.hourly, 24]] : [['hourly', this.hourly, 12], ['daily', this.daily, 6]]) as ['hourly' | 'daily', typeof this.hourly, number][])
          unsubs.push(this.ha.subscribe<{ forecast: Fc[] }>({ type: 'weather/subscribe_forecast', entity_id: id, forecast_type: t },
            ev => sink.set((ev.forecast ?? []).slice(0, n))));
      });
    });
    inject(DestroyRef).onDestroy(() => unsubs.forEach(u => u.then(f => f()).catch(() => {})));
  }

  readonly chart = computed(() => {
    const d = this.daily();
    if (!d.length) return null;
    const temps = d.flatMap(x => [x.temperature, x.templow ?? x.temperature]);
    const min = Math.min(...temps), max = Math.max(...temps), span = max - min || 1;
    const maxRain = Math.max(...d.map(x => x.precipitation ?? 0), 10); // ponytail: 10 mm floor so drizzle stays small
    const y = (t: number) => PAD + (1 - (t - min) / span) * (H - 2 * PAD);
    const pts = d.map((x, i) => ({
      x: (i + 0.5) * (W_ / d.length), yHi: y(x.temperature), yLo: y(x.templow ?? x.temperature),
      tHi: this.round(x.temperature), tLo: x.templow === undefined ? null : this.round(x.templow),
      rain: x.precipitation ? (x.precipitation / maxRain) * (H * 0.6) : 0,
    }));
    return {
      pts, hi: pts.map(p => `${p.x},${p.yHi}`).join(' '),
      lo: d.some(x => x.templow !== undefined) ? pts.map(p => `${p.x},${p.yLo}`).join(' ') : '',
    };
  });

  // next 24 h of precipitation: bar height = mm (2 mm/h fills it), opacity = probability
  readonly rain = computed(() => {
    const h = this.hourly();
    if (!h.length) return null;
    const first = h.find(x => (x.precipitation ?? 0) > 0);
    const total = this.round(h.reduce((a, x) => a + (x.precipitation ?? 0), 0));
    return {
      next: !first ? 'Nem várható eső 24 órán belül' : first === h[0] ? `Most esik · ${total} mm 24 órán belül` : `Eső várható ${this.hour(first)}-tól · ${total} mm`,
      bars: h.map((x, i) => ({
        t: x.datetime, mm: this.round(x.precipitation ?? 0), p: x.precipitation_probability ?? (x.precipitation ? 100 : 0),
        h: x.precipitation ? Math.max(6, Math.min(100, (x.precipitation / 2) * 100)) : 0,
        label: i % 3 === 0 ? this.hour(x) : '',
      })),
    };
  });

  int(n: number) { return Math.round(n); }
  round(n: number) { return Math.round(n * 10) / 10; }
  ico(f: Fc) { return EMOJI[f.condition ?? ''] ?? '·'; }
  hour(f: Fc) { return new Date(f.datetime).getHours() + ':00'; }
  day(f: Fc) { return DAY.format(new Date(f.datetime)).replace('.', '').toUpperCase(); }
}
