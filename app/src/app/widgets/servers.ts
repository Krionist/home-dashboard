import { Component, computed, inject, input } from '@angular/core';
import { W } from '../config';
import { HaService } from '../ha.service';

const UP = ['online', 'on', 'running', 'normal'];

// one 1U rack unit per server, drawn in SVG; status LED + CPU/RAM meters come from HA sensors
@Component({
  selector: 'app-servers',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      <div class="rack">
        @for (s of units(); track s.name; let i = $index) {
          <svg class="unit" [class.down]="!s.up" viewBox="0 0 260 58" [attr.aria-label]="s.name + ': ' + s.state">
            <rect class="chassis" x="1" y="1" width="258" height="56" rx="5" />
            <rect class="ear" x="1" y="1" width="14" height="56" rx="4" /><rect class="ear" x="245" y="1" width="14" height="56" rx="4" />
            <circle class="screw" cx="8" cy="12" r="2" /><circle class="screw" cx="8" cy="46" r="2" />
            <circle class="screw" cx="252" cy="12" r="2" /><circle class="screw" cx="252" cy="46" r="2" />
            <!-- drive bays with activity LEDs -->
            @for (d of s.bays; track $index; let b = $index) {
              <rect class="bay" [attr.x]="22 + b * 17" y="9" width="14" height="40" rx="2" />
              @if (d.t !== null) { <text class="bt" [attr.x]="29 + b * 17" y="30" [class]="'bt ' + d.lvl">{{ d.t }}°</text> }
              <circle class="act" [attr.cx]="29 + b * 17" cy="43" r="1.6" [style.animation-delay.s]="(b * 0.37 + i * 0.21) % 1.3" />
            }
            <circle class="led" cx="103" cy="16" r="3.2" />
            <text class="label" x="111" y="19">{{ s.name }}</text>
            <text class="state" x="111" y="31">{{ s.state }}{{ s.extra }}</text>
            <!-- CPU / RAM meters on the front display -->
            @for (m of s.meters; track m.k; let j = $index) {
              <text class="mk" x="103" [attr.y]="44 + j * 9">{{ m.k }}</text>
              <rect class="mbg" x="126" [attr.y]="39 + j * 9" width="84" height="5" rx="2.5" />
              <rect class="mfill" [class]="'mfill ' + m.lvl" x="126" [attr.y]="39 + j * 9" width="84" height="5" rx="2.5" [style.transform]="'scaleX(' + m.p / 100 + ')'" />
              <text class="mv" x="240" [attr.y]="44 + j * 9">{{ m.p }}%</text>
            }
          </svg>
        }
      </div>
    </section>`,
})
export class ServersWidget {
  private readonly ha = inject(HaService);
  readonly w = input.required<W<'servers'>>();
  readonly units = computed(() => {
    const e = this.ha.entities();
    const pct = (id: string) => Math.round(Math.min(100, Math.max(0, Number(e[id]?.state) || 0)));
    const lvl = (p: number) => (p > 85 ? 'bad' : p > 65 ? 'warn' : 'ok');
    return this.w().servers.map(s => {
      const state = e[s.status]?.state ?? 'unavailable';
      const meters = [['CPU', s.cpu], ['RAM', s.mem]].map(([k, id]) => ({ k, p: pct(id), lvl: lvl(pct(id)) }));
      // drives: temperature sensors shown on the bays (≤4); without them, 4 blank bays
      const bays = (s.drives?.length ? s.drives.slice(0, 4) : [null, null, null, null]).map(id => {
        const t = id ? Math.round(Number(e[id]?.state)) : NaN;
        return Number.isFinite(t) ? { t, lvl: t > 50 ? 'bad' : t > 42 ? 'warn' : 'ok' } : { t: null, lvl: '' };
      });
      const extra = (s.extra ?? []).map(id => e[id] && ` · ${Number(e[id].state).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} ${e[id].attributes.unit_of_measurement ?? ''}`).join('');
      return { name: s.name, state, up: UP.includes(state), meters, bays, extra };
    });
  });
}
