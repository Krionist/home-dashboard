import { Component, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { W } from '../config';
import { poll } from '../poll';

export interface Stats { eaten: number; goal: number; burned?: number; steps?: number }
export interface FoodEntry { food_name: string; brand_name?: string; meal_type?: string; quantity: number; unit?: string; serving_size: number; calories: number }
export interface Meal { name: string; kcal: number; items: { name: string; amount: string; kcal: number }[] }

// entry calories are per serving_size, so scale by the eaten quantity; entries come ordered by meal
export function toMeals(entries: FoodEntry[]): Meal[] {
  const meals = new Map<string, Meal>();
  for (const e of entries) {
    const kcal = Math.round(e.serving_size > 0 ? (e.calories * e.quantity) / e.serving_size : e.calories);
    const name = e.meal_type ?? '—';
    const m = meals.get(name) ?? { name, kcal: 0, items: [] };
    m.kcal += kcal;
    m.items.push({ name: e.food_name + (e.brand_name ? ` (${e.brand_name})` : ''), amount: `${Math.round(e.quantity * 10) / 10} ${e.unit ?? ''}`.trim(), kcal });
    meals.set(name, m);
  }
  return [...meals.values()];
}

// over the goal → red, within 100 kcal under it → green, otherwise blue; the figure fills from the feet up
export function calorieView({ eaten, goal }: Stats) {
  const left = goal - eaten;
  const fill = goal > 0 ? Math.min(1, Math.max(0, eaten / goal)) : 0;
  return { fill, left, tone: left < 0 ? 'bad' : left <= 100 ? 'ok' : 'cold' };
}

// SparkyFitness /dashboard/stats (nginx adds the x-api-key)
@Component({
  selector: 'app-sparky',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      @if (stats(); as s) {
        @let v = view(s);
        <div [class]="'sparky ' + v.tone">
          <button class="human-btn" (click)="open()" aria-label="Felvitt tételek"><svg viewBox="0 0 60 120" class="human" aria-hidden="true">
            <clipPath id="human-clip">
              <circle cx="30" cy="12" r="10" /><rect x="12" y="26" width="36" height="44" rx="12" />
              <rect x="17" y="64" width="12" height="52" rx="6" /><rect x="31" y="64" width="12" height="52" rx="6" />
            </clipPath>
            <rect class="level" x="0" width="60" height="120" [attr.y]="120 * (1 - v.fill)" clip-path="url(#human-clip)" />
            <g class="outline">
              <circle cx="30" cy="12" r="10" /><rect x="12" y="26" width="36" height="44" rx="12" />
              <rect x="17" y="64" width="12" height="52" rx="6" /><rect x="31" y="64" width="12" height="52" rx="6" />
            </g>
          </svg></button>
          <div>
            <b>{{ s.eaten.toLocaleString('hu-HU') }}<small> / {{ s.goal.toLocaleString('hu-HU') }} kcal</small></b>
            <small class="muted">{{ v.left >= 0 ? v.left.toLocaleString('hu-HU') + ' kcal maradt' : -v.left + ' kcal túl' }}</small>
            @if (s.steps) { <small class="muted">👣 {{ s.steps.toLocaleString('hu-HU') }} lépés</small> }
            @if (s.burned) { <small class="muted">{{ s.burned.toLocaleString('hu-HU') }} kcal égetve</small> }
          </div>
        </div>
      } @else { <p class="muted">Nincs adat</p> }
      <dialog #dlg class="sparky-dlg" (click)="$event.target === dlg && dlg.close()">
        <header><h3>Mai tételek</h3><button (click)="dlg.close()" aria-label="Bezár">✕</button></header>
        @for (m of meals(); track m.name) {
          <h4>{{ m.name }} <small class="muted">{{ m.kcal.toLocaleString('hu-HU') }} kcal</small></h4>
          <ul>@for (i of m.items; track $index) { <li><span>{{ i.name }} <small class="muted">{{ i.amount }}</small></span><b>{{ i.kcal }}</b></li> }</ul>
        } @empty { <p class="muted">Nincs felvitt tétel</p> }
      </dialog>
    </section>`,
})
export class SparkyWidget {
  readonly w = input.required<W<'sparky'>>();
  readonly stats = signal<Stats | null>(null);
  readonly meals = signal<Meal[]>([]);
  readonly view = calorieView;
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    // ponytail: a failed fetch keeps the last numbers
    poll(inject(DestroyRef), 5 * 60_000, () =>
      fetch('/sparky/api/dashboard/stats').then(r => (r.ok ? r.json() : Promise.reject())).then(s => this.stats.set(s)).catch(() => {}));
  }

  async open() {
    this.dlg().nativeElement.showModal();
    const d = new Date(), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    try {
      const r = await fetch(`/sparky/api/food-entries/by-date/${day}`);
      if (r.ok) this.meals.set(toMeals(await r.json()));
    } catch { /* ponytail: keep the previous list */ }
  }
}
