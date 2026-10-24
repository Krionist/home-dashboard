import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { cameraSrc } from '../camera';
import { W } from '../config';
import { HaService } from '../ha.service';
import { poll } from '../poll';

@Component({
  selector: 'app-camera',
  template: `
    <section class="card">
      <div class="cam-head">
        <h2>{{ w().title }}</h2>
        <!-- CCTV camera on a wall mount, slowly panning -->
        <svg class="cctv" viewBox="0 0 64 36" aria-hidden="true">
          <path class="mount" d="M58 4v14M58 11h-12" />
          <g class="body">
            <path d="M8 8h34l6 6-6 6H8a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z" />
            <rect class="lens" x="1" y="10" width="5" height="8" rx="1.5" />
            <circle class="rec" cx="38" cy="14" r="1.8" />
          </g>
          <path class="cone" d="M1 12L-14 2v24L1 16z" />
        </svg>
      </div>
      <div class="cams">
        @for (c of cams(); track c.id) {
          @if (c.src) {
            <a [href]="c.src" target="_blank" rel="noopener" class="cam">
              <img [src]="c.src" [alt]="c.name" loading="lazy" />
              <!-- viewfinder HUD: corner brackets, crosshair, sweeping scanline, REC -->
              <svg class="hud" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden="true">
                <path d="M4 16V4h12M144 4h12v12M156 74v12h-12M16 86H4V74" />
                <path class="cross" d="M76 45h8M80 41v8" />
                <rect class="scan" x="0" y="0" width="160" height="2" />
              </svg>
              <b class="rec-tag"><i></i>REC</b>
              <span>{{ c.name }}</span>
            </a>
          }
        }
      </div>
    </section>`,
})
export class CameraWidget implements OnInit {
  private readonly ref = inject(DestroyRef);
  private readonly ha = inject(HaService);
  readonly w = input.required<W<'camera'>>();
  readonly tick = signal(0);
  readonly refreshSec = computed(() => this.w().refreshSec ?? 300);
  // snapshots go through nginx's /camera/ cache (5 min), so every browser shares one fetch per camera
  readonly cams = computed(() =>
    this.w().entities.map(id => {
      const e = this.ha.entities()[id];
      return { id, name: e?.attributes.friendly_name ?? id, src: cameraSrc('/camera', e?.attributes.entity_picture, this.tick()) };
    }),
  );

  ngOnInit() {
    const ms = this.refreshSec() * 1000;
    // tick = index of the current refresh window, so an F5 inside the window reuses the same URL (browser cache)
    poll(this.ref, ms, () => this.tick.set(Math.floor(Date.now() / ms)));
  }
}
