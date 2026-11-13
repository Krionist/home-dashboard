import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { TodoItem } from '../calendar';
import { W } from '../config';
import { HaService } from '../ha.service';

interface Item extends TodoItem { uid: string }
interface TodoResp { response: Record<string, { items: Item[] }> }
export interface Due { uid: string; list: string; summary: string; due: string; days: number } // days: <0 late, 0 today

const DAY_MS = 86_400_000;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// open items late or due within `days`, soonest first
export function dueSoon(lists: Record<string, Item[]>, days: number, now = new Date()): Due[] {
  const today = midnight(now);
  return Object.entries(lists).flatMap(([list, items]) => items.flatMap(t => {
    if (!t.due || t.status === 'completed') return [];
    const at = t.due.length === 10 ? new Date(`${t.due}T00:00`) : new Date(t.due);
    const d = Math.round((midnight(at) - today) / DAY_MS);
    return d <= days ? [{ uid: t.uid, list, summary: t.summary, due: t.due, days: d }] : [];
  })).sort((a, b) => a.days - b.days || a.due.localeCompare(b.due));
}

const WD = new Intl.DateTimeFormat('hu-HU', { weekday: 'long' });
export function dueLabel(d: Due): string {
  if (d.days < 0) return d.days === -1 ? 'tegnap óta' : `${-d.days} napja lejárt`;
  const time = d.due.length > 10 ? ' ' + new Date(d.due).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : '';
  if (d.days === 0) return 'ma' + time;
  if (d.days === 1) return 'holnap' + time;
  return WD.format(new Date(d.due.length === 10 ? `${d.due}T00:00` : d.due)) + time;
}

// Vikunja (or any HA todo) items that are late or coming up; tap the box to mark one done
@Component({
  selector: 'app-todo-due',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      @for (d of items(); track d.uid) {
        <div class="row due" [class.late]="d.days < 0" [class.today]="d.days === 0">
          <button class="chk" (click)="done(d)" aria-label="Kész"></button>
          <span class="due-sum">{{ d.summary }}</span>
          <small class="val">{{ label(d) }}</small>
        </div>
      } @empty { <div class="muted">Nincs közelgő határidő 🎉</div> }
    </section>`,
})
export class TodoDueWidget {
  readonly w = input.required<W<'todo-due'>>();
  private readonly ha = inject(HaService);
  readonly items = signal<Due[]>([]);
  readonly label = dueLabel;

  constructor() {
    effect(() => { if (this.ha.connected()) untracked(() => this.load()); });
    const id = setInterval(() => this.ha.connected() && this.load(), 10 * 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  async done(d: Due) {
    this.items.update(xs => xs.filter(x => x.uid !== d.uid));
    await this.ha.call('todo', 'update_item', { entity_id: d.list, item: d.uid, status: 'completed' }).catch(() => this.load());
  }

  private async load() {
    try {
      const t = await this.ha.ws<TodoResp>({
        type: 'call_service', domain: 'todo', service: 'get_items',
        target: { entity_id: this.w().entities }, service_data: { status: 'needs_action' }, return_response: true,
      });
      this.items.set(dueSoon(Object.fromEntries(Object.entries(t.response).map(([k, v]) => [k, v.items])), this.w().days ?? 7).slice(0, this.w().limit ?? 8));
    } catch { /* ponytail: keep the last list on a failed fetch */ }
  }
}
