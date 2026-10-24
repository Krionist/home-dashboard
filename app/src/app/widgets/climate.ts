import { Component, computed, inject, input } from '@angular/core';
import { ClimateRow, nextMode, nextTarget, toClimate } from '../climate';
import { W } from '../config';
import { HaService } from '../ha.service';

const LABEL: Record<string, string> = {
  off: 'Ki', cool: 'Hűt', heat: 'Fűt', heat_cool: 'Auto', auto: 'Auto', dry: 'Szárít', fan_only: 'Ventil',
};

@Component({
  selector: 'app-climate',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      @for (c of rows(); track c.id) {
        <div class="ac" [class]="'ac m-' + c.state" [class.active]="c.active">
          @if (isAc(c)) {
            <svg class="unit-art" viewBox="0 0 140 64">
              <rect class="body" x="4" y="4" width="132" height="32" rx="9" />
              <line class="seam" x1="12" y1="26" x2="128" y2="26" />
              <circle class="pwr" cx="18" cy="15" r="2" />
              <text class="disp" x="122" y="19">{{ c.target ?? '–' }}°</text>
              <rect class="louver" x="16" y="30" width="108" height="4" rx="2" />
              @for (k of [0, 1, 2]; track k) {
                <path class="air" [attr.d]="'M' + (40 + k * 30) + ' 40q-5 6 0 11t0 11'" [style.animation-delay.s]="k * 0.3" />
              }
            </svg>
          } @else {
            <svg class="unit-art" viewBox="0 0 140 64">
              @for (k of [0, 1, 2]; track k) {
                <path class="air heat-wave" [attr.d]="'M' + (38 + k * 28) + ' 18q-4-4 0-8t0-8'" [style.animation-delay.s]="k * 0.4" />
              }
              <rect class="pipe" x="14" y="24" width="98" height="5" rx="2.5" /><rect class="pipe" x="14" y="56" width="98" height="5" rx="2.5" />
              @for (k of [0, 1, 2, 3, 4, 5, 6]; track k) { <rect class="fin" [attr.x]="20 + k * 13.5" y="20" width="10" height="44" rx="4" /> }
              <circle class="knob" cx="127" cy="42" r="12" />
              <!-- "23.5" is wider than the knob at any readable size: squeeze into a fixed width instead of overflowing -->
              <text class="disp knob-t" x="127" y="44.5" [attr.textLength]="String(c.target ?? '–').length > 2 ? 17 : null" lengthAdjust="spacingAndGlyphs">{{ c.target ?? '–' }}</text>
            </svg>
          }
          <div class="ac-info">
            <span class="ac-name">{{ c.name }}</span>
            <small class="muted">most {{ c.current ?? '–' }}° · {{ label(c.state) }}@if (c.state !== 'off' && !c.active) { · pihen }</small>
          </div>
          <span class="ac-btns">
            <button (click)="step(c, -1)" [disabled]="c.target === null" aria-label="Hőfok le">−</button>
            <button (click)="step(c, 1)" [disabled]="c.target === null" aria-label="Hőfok fel">+</button>
            <button class="ac-mode" (click)="mode(c)" [disabled]="!c.modes.length" title="Mód váltása">{{ label(c.state) }} ›</button>
          </span>
        </div>
      }
    </section>`,
})
export class ClimateWidget {
  readonly String = String;
  private readonly ha = inject(HaService);
  readonly w = input.required<W<'climate'>>();
  readonly rows = computed(() => toClimate(this.ha.entities(), this.w().entities));
  readonly label = (s: string) => LABEL[s] ?? s;

  // split AC (has cool/dry) vs. radiator-style thermostat
  isAc(c: ClimateRow) {
    return c.modes.some(m => m === 'cool' || m === 'dry' || m === 'fan_only');
  }

  step(c: ClimateRow, dir: 1 | -1) {
    this.ha.call('climate', 'set_temperature', { entity_id: c.id, temperature: nextTarget(c, dir) });
  }

  mode(c: ClimateRow) {
    this.ha.call('climate', 'set_hvac_mode', { entity_id: c.id, hvac_mode: nextMode(c) });
  }
}
