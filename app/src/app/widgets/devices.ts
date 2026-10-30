import { Component, computed, inject, input } from '@angular/core';
import { W } from '../config';
import { HaService } from '../ha.service';

// Android "charging"/"discharging"/"full"/"not_charging", iOS "Charging"/"Not Charging"/"Full" → one vocabulary
// plugged (charger_type sensor not 'none') but neither charging nor full = held at a charge limit
export function chargeState(raw = '', plugged = false): 'charging' | 'full' | 'plugged' | 'idle' {
  const s = raw.toLowerCase().replace(/\s+/g, '_');
  return s === 'charging' ? 'charging' : s === 'full' ? 'full' : plugged ? 'plugged' : 'idle';
}
export const levelClass = (pct: number) => (pct <= 15 ? 'bad' : pct <= 35 ? 'warn' : 'ok');

const LABEL = { charging: 'Töltődik', full: 'Feltöltve', plugged: 'Csatlakoztatva', idle: 'Merül' };

// phone / tablet / watch outlines whose screen fills up to the battery level; a wave rides the top, a bolt pulses while charging
@Component({
  selector: 'app-devices',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      <div class="dev-row">
        @for (d of devs(); track d.name; let i = $index) {
          <figure class="dev" [class]="'dev ' + d.cls + ' ' + d.state">
            <svg [attr.viewBox]="'0 0 ' + d.w + ' 120'" aria-hidden="true">
              <defs><clipPath [attr.id]="'scr' + i"><rect x="6" [attr.y]="d.watch ? 32 : 10" [attr.width]="d.w - 12" [attr.height]="d.watch ? 56 : 100" [attr.rx]="d.watch ? 11 : 5" /></clipPath></defs>
              @if (d.watch) {
                <rect class="strap" x="17" y="2" width="30" height="28" rx="6" /><rect class="strap" x="17" y="90" width="30" height="28" rx="6" />
                <rect class="strap" x="62" y="52" width="3" height="16" rx="1.5" />
              }
              <rect class="frame" x="1" [attr.y]="d.watch ? 26 : 1" [attr.width]="d.w - 2" [attr.height]="d.watch ? 68 : 118" [attr.rx]="d.watch ? 18 : d.tablet ? 9 : 12" />
              <g [attr.clip-path]="'url(#scr' + i + ')'">
                <rect class="screen" x="0" y="0" [attr.width]="d.w" height="120" />
                <g class="fill" [style.transform]="'translateY(' + d.top + 'px)'">
                  <path class="wave" [attr.d]="wave(d.w)" />
                  <rect class="liquid" x="0" y="6" [attr.width]="d.w" height="120" />
                </g>
              </g>
              @if (d.watch) { } @else if (!d.tablet) { <rect class="notch" [attr.x]="d.w / 2 - 6" y="4" width="12" height="3" rx="1.5" /> }
              @else { <circle class="notch" [attr.cx]="d.w / 2" cy="5.5" r="1.6" /> }
              @if (d.state === 'charging' || d.state === 'plugged') { <path class="bolt" [attr.transform]="'translate(' + (d.w / 2 - 9) + ' 46)'" d="M11 0L0 16h7l-2 12L18 10h-7l2-10z" /> }
            </svg>
            <figcaption>
              <b class="val">{{ d.pct }}%</b>
              <span>{{ d.name }}</span>
              <small class="muted">{{ label[d.state] }}</small>
            </figcaption>
          </figure>
        }
      </div>
    </section>`,
})
export class DevicesWidget {
  readonly ha = inject(HaService);
  readonly w = input.required<W<'devices'>>();
  readonly label = LABEL;
  readonly devs = computed(() => {
    const e = this.ha.entities();
    return this.w().devices.map(d => {
      const pct = Math.max(0, Math.min(100, Math.round(Number(e[d.level]?.state) || 0)));
      const tablet = d.kind === 'tablet';
      const watch = d.kind === 'watch';
      return { name: d.name, pct, tablet, watch, w: tablet ? 96 : 64, top: watch ? 84 - 0.56 * pct : 110 - pct, state: chargeState(e[d.state]?.state, !!d.charger && !['none', 'unknown', 'unavailable', ''].includes(e[d.charger]?.state ?? 'none')), cls: levelClass(pct) };
    });
  });
  // two periods of a sine-ish wave across the screen width, doubled so the CSS slide loops seamlessly
  wave(w: number) {
    const q = w / 4;
    return `M0 4${Array.from({ length: 8 }, (_, i) => ` q${q / 2} ${i % 2 ? 4 : -4} ${q} 0`).join('')}V10H0Z`;
  }
}
