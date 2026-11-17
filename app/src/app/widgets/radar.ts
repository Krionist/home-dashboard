import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { W } from '../config';
import { poll } from '../poll';

// slippy-map tile of a point at zoom z, as fractional x/y (integer part = tile, rest = position inside it)
export function tileOf(lat: number, lon: number, z: number) {
  const n = 2 ** z, r = (lat * Math.PI) / 180;
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n };
}

// RainViewer still frames over a dark basemap, 3x3 tiles around the point: a few PNGs every 10 min instead of a WebGL map
// ponytail: RainViewer's free tiles stop at zoom 7, higher zooms come back blank
@Component({
  selector: 'app-radar',
  imports: [DatePipe],
  template: `
    <section class="card">
      <h2>{{ w().title }} @if (frame(); as f) { <small class="radar-time">{{ f.time * 1000 | date: 'HH:mm' }}</small> }</h2>
      <div class="radar" [style.height.px]="w().height ?? 360">
        <div class="radar-grid" [style.left]="'calc(50% - ' + pos().x + 'px)'" [style.top]="'calc(50% - ' + pos().y + 'px)'">
          @for (t of tiles(); track $index) {
            <div><img [src]="BASE + t.z + '/' + t.y + '/' + t.x" alt="" />
              @if (frame(); as f) { <img class="rain" [src]="host + f.path + '/256/' + t.z + '/' + t.x + '/' + t.y + '/2/1_1.png'" alt="" /> }</div>
          }
        </div>
        <span class="radar-pin"></span>
      </div>
    </section>`,
})
export class RadarWidget {
  readonly w = input.required<W<'radar'>>();
  readonly host = 'https://tilecache.rainviewer.com';
  // Esri dark grey canvas: keyless (CARTO's dark tiles now need an API key); its URLs are z/y/x
  readonly BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/';
  readonly frame = signal<{ time: number; path: string } | undefined>(undefined);
  private readonly t = computed(() => tileOf(this.w().lat, this.w().lon, this.w().zoom ?? 7));
  // the 3x3 block, row by row
  readonly tiles = computed(() => {
    const z = this.w().zoom ?? 7, x = Math.floor(this.t().x), y = Math.floor(this.t().y);
    return [-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => ({ z, x: x + dx, y: y + dy })));
  });
  // the point inside the 768px grid, so the grid can be shifted to centre it
  readonly pos = computed(() => ({ x: Math.round((this.t().x % 1 + 1) * 256), y: Math.round((this.t().y % 1 + 1) * 256) }));

  constructor() {
    poll(inject(DestroyRef), 10 * 60_000, () =>
      fetch('https://api.rainviewer.com/public/weather-maps.json').then(r => r.json())
        .then(d => this.frame.set(d.radar.past.at(-1)), e => console.warn('radar', e)));
  }
}
