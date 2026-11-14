import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { W } from '../config';
import { poll } from '../poll';

type Session = {
  Id: string; UserName?: string; DeviceName?: string;
  NowPlayingItem?: { Id: string; Name: string; Type: string; SeriesId?: string; SeriesName?: string; ParentIndexNumber?: number; IndexNumber?: number; RunTimeTicks?: number };
  PlayState?: { PositionTicks?: number; IsPaused?: boolean };
};
export type Playing = { id: string; title: string; sub: string; who: string; img: string; pct: number; paused: boolean };

export function toPlaying(sessions: Session[]): Playing[] {
  return sessions.filter(s => s.NowPlayingItem).map(s => {
    const i = s.NowPlayingItem!, pos = s.PlayState?.PositionTicks ?? 0;
    const ep = i.Type === 'Episode' ? `S${String(i.ParentIndexNumber ?? 0).padStart(2, '0')}E${String(i.IndexNumber ?? 0).padStart(2, '0')} · ` : '';
    return {
      id: s.Id, title: i.SeriesName ?? i.Name, sub: i.SeriesName ? ep + i.Name : '',
      who: [s.UserName, s.DeviceName].filter(Boolean).join(' · '),
      img: `/jellyfin/Items/${i.SeriesId ?? i.Id}/Images/Primary?maxHeight=120`,
      pct: i.RunTimeTicks ? Math.round((pos / i.RunTimeTicks) * 100) : 0, paused: !!s.PlayState?.IsPaused,
    };
  });
}

// Jellyfin /Sessions through the nginx proxy (token added there): what is playing right now, on which device
@Component({
  selector: 'app-jellyfin',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      @for (p of playing(); track p.id) {
        <div class="jf-row">
          <img [src]="p.img" alt="" loading="lazy" />
          <div>
            <b>{{ p.paused ? '⏸' : '▶' }} {{ p.title }}</b>
            @if (p.sub) { <small>{{ p.sub }}</small> }
            <small class="muted">{{ p.who }}</small>
            <span class="meter ok jf-prog"><b [style.width.%]="p.pct"></b></span>
          </div>
        </div>
      } @empty { <p class="muted">Most senki nem néz semmit</p> }
    </section>`,
})
export class JellyfinWidget {
  readonly w = input.required<W<'jellyfin'>>();
  readonly playing = signal<Playing[]>([]);

  constructor() {
    // ponytail: a failed fetch keeps the last list
    poll(inject(DestroyRef), 15_000, () =>
      fetch('/jellyfin/Sessions?activeWithinSeconds=960').then(r => (r.ok ? r.json() : Promise.reject())).then(s => this.playing.set(toPlaying(s))).catch(() => {}));
  }
}
