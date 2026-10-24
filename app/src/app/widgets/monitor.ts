import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { W } from '../config';
import { LinkIcon } from './link-icon';
import { isUp } from '../monitor';
import { HALF_HOUR, cached } from '../cache';
import { poll } from '../poll';

@Component({
  selector: 'app-monitor',
  imports: [LinkIcon],
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      @for (s of w().sites; track s.url) {
        <div class="row">
          <a class="ilink" [href]="s.url" target="_blank" rel="noopener"><app-link-icon [title]="s.title" [icon]="s.icon" />{{ s.title }}</a>
          <span class="dot" [class.up]="up()[s.url] === true" [class.down]="up()[s.url] === false"></span>
        </div>
      }
    </section>`,
})
export class MonitorWidget implements OnInit {
  private readonly ref = inject(DestroyRef);
  readonly w = input.required<W<'monitor'>>();
  readonly up = signal<Record<string, boolean>>({});

  ngOnInit() {
    poll(this.ref, 60_000, () =>
      this.w().sites.forEach(async s => {
        // only "up" is cached; a down site is rechecked every minute
        const ok = await cached('online:' + s.url, HALF_HOUR, async () => (await isUp(s.checkUrl ?? s.url)) || Promise.reject()).catch(() => false);
        this.up.update(m => ({ ...m, [s.url]: ok }));
      }),
    );
  }
}
