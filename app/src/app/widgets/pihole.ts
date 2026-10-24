import { Component, computed, inject, input } from '@angular/core';
import { W } from '../config';
import { HaService } from '../ha.service';

const N = 12; // query particles in the stream

// DNS queries flow from the left into a shield; the blocked share bounces off red, the rest passes through
@Component({
  selector: 'app-pihole',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      <div class="ph-head">
        <span><i class="flag" [class.on]="v().status === 'on'"></i> {{ v().status === 'on' ? 'Fut' : 'Leállt' }}</span>
        <button class="switch" (click)="ha.toggle(w().switch)" [class.on]="v().enabled" [attr.aria-pressed]="v().enabled" aria-label="Pi-hole szűrés"></button>
      </div>
      <svg class="ph-scene" [class.off]="!v().enabled" viewBox="0 0 260 84">
        <line class="lane" x1="6" y1="42" x2="254" y2="42" />
        @for (p of particles(); track $index) {
          <circle [class]="p.blocked ? 'q blocked' : 'q'" cx="0" cy="42" r="2.6" [style.animation-delay.s]="-p.delay" />
        }
        <g class="shield">
          <path d="M130 14l22 8v18c0 14-9 24-22 30-13-6-22-16-22-30V22z" />
          <path class="mark" d="M121 41l6 6 12-13" />
        </g>
      </svg>
      <div class="ph-stats">
        <div><b class="val">{{ v().ads }}</b><small class="muted">blokkolva ma</small></div>
        <div><b class="val">{{ v().pct }}%</b><small class="muted">arány</small></div>
        <div><b class="val">{{ v().domains }}</b><small class="muted">tiltólista</small></div>
      </div>
    </section>`,
})
export class PiholeWidget {
  readonly ha = inject(HaService);
  readonly w = input.required<W<'pihole'>>();
  readonly v = computed(() => {
    const e = this.ha.entities(), w = this.w();
    const n = (id: string, d = 0) => Number(e[id]?.state).toLocaleString('hu-HU', { maximumFractionDigits: d });
    return {
      enabled: e[w.switch]?.state === 'on', status: e[w.status]?.state ?? 'unavailable',
      ads: n(w.ads), domains: n(w.domains), pct: n(w.percent, 1), pctNum: Number(e[w.percent]?.state) || 0,
    };
  });
  // at least one red particle so the blocking is visible even at a few percent
  readonly particles = computed(() => {
    const red = this.v().enabled ? Math.max(1, Math.round((this.v().pctNum / 100) * N)) : 0;
    const step = red ? Math.round(N / red) : 0;
    return Array.from({ length: N }, (_, i) => ({ blocked: step > 0 && i % step === 0, delay: (i * 3.6) / N }));
  });
}
