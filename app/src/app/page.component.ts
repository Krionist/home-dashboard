import { Component, computed, inject, input, signal } from '@angular/core';
import { EditService, PageKey } from './edit.service';
import { Page } from './config';
import { BookmarksWidget } from './widgets/bookmarks';
import { CalendarWidget } from './widgets/calendar';
import { CameraWidget } from './widgets/camera';
import { ClimateWidget } from './widgets/climate';
import { ClockWeatherWidget } from './widgets/clock-weather';
import { ForecastWidget } from './widgets/forecast';
import { TempChartWidget } from './widgets/temp-chart';
import { TodoDueWidget } from './widgets/todo-due';
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
import { SparkyWidget } from './widgets/sparky';
import { UpsWidget } from './widgets/ups';
import { WaqiWidget } from './widgets/waqi';
import { HAS_ART, WidgetIcon } from './widgets/widget-icon';

@Component({
  selector: 'app-page',
  imports: [BookmarksWidget, CalendarWidget, CameraWidget, ClimateWidget, ClockWeatherWidget, DevicesWidget, ForecastWidget, HaButtonWidget, HaEntitiesWidget, IframeWidget, LinkwardenWidget,
    LonghornWidget, MonitorWidget, NetworkWidget, PiholeWidget, PowerWidget, PurifierWidget, RssWidget, SearchWidget, ServersWidget, SparkyWidget, TempChartWidget, TodoDueWidget, TorrentWidget, UpsWidget, WaqiWidget, WidgetIcon],
  template: `
    <div class="grid" [style.--cols]="cols()">
      @for (col of page().columns; track $index; let ci = $index) {
        <div class="col" [class.main]="col.size === 'full'">
          @for (w of col.widgets; track $index) {
            <!-- wrapper so the corner icon can sit over the widget's first card -->
            <div class="wbox" [class.has-ico]="!HAS_ART.includes(w.type)">
            @if (ed.on()) {
              <div class="wedit">
                <button (click)="ed.move(key(), ci, $index, -1, 0)" aria-label="Fel">↑</button>
                <button (click)="ed.move(key(), ci, $index, 1, 0)" aria-label="Le">↓</button>
                <button (click)="ed.move(key(), ci, $index, 0, -1)" aria-label="Balra">←</button>
                <button (click)="ed.move(key(), ci, $index, 0, 1)" aria-label="Jobbra">→</button>
                @if (COMPACT.includes(w.type)) {
                  <button [class.on]="w.compact" (click)="ed.toggle(key(), ci, $index, 'compact')" aria-label="Kompakt" title="Kompakt nézet">◱</button>
                }
                @if (w.type === 'clock-weather') {
                  <button [class.on]="$any(w).big" (click)="ed.toggle(key(), ci, $index, 'big')" aria-label="Nagy óra" title="Nagy óra">⛶</button>
                }
                <button class="del" (click)="ed.remove(key(), ci, $index)" aria-label="Törlés">✕</button>
              </div>
            }
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
              @case ('forecast') { <app-forecast [w]="$any(w)" /> }
              @case ('temp-chart') { <app-temp-chart [w]="$any(w)" /> }
              @case ('todo-due') { <app-todo-due [w]="$any(w)" /> }
              @case ('sparky') { <app-sparky [w]="$any(w)" /> }
              @case ('network') { <app-network [w]="$any(w)" /> }
            }
            @if (!HAS_ART.includes(w.type)) { <app-widget-icon [type]="w.type" /> }
            </div>
          }
          @if (ed.on()) {
            @if (adding() === ci) {
              <div class="card wadd">
                <select #pick>
                  <option value="">– meglévő widget –</option>
                  @for (o of ed.catalog(); track $index) { <option [value]="$index">{{ o.label }}</option> }
                </select>
                <textarea #json rows="5" placeholder='vagy új widget JSON-ja, pl. {"type": "waqi", "title": "AQI", "lat": 47.3, "lon": 21.5}'></textarea>
                @if (addErr()) { <div class="err">{{ addErr() }}</div> }
                <div class="wadd-btns">
                  <button (click)="add(ci, pick.value, json.value)">Hozzáad</button>
                  <button (click)="adding.set(null)">Mégse</button>
                </div>
              </div>
            } @else {
              <button class="wadd-open" (click)="adding.set(ci); addErr.set('')">＋ Widget</button>
            }
          }
        </div>
      }
    </div>`,
})
export class PageComponent {
  readonly page = input.required<Page>();
  readonly key = input.required<PageKey>(); // which page of the config this is, for edits
  readonly ed = inject(EditService);
  readonly adding = signal<number | null>(null);
  readonly addErr = signal('');

  add(col: number, pick: string, json: string) {
    try {
      const w = json.trim() ? this.ed.parse(json) : this.ed.catalog()[Number(pick)]?.w;
      if (!pick && !json.trim()) throw new Error('válassz widgetet vagy írj JSON-t');
      this.ed.add(this.key(), col, w!);
      this.adding.set(null);
    } catch (e) {
      this.addErr.set(e instanceof Error ? e.message : String(e));
    }
  }
  readonly HAS_ART = HAS_ART;
  readonly COMPACT = ['clock-weather', 'waqi', 'forecast', 'temp-chart', 'calendar']; // widgets with a compact variant
  readonly cols = computed(() => this.page().columns.map(c => (c.size === 'small' ? '300px' : 'minmax(0,1fr)')).join(' '));
}
