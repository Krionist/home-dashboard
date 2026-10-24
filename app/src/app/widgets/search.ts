import { Component, input } from '@angular/core';
import { W } from '../config';
import { resolveSearch } from '../search';

@Component({
  selector: 'app-search',
  template: `
    <form class="card" (submit)="go($event, q.value)">
      <input #q class="search" placeholder="Search (!yt, !g, !gh ...)" autofocus />
    </form>`,
})
export class SearchWidget {
  readonly w = input.required<W<'search'>>();
  go(e: Event, q: string) {
    e.preventDefault();
    if (q.trim()) window.open(resolveSearch(q, this.w().bangs), '_blank', 'noopener');
  }
}
