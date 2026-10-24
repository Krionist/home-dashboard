import { Component, input } from '@angular/core';

// widgets that already draw their own header art (or are an icon themselves) get none
export const HAS_ART = ['rss', 'camera', 'calendar', 'search', 'clock-weather', 'ha-button'];

// small animated line icon in a card's top-right corner, one per widget type
@Component({
  selector: 'app-widget-icon',
  host: { class: 'wicon', '[class]': "'wicon i-' + type()", 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 32 32">
      @switch (type()) {
        @case ('bookmarks') { <path class="ribbon" d="M10 5h12v22l-6-5-6 5z" /><path class="shine" d="M13 9h6" /> }
        @case ('monitor') { <rect x="4" y="6" width="24" height="17" rx="3" /><path class="beat" d="M6 15h5l2-5 3 9 2-6 2 2h6" /><path d="M12 27h8" /> }
        @case ('iframe') { <rect x="4" y="6" width="24" height="20" rx="3" /><path d="M4 11h24" /><circle class="dot" cx="8" cy="8.5" r=".8" /><circle class="dot" cx="11" cy="8.5" r=".8" /><path class="code" d="M13 16l-3 3 3 3M19 16l3 3-3 3" /> }
        @case ('ha-entities') { <path d="M8 6v20M16 6v20M24 6v20" /><circle class="k k1" cx="8" cy="12" r="2.6" /><circle class="k k2" cx="16" cy="20" r="2.6" /><circle class="k k3" cx="24" cy="14" r="2.6" /> }
        @case ('longhorn') { <ellipse cx="16" cy="8" rx="9" ry="3" /><path d="M7 8v16c0 1.7 4 3 9 3s9-1.3 9-3V8" /><path class="ring" d="M7 16c0 1.7 4 3 9 3s9-1.3 9-3" /> }
        @case ('linkwarden') { <path class="l1" d="M14 18a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-1.5 1.5" /><path class="l2" d="M18 14a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l1.5-1.5" /> }
        @case ('waqi') { <path class="leaf" d="M8 24C8 13 15 7 26 6c0 11-6 18-18 18z" /><path d="M8 24l10-10" /><path class="wind" d="M3 12h7M4 16h4" /> }
        @case ('climate') { <path d="M13 6a3 3 0 0 1 6 0v12a6 6 0 1 1-6 0z" /><path class="merc" d="M16 22V12" /><circle class="bulb" cx="16" cy="22.5" r="2.6" /><path d="M23 9h3M23 13h3" /> }
        @case ('servers') { <rect x="6" y="5" width="20" height="9" rx="2" /><rect x="6" y="18" width="20" height="9" rx="2" /><circle class="led" cx="21" cy="9.5" r="1.2" /><circle class="led l2" cx="21" cy="22.5" r="1.2" /><path d="M10 9.5h6M10 22.5h6" /> }
        @case ('pihole') { <path d="M5 7h22l-8 10v8l-6 2V17z" /><circle class="drop" cx="16" cy="3" r="1.2" /> }
        @case ('torrent') { <path class="arrow" d="M16 5v15M10 14l6 6 6-6" /><path d="M7 26h18" /> }
        @case ('purifier') { <rect x="8" y="4" width="16" height="24" rx="6" /><g class="fan"><circle cx="16" cy="14" r="5" /><path d="M16 14v-5M16 14l4.3 2.5M16 14l-4.3 2.5" /></g><path d="M12 24h8" /> }
        @case ('ups') { <rect x="5" y="9" width="20" height="14" rx="2.5" /><path d="M25 13.5h2v5h-2" /><path class="bolt" d="M16 11l-4 6h4l-2 5 6-7h-4l2-4z" /> }
        @case ('power') { <path d="M11 4v6M21 4v6" /><path d="M8 10h16v5a8 8 0 0 1-16 0z" /><path class="cord" d="M16 23v5" /> }
        @case ('devices') { <rect x="9" y="3" width="14" height="26" rx="3" /><path d="M14 6h4" /><rect class="lvl" x="12" y="10" width="8" height="15" rx="1" /> }
        @case ('network') { <circle class="n n0" cx="16" cy="6" r="3" /><circle class="n n1" cx="7" cy="25" r="3" /><circle class="n n2" cx="25" cy="25" r="3" /><path d="M14.5 8.5l-6 14M17.5 8.5l6 14M10 25h12" /> }
        @default { <circle cx="16" cy="16" r="10" /><path d="M16 11v5l3 3" /> }
      }
    </svg>`,
})
export class WidgetIcon {
  readonly type = input.required<string>();
}
