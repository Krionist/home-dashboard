import { Component, inject, input } from '@angular/core';
import { W } from '../config';
import { ConfigService } from '../config.service';
import { HaService } from '../ha.service';

// big link to the Home Assistant UI: house outline with the HA "circuit tree", nodes pulse while the websocket is connected
@Component({
  selector: 'app-ha-button',
  template: `
    <a class="card ha-btn" [class.off]="!ha.connected()" [href]="w().url ?? cfg.config()?.haUrl" target="_blank" rel="noopener">
      <svg class="ha-logo" viewBox="0 0 64 64" aria-hidden="true">
        <path class="house" d="M32 5L59 30h-7v27H12V30H5z" />
        <g class="tree">
          <path d="M32 57V26M32 44l-9-8M32 38l9-8" />
          <circle class="node" cx="32" cy="24" r="3.4" />
          <circle class="node" cx="22" cy="34.5" r="3.4" style="animation-delay: -.6s" />
          <circle class="node" cx="42" cy="28.5" r="3.4" style="animation-delay: -1.2s" />
        </g>
      </svg>
      <span class="ha-txt">
        <b>{{ w().title ?? 'Home Assistant' }}</b>
        <small class="muted"><i class="flag" [class.on]="ha.connected()"></i> {{ ha.connected() ? 'Kapcsolódva' : 'Offline' }}</small>
      </span>
      <span class="ha-go" aria-hidden="true">↗</span>
    </a>`,
})
export class HaButtonWidget {
  readonly ha = inject(HaService);
  readonly cfg = inject(ConfigService);
  readonly w = input.required<W<'ha-button'>>();
}
