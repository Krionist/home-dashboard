import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { W } from '../config';
import { HaService } from '../ha.service';
import { isUp } from '../monitor';
import { poll } from '../poll';
import { guestsOf, nodeStats, uptime } from '../proxmox';
import { upsMode } from './ups';

type Kind = 'router' | 'server' | 'nas' | 'ups' | 'nvr' | 'camera' | 'ha';
type Status = 'up' | 'down' | 'unknown';

const DOWN = ['unavailable', 'unknown', 'off', 'offline', 'error', 'disconnected', 'not_home'];
export const entityStatus = (state: string | undefined): Status => (state === undefined ? 'unknown' : DOWN.includes(state.toLowerCase()) ? 'down' : 'up');

// Talos / k8s VMs get the helm-wheel icon in the guest list
export const isK8s = (name: string) => /kube|k8s|talos/i.test(name);

// three tiers: routers on top, core boxes in the middle, cameras hang off the NVR at the bottom
const TIER: Record<Kind, number> = { router: 0, server: 1, nas: 1, ups: 1, nvr: 1, ha: 1, camera: 2 };
const VW = 640, Y = [34, 108, 204];
export function layout(kinds: Kind[]): { x: number; y: number }[] {
  const per = [0, 1, 2].map(t => kinds.filter(k => TIER[k] === t).length);
  const seen = [0, 0, 0];
  return kinds.map(k => {
    const t = TIER[k], i = seen[t]++, n = per[t];
    // routers close together in the middle, cameras under the right part (where the NVR is), core spread across
    const [a, b] = t === 2 ? [VW * .55, VW - 30] : t === 0 ? [VW * .35, VW * .65] : [40, VW - 40];
    return { x: Math.round(n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)), y: Y[t] };
  });
}

// one-glance home-lab map: every box coloured by its HA entity (or an HTTP check), live links pulse between them
@Component({
  selector: 'app-network',
  imports: [DecimalPipe],
  template: `
    <section class="card">
      <h2>{{ w().title }}</h2>
      <div class="net-sum muted"><b [class]="'val ' + (down() ? 'bad' : 'ok')" style="color: var(--c)">{{ up() }}/{{ nodes().length }}</b> online
        @if (down()) { · <span class="bad" style="color: var(--c)">{{ down() }} hiba</span> }</div>
      <svg class="net-map" viewBox="0 0 640 236">
        @for (l of power(); track $index) { <path [class]="'power ' + l.s" [attr.d]="l.d" /> }
        @for (l of links(); track $index) {
          <path [class]="'link ' + l.s" [attr.d]="l.d" />
        }
        @for (n of nodes(); track n.name) {
          <g [class]="'node ' + n.kind + ' ' + n.s" [class.pick]="!!n.proxmox" [class.sel]="!!n.proxmox && n.proxmox === sel()"
            [attr.transform]="'translate(' + n.x + ' ' + n.y + ')'" (click)="n.proxmox && sel.set(sel() === n.proxmox ? null : n.proxmox)">
            <title>{{ n.tip }}</title>
            <circle class="halo" r="17" />
            @switch (n.kind) {
              @case ('router') { <rect x="-11" y="-3" width="22" height="9" rx="2" /><path d="M-7 -3l-3-8M7 -3l3-8" /><circle class="led" cx="-5" cy="1.5" r="1.2" /><circle class="led" cx="0" cy="1.5" r="1.2" /> }
              @case ('server') { <rect x="-9" y="-11" width="18" height="22" rx="2" /><path d="M-9 -4h18M-9 3h18" /><circle class="led" cx="5" cy="-7.5" r="1.2" /><circle class="led" cx="5" cy="-.5" r="1.2" /><circle class="led" cx="5" cy="6.5" r="1.2" /> }
              @case ('nas') { <rect x="-10" y="-10" width="20" height="20" rx="3" /><rect x="-6" y="-6" width="5" height="12" rx="1" /><rect x="1" y="-6" width="5" height="12" rx="1" /> }
              @case ('ups') { <rect x="-9" y="-11" width="18" height="22" rx="2" /><path class="bolt" d="M1 -7l-5 8h4l-2 6 6-9h-4l1-5z" /> }
              @case ('nvr') { <rect x="-12" y="-6" width="24" height="12" rx="2" /><circle class="led rec" cx="-6" cy="0" r="2" /><path d="M0 -2h8M0 2h6" /> }
              @case ('ha') { <path d="M0 -11L11 -1h-3v10H-8V-1h-3z" /><path class="tree" d="M0 9V-3M0 4l-4-3M0 1l4-3" /> }
              @case ('camera') { <rect x="-10" y="-5" width="15" height="9" rx="3" /><path d="M5 -2l6-3v9l-6-3" /><circle class="led rec" cx="-6" cy="-1" r="1.3" /> }
            }
            <text y="27">{{ n.name }}</text>
            @if (n.pve; as p) {
              <!-- minimal load: CPU and RAM mini bars under the label -->
              <rect class="mbar" x="-22" y="32" width="44" height="3" rx="1.5" /><rect [class]="'mfill ' + lvl(p.cpu)" x="-22" y="32" [attr.width]="0.44 * (p.cpu ?? 0)" height="3" rx="1.5" />
              <rect class="mbar" x="-22" y="38" width="44" height="3" rx="1.5" /><rect [class]="'mfill ' + lvl(p.mem)" x="-22" y="38" [attr.width]="0.44 * (p.mem ?? 0)" height="3" rx="1.5" />
            }
          </g>
        }
      </svg>
      <div class="net-legend muted"><span><i></i>adat</span><span><i class="pw"></i>UPS táp</span></div>
      @if (detail(); as d) {
        <div class="pve">
          <div class="pve-head">
            <b>{{ d.name }}</b><span [class]="'pill ' + d.s">{{ d.s === 'up' ? 'online' : 'offline' }}</span>
            <button class="pve-x" (click)="sel.set(null)" aria-label="Bezárás">×</button>
          </div>
          <div class="pve-meta muted">PVE {{ d.st.version ?? '–' }} · fut {{ uptime(d.st.boot) }} · load {{ d.st.load ?? '–' }} · IO {{ d.st.io | number: '1.1-1' }}%
            · {{ d.st.updates ?? 0 }} frissítés@if (d.st.failed) { · <span style="color: var(--bad)">{{ d.st.failed }} hibás task</span> }</div>
          @for (b of [['CPU', d.st.cpu, ''], ['RAM', d.st.mem, d.st.memUsed !== null ? (d.st.memUsed | number: '1.1-1') + ' / ' + (d.st.memTotal | number: '1.0-0') + ' GB' : ''], ['Disk', d.st.disk, '']]; track b[0]) {
            <div class="pve-bar"><span>{{ b[0] }}</span><i><b [class]="lvl($any(b[1]))" [style.width.%]="b[1] ?? 0"></b></i><em>{{ b[1] === null ? '–' : ($any(b[1]) | number: '1.0-0') + '%' }}</em><small class="muted">{{ b[2] }}</small></div>
          }
          <div class="pve-guests">
            @for (g of d.guests; track g.id) {
              <div class="guest" [class.off]="!g.running">
                @if (isK8s(g.name)) {
                  <!-- Kubernetes node: helm wheel instead of the VM/CT badge -->
                  <svg class="gt k8s" viewBox="0 0 24 24" [attr.aria-label]="'Kubernetes ' + g.type"><title>Kubernetes ({{ g.type }})</title>
                    <path class="hept" d="M12 1.6l8.1 3.9 2 8.8-5.6 7H7.5l-5.6-7 2-8.8z" />
                    <circle cx="12" cy="12" r="4.2" /><circle cx="12" cy="12" r="1.3" class="hub" />
                    @for (k of [0, 1, 2, 3, 4, 5, 6]; track k) { <path d="M12 7.8V4.6" [attr.transform]="'rotate(' + k * 51.43 + ' 12 12)'" /> }
                  </svg>
                } @else { <span class="gt">{{ g.type }}</span> }
                <i class="flag" [class.on]="g.running"></i>
                <span class="gn" [title]="g.name + ' (' + g.vmid + ')'">{{ g.name }} <small class="muted">{{ g.vmid }}</small></span>
                @if (g.running) {
                  <span class="gm"><i><b [class]="lvl(g.cpu)" [style.width.%]="g.cpu ?? 0"></b></i>{{ g.cpu | number: '1.0-0' }}%</span>
                  <span class="gm"><i><b [class]="lvl(g.mem)" [style.width.%]="g.mem ?? 0"></b></i>{{ g.memGb !== null ? (g.memGb | number: '1.1-1') + ' GB' : (g.mem | number: '1.0-0') + '%' }}</span>
                  <small class="muted gip">{{ g.ip ?? '' }}</small>
                } @else { <small class="muted">leállítva</small> }
              </div>
            } @empty { <small class="muted">Nincs VM / konténer</small> }
          </div>
        </div>
      }
    </section>`,
})
export class NetworkWidget implements OnInit {
  private readonly ref = inject(DestroyRef);
  private readonly ha = inject(HaService);
  readonly w = input.required<W<'network'>>();
  private readonly http = signal<Record<string, boolean>>({});
  readonly sel = signal<string | null>(null); // Proxmox node shown in the detail panel
  readonly uptime = uptime;
  readonly isK8s = isK8s;
  readonly lvl = (p: number | null) => (p === null ? '' : p >= 85 ? 'bad' : p >= 60 ? 'warn' : 'ok');

  readonly nodes = computed(() => {
    const e = this.ha.entities(), h = this.http(), ns = this.w().nodes, pos = layout(ns.map(n => n.kind));
    return ns.map((n, i) => {
      const s: Status = n.entity ? entityStatus(e[n.entity]?.state) : n.url && n.url in h ? (h[n.url] ? 'up' : 'down') : 'unknown';
      const pve = n.proxmox ? nodeStats(e, n.proxmox) : null;
      const pct = (v: number | null) => (v === null ? '–' : Math.round(v) + '%');
      const tip = `${n.name}: ${s === 'up' ? 'online' : s === 'down' ? 'nem elérhető' : 'nincs adat'}` + (pve ? ` · CPU ${pct(pve.cpu)} · RAM ${pct(pve.mem)} (kattints a részletekért)` : '');
      return { ...n, ...pos[i], s, pve, tip };
    });
  });
  // data links: `parent` from config, else middle tier → first router, cameras → NVR; live only when both ends are up
  readonly links = computed(() => {
    const ns = this.nodes(), byName = new Map(ns.map(n => [n.name, n]));
    const hub = ns.find(n => n.kind === 'router'), nvr = ns.find(n => n.kind === 'nvr');
    return ns.flatMap(b => {
      const a = b.parent ? byName.get(b.parent) : b.kind === 'camera' ? nvr : TIER[b.kind] === 1 ? hub : b.kind === 'router' && b !== hub ? hub : undefined;
      if (!a) return [];
      return [{
        // same tier: a low arc under the labels; otherwise an S-curve from the bottom of a to the top of b
        d: a.y === b.y ? `M${a.x} ${a.y - 16}C${a.x} ${a.y - 40} ${b.x} ${b.y - 40} ${b.x} ${b.y - 16}`
          : `M${a.x} ${a.y + 14}C${a.x} ${a.y + 40} ${b.x} ${b.y - 40} ${b.x} ${b.y - 14}`,
        s: a.s === 'up' && b.s === 'up' ? 'up' : a.s === 'down' || b.s === 'down' ? 'down' : 'unknown',
      }];
    });
  });
  // power: amber lines from each node's `powers` list; amber pulse while on battery, red when the source is down
  readonly power = computed(() => {
    const ns = this.nodes(), byName = new Map(ns.map(n => [n.name, n])), e = this.ha.entities();
    return ns.flatMap(a => (a.powers ?? []).flatMap(name => {
      const b = byName.get(name);
      if (!b) return [];
      const mode = a.kind === 'ups' && a.entity ? upsMode(e[a.entity]?.state) : 'line';
      const s = a.s === 'down' ? 'down' : mode === 'battery' || mode === 'low' ? 'batt' : 'up';
      // same tier: dip under the labels and load bars; router above: rise from the UPS top
      const dip = Math.min(30, 10 + Math.abs(a.x - b.x) * .08);
      const d = a.y === b.y ? `M${a.x} ${a.y + 44}C${a.x} ${a.y + 44 + dip} ${b.x} ${b.y + 44 + dip} ${b.x} ${b.y + 44}`
        : `M${a.x + 12} ${a.y - 12}C${a.x + 40} ${a.y - 50} ${b.x + 40} ${b.y + 10} ${b.x + 14} ${b.y + 4}`;
      return [{ d, s }];
    }));
  });
  readonly detail = computed(() => {
    const id = this.sel(), n = this.nodes().find(x => x.proxmox === id);
    return n && id ? { name: n.name, s: n.s, st: nodeStats(this.ha.entities(), id), guests: guestsOf(this.ha.entities(), id) } : null;
  });
  readonly up = computed(() => this.nodes().filter(n => n.s === 'up').length);
  readonly down = computed(() => this.nodes().filter(n => n.s === 'down').length);

  ngOnInit() {
    const urls = this.w().nodes.flatMap(n => (n.entity || !n.url ? [] : [n.url]));
    if (urls.length) poll(this.ref, 60_000, async () => {
      const res = await Promise.all(urls.map(u => isUp(u)));
      this.http.set(Object.fromEntries(urls.map((u, i) => [u, res[i]])));
    });
  }
}
