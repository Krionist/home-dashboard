import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { W } from '../config';
import { poll } from '../poll';
import { K8sView, loadK8s } from '../k8s';

const lvl = (p: number) => (p > 85 ? 'bad' : p > 65 ? 'warn' : 'ok');

// one helm wheel per node, turning faster with CPU load; pod totals below, unhealthy pods listed by name
@Component({
  selector: 'app-k8s',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      @if (v(); as v) {
        @for (n of v.nodes; track n.name) {
          <div class="k8-node" [class.down]="!n.ready">
            <svg viewBox="0 0 32 32" class="helm" aria-hidden="true" [style.animation-duration.s]="n.ready ? 24 - n.cpu / 5 : 0">
              <circle cx="16" cy="16" r="9" /><circle cx="16" cy="16" r="3" />
              @for (k of [0, 1, 2, 3, 4, 5, 6]; track k) { <path d="M16 13V3" [attr.transform]="'rotate(' + k * 51.43 + ' 16 16)'" /> }
            </svg>
            <span><b>{{ n.name }}</b><small class="muted">{{ n.ready ? n.pods + ' pod' : 'NotReady' }}</small></span>
            @for (m of [['CPU', n.cpu], ['RAM', n.mem]]; track m[0]) {
              <span class="k8-m"><small class="muted">{{ m[0] }}</small><span [class]="'meter ' + lvl(+m[1])"><b [style.width.%]="m[1]"></b></span><small class="val">{{ m[1] }}%</small></span>
            }
          </div>
        }
        <div class="lh-chips k8-sum">
          <span class="chip ok"><i></i>{{ v.running }} fut</span>
          <span class="chip idle"><i></i>{{ v.done }} kész</span>
          <span [class]="'chip ' + (v.bad.length ? 'bad' : 'idle')"><i></i>{{ v.bad.length }} hibás</span>
        </div>
        @for (p of v.bad; track p.name) {
          <div class="k8-bad"><span>{{ p.name }}</span><small class="err">{{ p.status }}@if (p.restarts !== '0') { · ↻{{ p.restarts }} }</small></div>
        }
      } @else if (error()) { <div class="err">unavailable: {{ error() }}</div> }
      @else { <p class="muted">Betöltés…</p> }
    </section>`,
})
export class K8sWidget {
  readonly w = input.required<W<'k8s'>>();
  readonly v = signal<K8sView | null>(null);
  readonly error = signal('');
  readonly lvl = lvl;

  constructor() {
    poll(inject(DestroyRef), 60_000, () =>
      loadK8s().then(v => { this.v.set(v); this.error.set(''); }).catch(e => this.error.set(String(e?.message ?? e))));
  }
}
