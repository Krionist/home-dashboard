import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { W } from '../config';
import { poll } from '../poll';
import { Car, loadCars } from '../lubelogger';

// each car (sold ones hidden): odometer, then its reminders most urgent first
@Component({
  selector: 'app-lubelogger',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      @for (c of cars(); track c.id) {
        <div class="ll-car"><b>{{ c.name }}</b><span class="val">{{ c.km.toLocaleString('hu-HU') }} km</span></div>
        @for (r of c.reminders.slice(0, w().limit ?? 4); track $index) {
          <div class="ll-rem"><span [class]="'chip ' + r.lvl"><i></i>{{ r.text }}</span><small [class]="r.lvl === 'ok' ? 'muted' : 'err'">{{ r.due }}</small></div>
        } @empty { <p class="muted">Nincs esedékes teendő</p> }
        @if (c.reminders.length > (w().limit ?? 4)) { <small class="muted">+{{ c.reminders.length - (w().limit ?? 4) }} további</small> }
      } @empty {
        @if (error()) { <div class="err">unavailable: {{ error() }}</div> } @else { <p class="muted">Betöltés…</p> }
      }
    </section>`,
})
export class LubeloggerWidget {
  readonly w = input.required<W<'lubelogger'>>();
  readonly cars = signal<Car[]>([]);
  readonly error = signal('');

  constructor() {
    // ponytail: a failed fetch keeps the last list
    poll(inject(DestroyRef), 30 * 60_000, () =>
      loadCars().then(c => { this.cars.set(c); this.error.set(''); }).catch(e => this.error.set(String(e?.message ?? e))));
  }
}
