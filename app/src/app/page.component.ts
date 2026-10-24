import { Component, computed, input } from '@angular/core';
import { Page } from './config';
import { BookmarksWidget } from './widgets/bookmarks';
import { CalendarWidget } from './widgets/calendar';
import { CameraWidget } from './widgets/camera';
import { ClimateWidget } from './widgets/climate';
import { ClockWeatherWidget } from './widgets/clock-weather';
import { DevicesWidget } from './widgets/devices';
import { HaButtonWidget } from './widgets/ha-button';
import { HaEntitiesWidget } from './widgets/ha-entities';
import { IframeWidget } from './widgets/iframe';
import { LinkwardenWidget } from './widgets/linkwarden';
import { LonghornWidget } from './widgets/longhorn';
import { MonitorWidget } from './widgets/monitor';
import { NetworkWidget } from './widgets/network';
import { PiholeWidget } from './widgets/pihole';
import { PowerWidget } from './widgets/power';
import { PurifierWidget } from './widgets/purifier';
import { RssWidget } from './widgets/rss';
import { SearchWidget } from './widgets/search';
import { TorrentWidget } from './widgets/torrent';
import { ServersWidget } from './widgets/servers';
import { UpsWidget } from './widgets/ups';
import { WaqiWidget } from './widgets/waqi';

@Component({
  selector: 'app-page',
  imports: [BookmarksWidget, CalendarWidget, CameraWidget, ClimateWidget, ClockWeatherWidget, DevicesWidget, HaButtonWidget, HaEntitiesWidget, IframeWidget, LinkwardenWidget,
    LonghornWidget, MonitorWidget, NetworkWidget, PiholeWidget, PowerWidget, PurifierWidget, RssWidget, SearchWidget, ServersWidget, TorrentWidget, UpsWidget, WaqiWidget],
  template: `
    <div class="grid" [style.--cols]="cols()">
      @for (col of page().columns; track $index) {
        <div class="col" [class.main]="col.size === 'full'">
          @for (w of col.widgets; track $index) {
            @switch (w.type) {
              @case ('clock-weather') { <app-clock-weather [w]="$any(w)" /> }
              @case ('search') { <app-search [w]="$any(w)" /> }
              @case ('bookmarks') { <app-bookmarks [w]="$any(w)" /> }
              @case ('monitor') { <app-monitor [w]="$any(w)" /> }
              @case ('iframe') { <app-iframe [w]="$any(w)" /> }
              @case ('rss') { <app-rss [w]="$any(w)" /> }
              @case ('ha-entities') { <app-ha-entities [w]="$any(w)" /> }
              @case ('calendar') { <app-calendar [w]="$any(w)" /> }
              @case ('longhorn') { <app-longhorn [w]="$any(w)" /> }
              @case ('linkwarden') { <app-linkwarden [w]="$any(w)" /> }
              @case ('waqi') { <app-waqi [w]="$any(w)" /> }
              @case ('camera') { <app-camera [w]="$any(w)" /> }
              @case ('climate') { <app-climate [w]="$any(w)" /> }
              @case ('servers') { <app-servers [w]="$any(w)" /> }
              @case ('pihole') { <app-pihole [w]="$any(w)" /> }
              @case ('torrent') { <app-torrent [w]="$any(w)" /> }
              @case ('purifier') { <app-purifier [w]="$any(w)" /> }
              @case ('ups') { <app-ups [w]="$any(w)" /> }
              @case ('power') { <app-power [w]="$any(w)" /> }
              @case ('ha-button') { <app-ha-button [w]="$any(w)" /> }
              @case ('devices') { <app-devices [w]="$any(w)" /> }
              @case ('network') { <app-network [w]="$any(w)" /> }
            }
          }
        </div>
      }
    </div>`,
})
export class PageComponent {
  readonly page = input.required<Page>();
  readonly cols = computed(() => this.page().columns.map(c => (c.size === 'small' ? '300px' : 'minmax(0,1fr)')).join(' '));
}
