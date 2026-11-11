import { Component, computed, inject, input, signal } from '@angular/core';
import { Config } from './config';
import { HaService } from './ha.service';
import { lowBattery } from './widgets/devices';

// bottom banner when a phone or watch from a devices widget drops under 25% and is not charging; the X hides it until reload
@Component({
  selector: 'app-low-battery',
  template: `
    @if (hits().length && !hidden()) {
      <div class="overdue lowbat" role="alert">
        <ul>@for (h of hits(); track h.name) { <li>🪫 {{ h.name }}: {{ h.pct }}%</li> }</ul>
        <button (click)="hidden.set(true)" aria-label="Bezár">✕</button>
      </div>
    }`,
})
export class LowBatteryBanner {
  private readonly ha = inject(HaService);
  readonly config = input.required<Config>();
  readonly hidden = signal(false);
  readonly hits = computed(() => {
    const devices = this.config().pages.flatMap(p => p.columns.flatMap(c => c.widgets.flatMap(w => (w.type === 'devices' ? w.devices : []))));
    return lowBattery(devices, this.ha.entities());
  });
}
