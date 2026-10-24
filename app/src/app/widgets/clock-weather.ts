import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { W } from '../config';
import { HaService } from '../ha.service';

const LABEL: Record<string, string> = {
  'clear-night': 'Tiszta éjszaka', cloudy: 'Felhős', fog: 'Köd', hail: 'Jégeső', lightning: 'Zivatar', 'lightning-rainy': 'Zivatar, eső',
  partlycloudy: 'Részben felhős', pouring: 'Felhőszakadás', rainy: 'Eső', snowy: 'Havazás', 'snowy-rainy': 'Havas eső', sunny: 'Napos',
  windy: 'Szeles', 'windy-variant': 'Szeles, felhős', exceptional: 'Rendkívüli',
};
// which drawn layers make up each condition
const has = (s: string, ...k: string[]) => k.includes(s);

@Component({
  selector: 'app-clock-weather',
  imports: [DatePipe],
  template: `
    <section class="card">
      <div class="clockface">
        <svg viewBox="0 0 64 64" class="analog">
          <circle class="face" cx="32" cy="32" r="30" />
          @for (k of TICKS; track k) { <line [class.major]="k % 3 === 0" x1="32" y1="4" x2="32" [attr.y2]="k % 3 === 0 ? 10 : 7" [attr.transform]="'rotate(' + k * 30 + ' 32 32)'" /> }
          <line class="hh" x1="32" y1="32" x2="32" y2="17" [attr.transform]="'rotate(' + hands().h + ' 32 32)'" />
          <line class="mh" x1="32" y1="32" x2="32" y2="9" [attr.transform]="'rotate(' + hands().m + ' 32 32)'" />
          <g class="sh" [style.animation-delay.s]="-hands().s"><line x1="32" y1="37" x2="32" y2="7" /></g>
          <circle class="pin" cx="32" cy="32" r="2" />
        </svg>
        <div>
          <div class="clock">{{ now() | date: 'HH' }}<span class="colon">:</span>{{ now() | date: 'mm' }}</div>
          <div class="muted">{{ now() | date: 'EEEE, MMMM d' }}</div>
        </div>
      </div>
      @if (weather(); as e) {
        <div class="weather">
          <svg class="wx" viewBox="0 0 64 52" aria-hidden="true">
            @if (L().sun) {
              <g class="sun" [class.small]="L().cloud">
                <circle cx="22" cy="18" r="9" />
                @for (k of [0, 1, 2, 3, 4, 5, 6, 7]; track k) { <line x1="22" y1="3" x2="22" y2="6.5" [attr.transform]="'rotate(' + k * 45 + ' 22 18)'" /> }
              </g>
            }
            @if (L().moon) { <path class="moon" d="M30 6a13 13 0 1 0 12 18A10 10 0 0 1 30 6z" />
              @for (p of [[48, 10], [54, 22], [12, 12]]; track $index) { <circle class="twinkle" [attr.cx]="p[0]" [attr.cy]="p[1]" r="1.2" [style.animation-delay.s]="$index * 0.7" /> } }
            @if (L().cloud) { <path class="cloud" d="M18 38a9 9 0 0 1 1-18 12 12 0 0 1 23 3 7.5 7.5 0 0 1 2 15z" /> }
            @if (L().rain) { @for (x of [22, 30, 38, 46]; track x) { <line class="drop" [attr.x1]="x" y1="42" [attr.x2]="x - 2" y2="47" [style.animation-delay.s]="(x % 3) * 0.25" /> } }
            @if (L().snow) { @for (x of [24, 34, 44]; track x) { <circle class="flake" [attr.cx]="x" cy="43" r="1.8" [style.animation-delay.s]="(x % 4) * 0.4" /> } }
            @if (L().bolt) { <path class="bolt" d="M34 36l-5 8h5l-3 7 8-10h-5l3-5z" /> }
            @if (L().fog) { @for (y of [40, 45, 50]; track y) { <line class="fogl" x1="10" [attr.y1]="y" x2="54" [attr.y2]="y" [style.animation-delay.s]="(y % 3) * 0.6" /> } }
            @if (L().wind) { <path class="wind" d="M6 30h30a5 5 0 1 0-5-5M6 37h40a5 5 0 1 1-5 5" /> }
          </svg>
          <div class="wx-txt">
            <b>{{ e.attributes['temperature'] }}°</b>
            <span>{{ label(e.state) }}</span>
            <small class="muted">💧 {{ e.attributes['humidity'] }}% · 💨 {{ e.attributes['wind_speed'] ?? '–' }} {{ e.attributes['wind_speed_unit'] ?? '' }}</small>
          </div>
        </div>
        @if (sunArc(); as a) {
          <svg class="sunpath" viewBox="0 0 200 44" aria-hidden="true">
            <path class="arc" d="M10 40Q100 -16 190 40" />
            <line class="horizon" x1="0" y1="40" x2="200" y2="40" />
            <circle class="sundot" [class.night]="!a.up" [attr.cx]="a.x" [attr.cy]="a.y" r="4.5" />
            <text x="10" y="43">{{ a.rise }}</text><text x="190" y="43" text-anchor="end">{{ a.set }}</text>
          </svg>
        }
      }
    </section>`,
})
export class ClockWeatherWidget {
  private readonly ha = inject(HaService);
  readonly w = input.required<W<'clock-weather'>>();
  readonly now = signal(new Date());
  readonly weather = computed(() => this.ha.entities()[this.w().entity]);
  readonly label = (s: string) => LABEL[s] ?? s;
  readonly L = computed(() => {
    const s = this.weather()?.state ?? '';
    return {
      sun: has(s, 'sunny', 'partlycloudy'), moon: s === 'clear-night', wind: has(s, 'windy', 'windy-variant'),
      cloud: has(s, 'cloudy', 'partlycloudy', 'rainy', 'pouring', 'snowy', 'snowy-rainy', 'hail', 'lightning', 'lightning-rainy', 'windy-variant', 'exceptional'),
      rain: has(s, 'rainy', 'pouring', 'lightning-rainy', 'snowy-rainy'), snow: has(s, 'snowy', 'snowy-rainy', 'hail'),
      bolt: has(s, 'lightning', 'lightning-rainy'), fog: s === 'fog',
    };
  });
  // sun position on a day arc from sun.sun (next_rising/next_setting); hidden when the entity is missing
  readonly sunArc = computed(() => {
    const sun = this.ha.entities()['sun.sun'];
    if (!sun) return null;
    const now = this.now().getTime(), up = sun.state === 'above_horizon';
    const set = Date.parse(sun.attributes['next_setting']), riseNext = Date.parse(sun.attributes['next_rising']);
    // while up, today's sunrise is the next one minus a day; at night show the coming day
    const rise = up ? riseNext - 864e5 : riseNext;
    const t = up ? Math.min(1, Math.max(0, (now - rise) / (set - rise))) : 0;
    const x = 10 + 180 * t, y = 40 - 56 * 2 * t * (1 - t); // quadratic bezier with control at y=-16
    const hm = (ms: number) => new Date(ms).toLocaleTimeString('hu', { hour: '2-digit', minute: '2-digit' });
    return { up, x, y: up ? y : 40, rise: hm(rise), set: hm(set) };
  });
  readonly TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  // seconds hand runs as a 60s CSS rotation, offset by the current second
  readonly hands = computed(() => {
    const d = this.now(), m = d.getMinutes(), s = d.getSeconds() + d.getMilliseconds() / 1000;
    return { h: (d.getHours() % 12) * 30 + m / 2, m: m * 6 + s / 10, s };
  });

  constructor() {
    const id = setInterval(() => this.now.set(new Date()), 10_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
