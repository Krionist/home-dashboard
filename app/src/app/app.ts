import { Component, inject, signal } from '@angular/core';
import { ConfigService } from './config.service';
import { HaService } from './ha.service';
import { Background } from './background';
import { PageComponent } from './page.component';
import { OverdueBanner } from './overdue';

@Component({
  selector: 'app-root',
  imports: [Background, OverdueBanner, PageComponent],
  template: `
    <app-bg />
    @if (cfg.error() || ha.error()) { <p class="err">{{ cfg.error() }} {{ ha.error() }}</p> }
    @if (cfg.config(); as c) {
      <app-overdue [config]="c" />
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
      </nav>
      <!-- recreated per tab so the cards replay their entrance animation -->
      @for (p of [c.pages[tab()]]; track p.name) { <app-page [page]="p" /> }
    } @else if (!cfg.error()) {
      <div class="boot" aria-label="Betöltés"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" pathLength="100" /></svg></div>
    }`,
})
export class App {
  readonly cfg = inject(ConfigService);
  readonly ha = inject(HaService);
  readonly tab = signal(0);
  readonly navIcon = (name: string) => (/home|főoldal/i.test(name) ? 'home' : /servic|szolg/i.test(name) ? 'services' : 'grid');

  constructor() {
    this.cfg.load().then(() => {
      const c = this.cfg.config();
      if (c) this.ha.connect(c.haUrl);
    });
  }
}
