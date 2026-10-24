import { Component, computed, inject, input, signal } from '@angular/core';
import { W } from '../config';
import { HaService } from '../ha.service';
import { LinkIcon, hue } from './link-icon';

interface Link { name: string; url: string; collection: string; created?: string }
interface Coll { name: string; count: number }

const RECENT = 'Legutóbbi';
const FOLD = 8; // links shown before "Még N"

// "https://www.github.com/x" → "github" (dashboard-icons slug; unknown ones fall back to a monogram)
export const site = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, '').split('.').slice(-2, -1)[0] ?? ''; } catch { return ''; }
};

// first tab: newest links across everything; then a tab per collection (biggest first), from one HA sensor's attributes
export function tabsOf(links: Link[], colls: Coll[], recent: number) {
  return [{ name: RECENT, links: links.slice(0, recent) },
    ...colls.map(c => ({ name: c.name, links: links.filter(l => l.collection === c.name) })).filter(t => t.links.length)];
}

@Component({
  selector: 'app-linkwarden',
  imports: [LinkIcon],
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      <div class="lw-count muted">{{ links().length }} link · {{ colls().length }} kollekció</div>
      <div class="tabbar">
        <button class="arrow" (click)="bar.scrollBy({ left: -140, behavior: 'smooth' })" aria-label="Balra">‹</button>
        <div #bar class="subtabs" role="tablist">
          @for (t of tabs(); track t.name) {
            <button role="tab" [attr.aria-selected]="t.name === cur().name" [class.on]="t.name === cur().name" (click)="pick(t.name, $event)"
              [title]="t.name" [style.--h]="hue(t.name)">
              <i>{{ t.name === RECENT ? '★' : t.name.charAt(0).toUpperCase() }}</i><span>{{ t.name }} <small>{{ t.links.length }}</small></span>
            </button>
          }
        </div>
        <button class="arrow" (click)="bar.scrollBy({ left: 140, behavior: 'smooth' })" aria-label="Jobbra">›</button>
      </div>
      @for (l of shown(); track l.url) {
        <div class="row"><a class="ilink" [href]="l.url" target="_blank" rel="noopener" [title]="l.name"><app-link-icon [title]="site(l.url)" [icon]="site(l.url)" />{{ l.name }}</a></div>
      } @empty { <div class="err">unavailable</div> }
      @if (cur().links.length > FOLD) {
        <button class="more" (click)="open.set(!open())" [attr.aria-expanded]="open()">
          {{ open() ? 'Kevesebb' : 'Még ' + (cur().links.length - FOLD) }} <span [class.flip]="open()">▾</span>
        </button>
      }
    </section>`,
})
export class LinkwardenWidget {
  readonly ha = inject(HaService);
  readonly w = input.required<W<'linkwarden'>>();
  readonly tab = signal(RECENT);
  readonly open = signal(false);
  readonly RECENT = RECENT;
  readonly FOLD = FOLD;
  readonly hue = hue;
  readonly site = site;
  private readonly attrs = computed(() => this.ha.entities()[this.w().entity]?.attributes ?? {});
  readonly links = computed(() => (this.attrs()['links'] as Link[] | undefined) ?? []);
  readonly colls = computed(() => (this.attrs()['collections'] as Coll[] | undefined) ?? []);
  readonly tabs = computed(() => tabsOf(this.links(), this.colls(), this.w().recent ?? 10));
  readonly cur = computed(() => this.tabs().find(t => t.name === this.tab()) ?? this.tabs()[0]);
  readonly shown = computed(() => (this.open() ? this.cur().links : this.cur().links.slice(0, FOLD)));

  pick(name: string, e: Event) {
    this.tab.set(name);
    this.open.set(false);
    // keep the expanding tab fully visible once it has grown
    const el = e.currentTarget as HTMLElement;
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }), 360);
  }
}
