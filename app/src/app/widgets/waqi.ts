import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { W } from '../config';
import { poll } from '../poll';

@Component({
  selector: 'app-waqi',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      @if (aqi(); as a) {
        <div class="clock">{{ a }} <small class="muted">AQI</small></div>
        <i class="aqi-scale"><b [style.left.%]="a > 300 ? 100 : a / 3"></b></i>
      }
      @else { <div class="err">unavailable</div> }
    </section>`,
})
export class WaqiWidget implements OnInit {
  private readonly ref = inject(DestroyRef);
  readonly w = input.required<W<'waqi'>>();
  readonly aqi = signal<number | null>(null);

  ngOnInit() {
    poll(this.ref, 30 * 60_000, async () => {
      try {
        const { lat, lon } = this.w();
        const r = await fetch(`/waqi/feed/geo:${lat};${lon}/`);
        this.aqi.set((await r.json()).data.aqi);
      } catch {
        this.aqi.set(null);
      }
    });
  }
}
