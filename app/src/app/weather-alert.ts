import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { HaService } from './ha.service';

export interface Hour { datetime: string; condition?: string; precipitation?: number; wind_speed?: number; wind_gust_speed?: number }
export interface Alert { key: string; icon: string; text: string; level: 'warn' | 'bad' }

// ponytail: thresholds derived from OWM's forecast, not official warnings; swap in Meteoalarm if HA gets it
const KINDS: { test: (h: Hour) => boolean; icon: string; what: string; level: Alert['level'] }[] = [
  { test: h => h.condition === 'hail', icon: '🧊', what: 'Jégeső', level: 'bad' },
  { test: h => h.condition === 'lightning-rainy' || h.condition === 'lightning', icon: '⛈️', what: 'Zivatar, villámlás', level: 'bad' },
  { test: h => h.condition === 'exceptional', icon: '⚠️', what: 'Rendkívüli időjárás', level: 'bad' },
  { test: h => h.condition === 'pouring' || (h.precipitation ?? 0) >= 5, icon: '🌧️', what: 'Felhőszakadás', level: 'warn' },
  { test: h => Math.max(h.wind_gust_speed ?? 0, h.wind_speed ?? 0) >= 50, icon: '💨', what: 'Erős szél', level: 'warn' },
];

const hhmm = (d: string) => new Date(d).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

// first hour of each severe kind in the forecast window; hour 0 = happening now
export function weatherAlerts(hours: Hour[]): Alert[] {
  return KINDS.flatMap(k => {
    const i = hours.findIndex(k.test);
    if (i < 0) return [];
    const h = hours[i];
    return [{ key: `${k.what}@${h.datetime}`, icon: k.icon, level: k.level, text: i === 0 ? `${k.what} – most` : `${k.what} várható ${hhmm(h.datetime)}-tól` }];
  });
}

// translucent pop-up over the page while severe weather is due in the next `hours`
@Component({
  selector: 'app-weather-alert',
  template: `
    @if (shown().length) {
      <div class="wx-alert" role="alert">
        @for (a of shown(); track a.key) {
          <div [class]="'wx-a ' + a.level"><span>{{ a.icon }}</span><b>{{ a.text }}</b></div>
        }
        <button (click)="dismiss()" aria-label="Bezár">✕</button>
      </div>
    }`,
})
export class WeatherAlert {
  readonly entity = input.required<string>();
  readonly hours = input(6);
  private readonly ha = inject(HaService);
  private readonly fc = signal<Hour[]>([]);
  private readonly gone = signal<string[]>(load());

  readonly shown = computed(() => weatherAlerts(this.fc().slice(0, this.hours())).filter(a => !this.gone().includes(a.key)));

  constructor() {
    let unsub: Promise<() => void> | undefined;
    effect(() => {
      if (!this.ha.connected() || unsub) return;
      untracked(() => unsub = this.ha.subscribe<{ forecast: Hour[] }>(
        { type: 'weather/subscribe_forecast', entity_id: this.entity(), forecast_type: 'hourly' }, ev => this.fc.set(ev.forecast ?? [])));
    });
    inject(DestroyRef).onDestroy(() => unsub?.then(f => f()).catch(() => {}));
  }

  // a dismissed alert stays hidden; a new kind or start hour pops up again
  dismiss() {
    const keys = [...this.gone(), ...this.shown().map(a => a.key)].slice(-50);
    this.gone.set(keys);
    try { localStorage.setItem('wxAlertGone', JSON.stringify(keys)); } catch { /* private mode: dismiss lasts this session */ }
  }
}

function load(): string[] {
  try { return JSON.parse(localStorage.getItem('wxAlertGone') ?? '[]'); } catch { return []; }
}
