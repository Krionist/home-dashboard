import { Component, input } from '@angular/core';
import { W } from '../config';
import { LinkIcon } from './link-icon';

// one card, every group listed under its own small heading
@Component({
  selector: 'app-bookmarks',
  imports: [LinkIcon],
  template: `
    <section class="card">
      <h2>{{ w().title ?? 'Könyvjelzők' }}</h2>
      @for (g of w().groups; track g.title) {
        <h3 class="bm-group">{{ g.title }}</h3>
        <ul class="links">
          @for (l of g.links; track l.url) {
            <li><a class="ilink" [href]="l.url" target="_blank" rel="noopener"><app-link-icon [title]="l.title" [icon]="l.icon" />{{ l.title }}</a></li>
          }
        </ul>
      }
    </section>`,
})
export class BookmarksWidget {
  readonly w = input.required<W<'bookmarks'>>();
}
