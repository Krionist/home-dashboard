import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { W } from '../config';
import { HaService } from '../ha.service';
import { Row, sparkPath, toRows } from '../ha-rows';

type History = Record<string, { s: string }[]>;

@Component({
  selector: 'app-ha-entities',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      @if (gauge(); as g) {
        <div class="gauge" [class]="'gauge ' + g.level">
          <svg viewBox="0 0 60 76" class="jar">
            <rect class="lid" x="12" y="2" width="36" height="8" rx="2" />
            <path class="jar-glass" d="M14 10h32v4c6 3 9 8 9 14v38a8 8 0 0 1-8 8H13a8 8 0 0 1-8-8V28c0-6 3-11 9-14z" />
            @for (k of g.coins; track k) {
              <g class="coin" [style.animation-delay.s]="k * 0.08">
                <ellipse cx="30" [attr.cy]="66 - k * 5" rx="17" ry="4.2" /><ellipse class="top" cx="30" [attr.cy]="64.6 - k * 5" rx="17" ry="4.2" />
              </g>
            }
            <path class="shine" d="M11 30v30" />
          </svg>
          <div><b>{{ 100 - g.pct }}%</b><small class="muted">maradt · {{ g.pct }}% {{ g.label }}</small></div>
        </div>
      }
      @if (w().view === 'tiles') {
        <div class="tiles">
          @for (r of rows(); track r.id) {
            <div [class]="'tile i-' + r.icon + ' ' + tone(r)" [class.off]="r.state === 'unavailable'" [style.--p]="fill(r)">
              @if (r.toggle) {
                <svg [class]="'dev ' + (isLight(r) ? 'bulb' : 'plug')" [class.lit]="r.state === 'on'" viewBox="0 0 32 40" (click)="ha.toggle(r.id)" aria-hidden="true">
                  @if (isLight(r)) {
                    @for (k of [0, 1, 2, 3, 4]; track k) { <line class="ray" x1="16" y1="1" x2="16" y2="4" [attr.transform]="'rotate(' + (k * 36 - 72) + ' 16 15)'" /> }
                    <path class="glass" d="M16 6a9 9 0 0 0-5 16.5V27h10v-4.5A9 9 0 0 0 16 6z" />
                    <path class="fil" d="M13 20l1.5-4 1.5 3 1.5-3 1.5 4" />
                    <path class="base" d="M11.5 29h9M12.5 32h7M14 35h4" />
                  } @else {
                    <rect class="glass" x="4" y="6" width="24" height="28" rx="6" />
                    <circle class="hole" cx="11" cy="20" r="2" /><circle class="hole" cx="21" cy="20" r="2" />
                    <circle class="pwr" cx="16" cy="11" r="1.6" />
                    <path class="bolt" d="M17 23l-3 5h3l-2 4 5-6h-3l2-3z" />
                  }
                </svg>
                <button class="switch" (click)="ha.toggle(r.id)" [class.on]="r.state === 'on'" [attr.aria-pressed]="r.state === 'on'" [attr.aria-label]="r.name"></button>
              } @else {
                @switch (r.icon) {
                  @case ('thermo') {
                    <svg viewBox="0 0 20 48">
                      <rect class="glass" x="5.5" y="2" width="9" height="34" rx="4.5" /><circle class="glass" cx="10" cy="40" r="6.5" />
                      <rect class="liq" x="8" y="6" width="4" height="32" rx="2" /><circle class="liq-b" cx="10" cy="40" r="4.5" />
                      @for (t of [10, 18, 26]; track t) { <line class="tk" x1="15" x2="17.5" [attr.y1]="t" [attr.y2]="t" /> }
                    </svg>
                  }
                  @case ('drop') {
                    <svg viewBox="0 0 24 32">
                      <clipPath [attr.id]="'dc-' + r.id"><path d="M12 2C12 2 3 13.5 3 20a9 9 0 0 0 18 0C21 13.5 12 2 12 2Z" /></clipPath>
                      <rect class="liq" x="0" y="0" width="24" height="32" [attr.clip-path]="'url(#dc-' + r.id + ')'" />
                      <path class="glass" d="M12 2C12 2 3 13.5 3 20a9 9 0 0 0 18 0C21 13.5 12 2 12 2Z" />
                    </svg>
                  }
                  @case ('battery') {
                    <svg viewBox="0 0 44 22">
                      <rect class="glass" x="1" y="1" width="38" height="20" rx="4" /><rect class="cap" x="40" y="7" width="3" height="8" rx="1" />
                      <rect class="liq" x="4" y="4" width="32" height="14" rx="2" />
                    </svg>
                  }
                  @case ('ring') {
                    <svg viewBox="0 0 36 36" class="ring">
                      <circle class="track" cx="18" cy="18" r="15.9" pathLength="100" />
                      <circle class="fill" cx="18" cy="18" r="15.9" pathLength="100" [style.stroke-dasharray]="(r.num ?? 0) + ' 100'" />
                    </svg>
                  }
                  @case ('down') { <svg viewBox="0 0 24 32" class="flow">@for (k of [0, 1, 2]; track k) { <path [attr.d]="'M5 ' + (6 + k * 8) + 'l7 6 7-6'" /> }</svg> }
                  @case ('up') { <svg viewBox="0 0 24 32" class="flow">@for (k of [0, 1, 2]; track k) { <path [attr.d]="'M5 ' + (26 - k * 8) + 'l7-6 7 6'" /> }</svg> }
                  @case ('wallet') {
                    <svg viewBox="0 0 48 40" class="money">
                      <rect class="note" x="10" y="6" width="28" height="14" rx="2" /><circle class="note-c" cx="24" cy="13" r="3" />
                      <rect class="glass" x="4" y="12" width="40" height="24" rx="5" />
                      <path class="glass" d="M30 19h14v10H30a5 5 0 0 1 0-10z" /><circle class="clasp" cx="32" cy="24" r="2" />
                    </svg>
                  }
                  @case ('receipt') {
                    <svg viewBox="0 0 48 40" class="money">
                      <rect class="slot" x="8" y="2" width="32" height="5" rx="2.5" />
                      <g class="paper"><path class="glass" d="M12 5h24v31l-3-2-3 2-3-2-3 2-3-2-3 2-3-2-3 2z" />
                        @for (k of [0, 1, 2, 3]; track k) { <line class="ln" x1="16" [attr.x2]="k === 3 ? 26 : 32" [attr.y1]="11 + k * 5" [attr.y2]="11 + k * 5" /> }
                      </g>
                    </svg>
                  }
                  @case ('coins') {
                    <svg viewBox="0 0 48 40" class="money coins">
                      @for (k of [0, 1, 2, 3]; track k) {
                        <g class="coin" [style.animation-delay.s]="k * 0.12">
                          <ellipse cx="24" [attr.cy]="34 - k * 6" rx="15" ry="4.5" /><ellipse class="top" cx="24" [attr.cy]="32.5 - k * 6" rx="15" ry="4.5" />
                        </g>
                      }
                    </svg>
                  }
                  @case ('flag') { <svg viewBox="0 0 24 24" class="beacon"><circle class="halo" cx="12" cy="12" r="10" /><circle class="core" cx="12" cy="12" r="5" /></svg> }
                }
              }
              @for (s of [r.state]; track s) { <b class="tick">{{ fmt(r) }}<small>{{ r.unit }}</small></b> }
              <span class="muted">{{ r.name }}</span>
            </div>
          }
        </div>
      } @else {
        @for (r of rows(); track r.id) {
          <div class="row" [class.off]="r.state === 'unavailable'">
            <span>{{ r.name }}</span>
            @if (r.toggle) {
              <button class="switch" (click)="ha.toggle(r.id)" [class.on]="r.state === 'on'" [attr.aria-pressed]="r.state === 'on'" [attr.aria-label]="r.name"></button>
            } @else {
              <span class="readout">
                @if (r.kind === 'spark' && spark()[r.id]; as p) {
                  <svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none"><path class="area" [attr.d]="p[1]" /><path [attr.d]="p[0]" /></svg>
                }
                @if (r.kind === 'bar') {
                  <i class="meter" [class]="'meter ' + level(r)"><b [style.width.%]="r.num"></b></i>
                }
                @if (r.kind === 'flag') {
                  <i class="flag" [class.on]="r.state === 'on'" [class.warn]="r.id.startsWith('update.')"></i>
                }
                @for (s of [r.state]; track s) { <span class="val tick">{{ fmt(r) }} {{ r.unit }}</span> }
              </span>
            }
          </div>
        }
      }
    </section>`,
})
export class HaEntitiesWidget {
  readonly ha = inject(HaService);
  readonly w = input.required<W<'ha-entities'>>();
  readonly rows = computed(() => toRows(this.ha.entities(), this.w().entities));
  readonly spark = signal<Record<string, [string, string]>>({});
  readonly gauge = computed(() => {
    const g = this.w().gauge;
    if (!g) return null;
    const e = this.ha.entities();
    const v = Number(e[g.value]?.state), max = Number(e[g.max]?.state);
    if (!Number.isFinite(v) || !(max > 0)) return null;
    const pct = Math.round((v / max) * 100);
    const coins = Array.from({ length: Math.round((1 - Math.min(pct, 100) / 100) * 10) }, (_, i) => i); // ≤10 coins = what is left
    return { pct: Math.min(pct, 100), label: g.label ?? '', level: pct > 90 ? 'bad' : pct > 70 ? 'warn' : 'ok', coins };
  });

  constructor() {
    effect(() => { if (this.ha.connected()) untracked(() => this.loadHistory()); });
    const id = setInterval(() => this.ha.connected() && this.loadHistory(), 10 * 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  isLight(r: Row) {
    return r.id.startsWith('light.') || /light|lamp|lámpa|lampa|izzó/i.test(r.id + ' ' + r.name);
  }

  level(r: Row) {
    const n = r.num ?? 0;
    return r.lowBad ? (n < 20 ? 'bad' : n < 40 ? 'warn' : 'ok') : n > 85 ? 'bad' : n > 65 ? 'warn' : 'ok';
  }

  // colour class for tiles; thermo uses its own temperature scale
  tone(r: Row) {
    const n = r.num ?? 0;
    switch (r.icon) {
      case 'thermo': return n < 5 ? 'cold' : n < 18 ? 'cool' : n < 26 ? 'ok' : n < 30 ? 'warn' : 'bad';
      case 'drop': return 'cold';
      case 'battery': case 'ring': return this.level(r);
      case 'down': case 'up': return n > 0 ? 'ok' : 'idle';
      case 'wallet': case 'receipt': case 'coins': return 'gold';
      case 'flag': return r.state !== 'on' ? 'idle' : r.id.startsWith('update.') ? 'warn' : 'ok';
      default: return '';
    }
  }

  // 0..1 fill level for thermo (-10..40 °C), drop and battery
  fill(r: Row) {
    const n = r.num ?? 0;
    return Math.min(1, Math.max(0.03, r.icon === 'thermo' ? (n + 10) / 50 : n / 100));
  }

  fmt(r: Row) {
    return r.num !== null ? r.num.toLocaleString('hu-HU', { maximumFractionDigits: 1 }) : r.state;
  }

  private async loadHistory() {
    const ids = this.w().entities.filter(id => id.startsWith('sensor.'));
    if (!ids.length) return;
    try {
      const h = await this.ha.ws<History>({
        type: 'history/history_during_period', start_time: new Date(Date.now() - 24 * 3600_000).toISOString(),
        entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false,
      });
      const out: Record<string, [string, string]> = {};
      for (const [id, pts] of Object.entries(h)) {
        const ys = pts.map(p => Number(p.s)).filter(Number.isFinite);
        if (ys.length > 1 && Math.min(...ys) !== Math.max(...ys)) out[id] = sparkPath(ys, 100, 24);
      }
      this.spark.set(out);
    } catch { /* ponytail: sparklines are decoration, rows still show values */ }
  }
}
