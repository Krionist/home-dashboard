import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { TodoItem, overdue } from './calendar';
import { Config } from './config';
import { HaService } from './ha.service';

interface TodoResp { response: Record<string, { items: TodoItem[] }> }
interface Hit { summary: string; url?: string }

// floating red banner for todo items (Vikunja) that are due today or already late; the X hides it until reload
@Component({
  selector: 'app-overdue',
  template: `
    @if (hits().length && !hidden()) {
      <div class="overdue" role="alert">
        <ul>
          @for (h of hits(); track $index) {
            <li>@if (h.url) { <a [href]="h.url" target="_blank" rel="noopener">{{ h.summary }}</a> } @else { {{ h.summary }} }</li>
          }
        </ul>
        <button (click)="hidden.set(true)" aria-label="Bezár">✕</button>
      </div>
    }`,
})
export class OverdueBanner {
  private readonly ha = inject(HaService);
  readonly config = input.required<Config>();
  readonly hits = signal<Hit[]>([]);
  readonly hidden = signal(false);

  constructor() {
    effect(() => {
      if (this.ha.connected()) untracked(() => this.load());
    });
    const id = setInterval(() => this.ha.connected() && this.load(), 30 * 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  private async load() {
    const sources = this.config().pages.flatMap(p => p.columns.flatMap(c => c.widgets.flatMap(w =>
      w.type === 'calendar' ? w.entities.flatMap(e => ('ids' in e ? [e] : [])) : [])));
    const res = await Promise.allSettled(sources.map(async s => {
      const t = await this.ha.ws<TodoResp>({
        type: 'call_service', domain: 'todo', service: 'get_items',
        target: { entity_id: s.ids }, service_data: { status: 'needs_action' }, return_response: true,
      });
      return overdue(Object.values(t.response).flatMap(l => l.items)).map(i => ({ summary: i.summary, url: s.url }));
    }));
    this.hits.set(res.flatMap(r => (r.status === 'fulfilled' ? r.value : [])));
  }
}
