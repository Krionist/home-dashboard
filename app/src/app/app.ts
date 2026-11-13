import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ConfigService } from './config.service';
import { HaService } from './ha.service';
import { Background } from './background';
import { PageComponent } from './page.component';
import { OverdueBanner } from './overdue';
import { LowBatteryBanner } from './low-battery';
import { kiosk } from './kiosk';
import { WeatherAlert } from './weather-alert';
import { EditService } from './edit.service';

@Component({
  selector: 'app-root',
  imports: [DatePipe, Background, OverdueBanner, LowBatteryBanner, PageComponent, WeatherAlert],
  template: `
    @if (k?.ringing()) {
      <!-- live MJPEG straight from HA: the nginx /camera cache is minutes stale -->
      <div class="doorbell" (click)="k!.ring(false)">
        @if (doorbellSrc(); as src) { <img [src]="src" alt="Csengő kamera" /> }
        <span>🔔 Csengetnek</span>
      </div>
    } @else if (k?.night()) {
      <!-- AMOLED: drift a few px every minute against burn-in -->
      <div class="night-clock" (click)="k!.test.set(false)" [style.translate]="drift(k!.now())">{{ k!.now() | date: 'HH:mm' }}</div>
    } @else {
    <app-bg />
    @if (cfg.error() || ha.error()) { <p class="err">{{ cfg.error() }} {{ ha.error() }}</p> }
    @if (ed.on()) {
      <div class="edit-bar">
        <span>Szerkesztés</span>
        @if (ed.error()) { <span class="err">{{ ed.error() }}</span> }
        <button class="on" [disabled]="ed.busy()" (click)="ed.save()">Mentés</button>
        <button [disabled]="ed.busy()" (click)="ed.cancel()">Mégse</button>
      </div>
    }
    @if (cfg.config()?.weatherAlert; as wa) { <app-weather-alert [entity]="wa.entity" [hours]="wa.hours ?? 6" /> }
    @if (tablet && cfg.config()?.tablet; as t) {
      <app-page class="tablet" [page]="t" key="tablet" />
      <div class="night-test">
        <button (click)="ed.start()">✏️ Szerkesztés</button>
        <button (click)="k!.test.set(true)">🌙 Éjszakai óra teszt</button>
        @if (t.doorbell) { <button (click)="k!.ring()">🔔 Csengő teszt</button> }
      </div>
    } @else if (cfg.config(); as c) {
      <app-overdue [config]="c" />
      <app-low-battery [config]="c" />
      <nav>
        <div class="seg" [style.--n]="c.pages.length" [style.--i]="tab()">
          <span class="seg-pill"></span>
          @for (p of c.pages; track p.name; let i = $index) {
            <button [class.on]="i === tab()" (click)="tab.set(i)">
              <svg [class]="'nav-ico ' + navIcon(p.name)" viewBox="0 0 24 24" aria-hidden="true">
                @switch (navIcon(p.name)) {
                  @case ('home') {
                    <path class="smoke" d="M17 3q1.5 1.5 0 3t0 3" />
                    <path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><rect class="door" x="10" y="14" width="4" height="6" rx=".5" />
                  }
                  @case ('services') {
                    <g class="gear"><circle cx="12" cy="12" r="3.2" />
                      @for (k of [0, 1, 2, 3, 4, 5]; track k) { <line x1="12" y1="3" x2="12" y2="6" [attr.transform]="'rotate(' + k * 60 + ' 12 12)'" /> }
                      <circle cx="12" cy="12" r="6.5" /></g>
                  }
                  @default { <rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /> }
                }
              </svg>
              {{ p.name }}
            </button>
          }
        </div>
        @if (!ha.connected()) { <span class="err">HA offline</span> }
        @if (!ed.on()) { <button class="edit-btn" (click)="ed.start()" aria-label="Szerkesztés">✏️</button> }
      </nav>
      <!-- recreated per tab so the cards replay their entrance animation -->
      @for (p of [c.pages[tab()]]; track p.name) { <app-page [page]="p" [key]="tab()" /> }
    } @else if (!cfg.error()) {
      <div class="boot" aria-label="Betöltés"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" pathLength="100" /></svg></div>
    }
    }`,
})
export class App {
  readonly cfg = inject(ConfigService);
  readonly ha = inject(HaService);
  readonly ed = inject(EditService);
  readonly tab = signal(0);
  readonly tablet = location.pathname.startsWith('/tablet');
  readonly k = this.tablet ? kiosk(() => this.cfg.config()?.tablet?.brightness, () => this.cfg.config()?.tablet?.doorbell) : undefined;
  readonly doorbellSrc = computed(() => {
    const c = this.cfg.config(), cam = c?.tablet?.doorbell?.camera;
    const pic = cam ? (this.ha.entities()[cam]?.attributes['entity_picture'] as string | undefined) : undefined;
    return pic ? c!.haUrl + pic.replace('/api/camera_proxy/', '/api/camera_proxy_stream/') : '';
  });
  drift(d: Date) { const m = d.getHours() * 60 + d.getMinutes(); return `${(m * 37) % 61 - 30}px ${(m * 53) % 41 - 20}px`; }
  readonly navIcon = (name: string) => (/home|főoldal/i.test(name) ? 'home' : /servic|szolg/i.test(name) ? 'services' : 'grid');

  constructor() {
    if (this.tablet) {
      document.body.classList.add('tablet');
    }
    this.cfg.load().then(() => {
      const c = this.cfg.config();
      if (c) this.ha.connect(c.haUrl);
    });
  }
}
