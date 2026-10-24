import { Component, computed, inject, input } from '@angular/core';
import { W } from '../config';
import { HaService } from '../ha.service';

// NUT status flags: OL = on line, OB = on battery, LB = low battery, CHRG = charging
export function upsMode(status = ''): 'line' | 'battery' | 'low' | 'unknown' {
  const f = status.split(' ');
  return f.includes('OB') ? (f.includes('LB') ? 'low' : 'battery') : f.includes('OL') ? 'line' : 'unknown';
}

const LABEL = { line: 'Hálózat', battery: 'Akkuról', low: 'Akku lemerülőben', unknown: 'Ismeretlen' };

// grid plug → UPS (battery fill = charge) → load; current dashes flow from the grid, or from the battery during an outage
@Component({
  selector: 'app-ups',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      <div class="ph-head">
        <span><i class="flag on" [class.warn]="v().mode === 'battery'" [class.bad-flag]="v().mode === 'low' || v().mode === 'unknown'"></i> {{ label[v().mode] }}</span>
        <span class="muted">{{ v().status }}</span>
      </div>
      <svg [class]="'ups-scene ' + v().mode" viewBox="0 0 260 90">
        <g class="plug"><path d="M22 34v-8M32 34v-8" /><rect x="16" y="34" width="22" height="18" rx="4" /><path d="M27 52v8" /></g>
        <path class="wire in" d="M27 60v14h75" />
        <path class="wire out" d="M158 64h56" />
        <rect class="box" x="102" y="18" width="56" height="64" rx="8" />
        <rect class="cell" x="114" y="30" width="32" height="40" rx="3" />
        <rect class="fill" x="116" [attr.y]="32 + 36 * (1 - v().charge / 100)" width="28" [attr.height]="36 * v().charge / 100" rx="2" />
        <rect class="tip" x="124" y="26" width="12" height="4" rx="1" />
        <g class="load"><rect x="214" y="46" width="34" height="26" rx="4" /><path d="M222 80h18M231 72v8" /></g>
      </svg>
      <div class="ph-stats">
        <div><b class="val">{{ v().charge }}%</b><small class="muted">akku</small></div>
        <div><b class="val">{{ v().load }}%</b><small class="muted">terhelés</small></div>
        <div><b class="val">{{ v().vin }} V</b><small class="muted">be</small></div>
        <div><b class="val">{{ v().vout }} V</b><small class="muted">ki</small></div>
      </div>
    </section>`,
})
export class UpsWidget {
  readonly ha = inject(HaService);
  readonly w = input.required<W<'ups'>>();
  readonly label = LABEL;
  readonly v = computed(() => {
    const e = this.ha.entities(), w = this.w();
    const n = (id: string) => Math.round(Number(e[id]?.state) || 0);
    const status = e[w.status]?.state ?? '';
    return { status, mode: upsMode(status), charge: Math.min(100, n(w.charge)), load: n(w.load), vin: n(w.input), vout: n(w.output) };
  });
}
