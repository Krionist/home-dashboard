import { Component, computed, inject, input } from '@angular/core';
import { W } from '../config';
import { HaService } from '../ha.service';

const N = 10; // dust particles drawn into the intake

// PM2.5 band → colour class (WHO-ish: <=12 good, <=35 moderate, above bad)
export const pmClass = (pm: number) => (pm <= 12 ? 'ok' : pm <= 35 ? 'warn' : 'bad');

// a tower purifier: dust drifts into the bottom intake, the rotor spins while on, clean air rises from the top
@Component({
  selector: 'app-purifier',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      <div class="ph-head">
        <span><i class="flag" [class.on]="v().on"></i> {{ v().on ? 'Fut' : 'Ki' }}</span>
        <button class="switch" (click)="ha.toggle(w().fan)" [class.on]="v().on" [attr.aria-pressed]="v().on" aria-label="Légtisztító"></button>
      </div>
      <svg class="pu-scene" [class.off]="!v().on" viewBox="0 0 260 110">
        @for (p of dust; track $index) {
          <circle class="dust" [style.fill]="'var(--' + v().cls + ')'" [attr.cx]="p.x" cy="104" r="2.2" [style.--dx.px]="130 - p.x" [style.animation-delay.s]="-p.d" />
        }
        @for (k of [0, 1, 2]; track k) { <path class="air" [attr.d]="'M' + (118 + k * 12) + ' 16q-4 -6 0 -12'" [style.animation-delay.s]="-k * .6" /> }
        <rect class="body" x="104" y="18" width="52" height="84" rx="14" />
        <rect class="grille" x="112" y="78" width="36" height="16" rx="4" />
        <g class="rotor" [style.animation-duration.s]="v().spin">
          <circle cx="130" cy="48" r="17" class="ring" />
          @for (k of [0, 1, 2, 3, 4]; track k) { <path d="M130 48q4 -10 0 -15" [attr.transform]="'rotate(' + k * 72 + ' 130 48)'" /> }
        </g>
        <circle cx="130" cy="48" r="3" class="hub" />
      </svg>
      <div class="pu-modes">
        @for (m of v().modes; track m) {
          <button [class.on]="m === v().mode" (click)="ha.call('fan', 'set_preset_mode', { entity_id: w().fan, preset_mode: m })">{{ m }}</button>
        }
      </div>
      <div class="ph-stats">
        <div><b class="val" [style.color]="'var(--' + v().cls + ')'">{{ v().pm }}</b><small class="muted">PM2.5 µg/m³</small></div>
        <div><b class="val" [style.color]="v().filter < 10 ? 'var(--bad)' : null">{{ v().filter }}%</b><small class="muted">szűrő</small></div>
      </div>
    </section>`,
})
export class PurifierWidget {
  readonly ha = inject(HaService);
  readonly w = input.required<W<'purifier'>>();
  readonly dust = Array.from({ length: N }, (_, i) => ({ x: 20 + ((i * 53) % 220), d: (i * 3) / N }));
  readonly v = computed(() => {
    const e = this.ha.entities(), w = this.w(), f = e[w.fan];
    const pm = Number(e[w.pm25]?.state) || 0;
    const mode = f?.attributes['preset_mode'] as string | undefined;
    return {
      on: f?.state === 'on', mode, modes: (f?.attributes['preset_modes'] as string[] | undefined) ?? [],
      pm, cls: pmClass(pm), filter: Number(e[w.filter]?.state) || 0,
      spin: mode === 'Sleep' ? 3 : mode === 'Favorite' ? .6 : 1.2, // seconds per turn, just for feel
    };
  });
}
