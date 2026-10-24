import { Component, computed, inject, input } from '@angular/core';
import { W } from '../config';
import { HaService } from '../ha.service';

// peers on a ring around the client; packets travel inward while downloading, outward while uploading
const PEERS = [0, 1, 2, 3, 4, 5].map(k => {
  const a = (k / 6) * 2 * Math.PI - Math.PI / 2;
  return { x: Math.round(130 + Math.cos(a) * 96), y: Math.round(50 + Math.sin(a) * 38) };
});

@Component({
  selector: 'app-torrent',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      <svg class="tr-scene" viewBox="0 0 260 100">
        @for (p of PEERS; track $index; let i = $index) {
          <line class="link" x1="130" y1="50" [attr.x2]="p.x" [attr.y2]="p.y" />
          <circle class="peer" [attr.cx]="p.x" [attr.cy]="p.y" r="5" />
          @if (v().down > 0) {
            <circle class="pkt dl" r="2.2">
              <animateMotion [attr.dur]="dur(v().down)" repeatCount="indefinite" [attr.begin]="i * 0.25 + 's'" [attr.path]="'M' + p.x + ' ' + p.y + 'L130 50'" />
            </circle>
          }
          @if (v().up > 0 && i % 2 === 0) {
            <circle class="pkt ul" r="2.2">
              <animateMotion [attr.dur]="dur(v().up)" repeatCount="indefinite" [attr.begin]="i * 0.3 + 's'" [attr.path]="'M130 50L' + p.x + ' ' + p.y" />
            </circle>
          }
        }
        <circle class="hub" [class.busy]="v().down > 0 || v().up > 0" cx="130" cy="50" r="15" />
        <path class="magnet" d="M123 44v6a7 7 0 0 0 14 0v-6M123 44h4M133 44h4" />
      </svg>
      <div class="tr-stats">
        <span class="dl">↓ <b class="val">{{ v().downTxt }}</b></span>
        <span class="ul">↑ <b class="val">{{ v().upTxt }}</b></span>
        <span class="muted">{{ v().active }} aktív · {{ v().status }}</span>
        @if (w().alt) {
          <button class="switch" (click)="ha.toggle(w().alt!)" [class.on]="v().altOn" [attr.aria-pressed]="v().altOn" title="Alternatív (lassított) sebesség" aria-label="Alternatív sebesség"></button>
        }
      </div>
    </section>`,
})
export class TorrentWidget {
  readonly ha = inject(HaService);
  readonly w = input.required<W<'torrent'>>();
  readonly PEERS = PEERS;
  readonly v = computed(() => {
    const e = this.ha.entities(), w = this.w();
    const num = (id: string) => Number(e[id]?.state) || 0;
    const txt = (id: string) => `${num(id).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} ${e[id]?.attributes.unit_of_measurement ?? ''}`;
    return {
      down: num(w.down), up: num(w.up), downTxt: txt(w.down), upTxt: txt(w.up),
      active: num(w.active), status: e[w.status]?.state ?? 'unavailable', altOn: !!w.alt && e[w.alt]?.state === 'on',
    };
  });

  // faster traffic -> faster packets (log scale, 0.6s..2.4s)
  dur(speed: number) {
    return `${Math.max(0.6, 2.4 - Math.log10(1 + speed) * 0.9).toFixed(2)}s`;
  }
}
