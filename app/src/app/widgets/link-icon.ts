import { Component, computed, input, signal } from '@angular/core';

const CDN = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/';

/** "NAS (Synology)" -> "nas"; overridable per link with `icon` in config.json */
export function iconSlug(title: string): string {
  return title.toLowerCase().replace(/\(.*?\)/g, '').trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** stable 0..359 hue from a name, for monograms */
export const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

// brand SVG from dashboard-icons; when it doesn't exist, a monogram SVG with a colour hashed from the title
@Component({
  selector: 'app-link-icon',
  template: `
    @if (!failed()) {
      <img class="licon" [src]="src()" alt="" loading="lazy" (error)="failed.set(true)" />
    } @else {
      <svg class="licon" viewBox="0 0 20 20" aria-hidden="true">
        <rect width="20" height="20" rx="5" [attr.fill]="'hsl(' + hue() + ' 45% 22%)'" [attr.stroke]="'hsl(' + hue() + ' 60% 55%)'" stroke-width="1" />
        <text x="10" y="14" text-anchor="middle" [attr.fill]="'hsl(' + hue() + ' 80% 75%)'">{{ title().charAt(0).toUpperCase() }}</text>
      </svg>
    }`,
})
export class LinkIcon {
  readonly title = input.required<string>();
  readonly icon = input<string>();
  readonly failed = signal(false);
  readonly src = computed(() => CDN + (this.icon() ?? iconSlug(this.title())) + '.svg');
  readonly hue = computed(() => hue(this.title()));
}
