import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { W } from '../config';
import { FeedItem, ago, parseFeed, parseJellyfin } from '../feed';
import { HALF_HOUR, cached } from '../cache';
import { poll } from '../poll';
import { hue } from './link-icon';

type Item = FeedItem & { feed: string; tab: string };
// line icons for tabs (24×24, stroked); pick with `icon` on a feed, no icon = first letter
const ICONS: Record<string, string[]> = {
  news: ['M4 5h13v14H6a2 2 0 0 1-2-2z', 'M17 9h3v8a2 2 0 0 1-2 2', 'M7 9h7', 'M7 12.5h7', 'M7 16h4'],
  hn: ['M4 4h16v16H4z', 'M8 8l4 5 4-5', 'M12 13v4'],
  yt: ['M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z', 'M10 9v6l5-3z'],
  film: ['M4 4h16v16H4z', 'M8 4v16', 'M16 4v16', 'M4 8h4', 'M4 12h4', 'M4 16h4', 'M16 8h4', 'M16 12h4', 'M16 16h4'],
  tv: ['M3 7h18v12H3z', 'M8 3l4 4 4-4', 'M7 21h10'],
  lobster: ['M12 21v-6', 'M12 15c-4 0-6-3-6-7 0-2 1-4 3-5-1 3 0 5 2 5', 'M12 15c4 0 6-3 6-7 0-2-1-4-3-5 1 3 0 5-2 5', 'M9 18h6'],
};
const FOLD = 5; // items shown before "Még N" expands up to the widget's limit

@Component({
  selector: 'app-rss',
  template: `
    <section class="card">
      <div class="cam-head">
        <h2>{{ w().title }}</h2>
        @switch (art()) {
          @case ('reddit') {
            <svg class="art snoo" viewBox="0 0 64 40" aria-hidden="true">
              <g class="antenna"><path d="M32 14l3-9 8 2" /><circle cx="45" cy="7.5" r="3" /></g>
              <circle class="ear" cx="17" cy="20" r="4" /><circle class="ear" cx="47" cy="20" r="4" />
              <ellipse class="head" cx="32" cy="25" rx="16" ry="11" />
              <g class="eyes"><circle cx="26" cy="23" r="2.6" /><circle cx="38" cy="23" r="2.6" /></g>
              <path class="smile" d="M26 30q6 4 12 0" />
            </svg>
          }
          @case ('video') {
            <svg class="art tv" viewBox="0 0 64 40" aria-hidden="true">
              <path class="ant" d="M26 2l6 6 6-6" />
              <rect class="frame" x="8" y="8" width="48" height="30" rx="6" />
              <rect class="screen" x="12" y="12" width="40" height="22" rx="3" />
              <path class="play" d="M28 17v12l10-6z" />
              <rect class="scan" x="12" y="12" width="40" height="2" />
            </svg>
          }
          @case ('cve') {
            <svg class="art cve" viewBox="0 0 64 40" aria-hidden="true">
              <path class="shield" d="M32 2l14 5v11c0 9-6 15-14 19-8-4-14-10-14-19V7z" />
              <g class="bug"><ellipse cx="32" cy="21" rx="4.5" ry="6" /><path d="M27.5 18h-4M36.5 18h4M27.5 22h-4M36.5 22h4M28 26l-3 3M36 26l3 3M30 15l-2-3M34 15l2-3" /></g>
            </svg>
          }
          @default {
            <svg class="art paper" viewBox="0 0 64 40" aria-hidden="true">
              <rect class="sheet back" x="16" y="5" width="36" height="31" rx="3" />
              <rect class="sheet" x="10" y="9" width="38" height="29" rx="3" />
              <rect class="photo" x="14" y="14" width="12" height="9" rx="1" />
              @for (l of [[29, 15, 44], [29, 19, 41], [29, 23, 44], [14, 28, 44], [14, 32, 36]]; track $index) {
                <line class="txt" [attr.x1]="l[0]" [attr.y1]="l[1]" [attr.x2]="l[2]" [attr.y2]="l[1]" [style.animation-delay.s]="$index * 0.35" />
              }
            </svg>
          }
        }
      </div>
      @if (w().mode === 'tabs') {
        <div class="subtabs" role="tablist">
          @for (t of tabs(); track t.name) {
            <button role="tab" [attr.aria-selected]="t.name === tab()" [class.on]="t.name === tab()" (click)="pick(t)"
              [title]="t.name" [style.--h]="hue(t.name)">
              <i>
                @if (ICONS[t.icon]; as paths) {
                  <svg viewBox="0 0 24 24">@for (d of paths; track $index) { <path [attr.d]="d" pathLength="1" /> }</svg>
                } @else { {{ t.name.charAt(0).toUpperCase() }} }
              </i><span>@if (t.reddit) { <small>r/</small> }{{ t.name }}</span>
            </button>
          }
        </div>
      }
      @if (!items().length && !failed().length) {
        @for (k of [0, 1, 2, 3, 4]; track k) { <div class="skel-item"><i></i><span><b></b><b></b></span></div> }
      }
      @for (i of shown(); track i.link) {
        <a class="feed-item" [href]="i.link" target="_blank" rel="noopener">
          @if (i.image) { <img [src]="i.image" alt="" loading="lazy" referrerpolicy="no-referrer" /> }
          <span>
            {{ i.title }}
            @if (i.severity; as sv) {
              <small class="cve-meta"><b [class]="'sev ' + sv.level">{{ sv.score }} {{ sv.level }}</b>@for (t of i.tags; track t) { <b class="tech" [style.--h]="hue(t)">{{ t }}</b> }<span class="muted">{{ ago(i.date) }}</span></small>
            } @else if (i.watched) { <small class="jf-seen">✓ megnézve</small>
            } @else if (i.unplayed) { <small class="jf-new">{{ i.unplayed }} nem megnézett epizód</small>
            } @else if (i.feed !== i.tab) { <small class="muted">{{ i.feed }}</small> }
          </span>
        </a>
      }
      @if (total() > FOLD) {
        <button class="more" (click)="open.set(!open())" [attr.aria-expanded]="open()">
          {{ open() ? 'Kevesebb' : 'Még ' + (total() - FOLD) }} <span [class.flip]="open()">▾</span>
        </button>
      }
      @if (failed().length) { <div class="err">Failed: {{ failed().join(', ') }}</div> }
    </section>`,
})
export class RssWidget implements OnInit {
  private readonly ref = inject(DestroyRef);
  readonly w = input.required<W<'rss'>>();
  readonly items = signal<Item[]>([]);
  readonly failed = signal<string[]>([]);
  readonly tab = signal('');
  readonly open = signal(false);
  // header drawing picked from what the widget shows
  readonly art = computed(() => {
    const w = this.w(), u = w.feeds[0]?.url ?? '';
    return u.startsWith('/reddit/') ? 'reddit' : u.includes('youtube.com') ? 'video' : /cve/i.test(w.title) ? 'cve' : 'news';
  });
  // feeds sharing a `tab` are merged into one tab, in config order
  readonly tabs = computed(() => {
    const seen = new Map<string, { reddit: boolean; icon: string; url: string }>();
    for (const f of this.w().feeds) {
      const reddit = f.url.startsWith('/reddit/');
      if (!seen.has(f.tab ?? f.name)) seen.set(f.tab ?? f.name, { reddit, icon: f.icon ?? '', url: f.url });
    }
    return [...seen].map(([name, t]) => ({ name, ...t }));
  });
  readonly FOLD = FOLD;
  readonly hue = hue;
  readonly ICONS = ICONS;
  readonly ago = ago;
  private readonly list = computed(() => {
    const w = this.w();
    const all = w.mode === 'tabs' ? this.items().filter(i => i.tab === this.tab()) : this.items();
    return all.slice(0, w.limit ?? 15);
  });
  readonly shown = computed(() => (this.open() ? this.list() : this.list().slice(0, FOLD)));
  readonly total = computed(() => this.list().length);

  ngOnInit() {
    this.tab.set(this.tabs()[0]?.name ?? '');
    poll(this.ref, 15 * 60_000, () => this.load());
  }

  // clicking the already selected reddit tab opens the subreddit (/reddit/r/x → reddit.com/r/x)
  pick(t: { name: string; reddit: boolean; url: string }) {
    if (t.reddit && t.name === this.tab()) window.open('https://www.reddit.com' + t.url.slice('/reddit'.length), '_blank', 'noopener');
    else this.tab.set(t.name);
  }

  private async load() {
    const w = this.w(), feeds = w.feeds;
    const res = await Promise.allSettled(
      feeds.map(async f => {
        const items = await cached<FeedItem[]>('feed4:' + f.url, HALF_HOUR, async () => {
          const r = await fetch(f.url);
          if (!r.ok) throw new Error(String(r.status));
          return f.kind === 'json' ? r.json() : f.kind === 'jellyfin' ? parseJellyfin(await r.json(), f.web ?? '') : parseFeed(await r.text());
        });
        return items.map(i => ({ ...i, feed: f.name, tab: w.mode === 'tabs' ? (f.tab ?? f.name) : '' }));
      }),
    );
    this.items.set(res.flatMap(r => (r.status === 'fulfilled' ? r.value : [])).sort((a, b) => b.date - a.date));
    this.failed.set(feeds.filter((_, i) => res[i].status === 'rejected').map(f => f.name));
  }
}
