import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { W } from '../config';
import { LinkIcon } from './link-icon';
import { QueueItem, isUp, toQueue } from '../monitor';
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
        @for (q of queue()[s.url]; track $index) {
          <div class="row queue" [title]="q.status">
            <span>{{ q.name }}</span>
            <span class="readout"><i class="meter ok"><b [style.width.%]="q.pct"></b></i><span class="val">{{ q.pct }}%@if (q.left) { · {{ q.left }} }</span></span>
          </div>
        }
      }
    </section>`,
})
export class MonitorWidget implements OnInit {
  private readonly ref = inject(DestroyRef);
  readonly w = input.required<W<'monitor'>>();
  readonly up = signal<Record<string, boolean>>({});
  readonly queue = signal<Record<string, QueueItem[]>>({});

  ngOnInit() {
    poll(this.ref, 60_000, () =>
      this.w().sites.forEach(async s => {
        // only "up" is cached; a down site is rechecked every minute
        const ok = await cached('online:' + s.url, HALF_HOUR, async () => (await isUp(s.checkUrl ?? s.url)) || Promise.reject()).catch(() => false);
        this.up.update(m => ({ ...m, [s.url]: ok }));
        if (s.queue) {
          const inc = s.queue === 'sonarr' ? 'includeSeries=true&includeEpisode=true' : 'includeMovie=true';
          const r = await fetch(`/${s.queue}/api/v3/queue?pageSize=20&${inc}`).catch(() => null);
          const items = r?.ok ? toQueue((await r.json()).records) : []; // ponytail: failed fetch = no list, the dot already says down
          this.queue.update(m => ({ ...m, [s.url]: items }));
        }
      }),
    );
  }
}
