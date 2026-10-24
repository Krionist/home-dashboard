import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { W } from '../config';
import { poll } from '../poll';
import { LhNode, summarizeNodes, summarizeVolumes } from '../longhorn';

const ROBUST: Record<string, string | undefined> = { healthy: 'ok', degraded: 'warn', faulted: 'bad' };

// one spinning hard disk per node (usage arc around the platter), volume summary below
@Component({
  selector: 'app-longhorn',
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      @if (s(); as s) {
        <div class="lh-nodes">
          @for (n of nodes(); track n.name; let i = $index) {
            <figure [class]="'lh-node ' + (n.pct > 85 ? 'bad' : n.pct > 65 ? 'warn' : 'ok')" [class.down]="!n.ready">
              <svg viewBox="0 0 80 84">
                <rect class="case" x="2" y="2" width="76" height="80" rx="7" />
                @for (p of [[8, 8], [72, 8], [8, 76], [72, 76]]; track $index) { <circle class="screw" [attr.cx]="p[0]" [attr.cy]="p[1]" r="1.6" /> }
                <circle class="track" cx="40" cy="38" r="31" pathLength="100" />
                <circle class="used" cx="40" cy="38" r="31" pathLength="100" [style.stroke-dasharray]="n.pct + ' 100'" />
                <g class="platter" [style.animation-delay.s]="-i * 0.7">
                  <circle cx="40" cy="38" r="26" /><circle class="groove" cx="40" cy="38" r="19" /><circle class="groove" cx="40" cy="38" r="12" />
                  <path class="glint" d="M40 12a26 26 0 0 1 22 12L40 38z" />
                </g>
                <circle class="spindle" cx="40" cy="38" r="4" />
                <g class="arm" [style.animation-delay.s]="i * 0.9"><line x1="66" y1="70" x2="48" y2="44" /><circle cx="66" cy="70" r="4" /></g>
                <circle class="led" cx="11" cy="72" r="2.2" />
                <text class="pct" x="40" y="41">{{ n.pct }}%</text>
              </svg>
              <figcaption><b>{{ n.name }}</b><small class="muted">{{ n.usedGib }} / {{ n.maxGib }} GiB</small></figcaption>
            </figure>
          }
        </div>
        <div class="lh-vols">
          <span><b class="val">{{ s.count }}</b> kötet · <b class="val">{{ s.gib }}</b> GiB</span>
          <span class="lh-chips">
            @for (k of keys(s.by); track k) { <span [class]="'chip ' + (ROBUST[k] ?? 'idle')"><i></i>{{ s.by[k] }} {{ k }}</span> }
          </span>
        </div>
      } @else if (error()) { <div class="err">unavailable: {{ error() }}</div> }
      @else { <div class="lh-nodes">@for (k of [0, 1, 2]; track k) { <div class="skel-disk"></div> }</div> }
    </section>`,
})
export class LonghornWidget implements OnInit {
  private readonly ref = inject(DestroyRef);
  readonly w = input.required<W<'longhorn'>>();
  readonly s = signal<ReturnType<typeof summarizeVolumes> | null>(null);
  readonly nodes = signal<ReturnType<typeof summarizeNodes>>([]);
  readonly keys = Object.keys;
  readonly ROBUST = ROBUST;
  readonly error = signal('');

  ngOnInit() {
    poll(this.ref, 60_000, async () => {
      try {
        // the Longhorn (Rancher-style) API answers browsers with an HTML API explorer unless JSON is asked for
        const get = async (path: string) => {
          const r = await fetch('/longhorn/v1/' + path, { headers: { Accept: 'application/json' } });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return (await r.json()).data;
        };
        const [vols, nodes] = await Promise.all([get('volumes'), get('nodes')]);
        this.s.set(summarizeVolumes(vols));
        this.nodes.set(summarizeNodes(nodes as LhNode[]));
        this.error.set('');
      } catch (e) {
        this.s.set(null);
        this.error.set(String(e));
      }
    });
  }
}
