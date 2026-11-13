import { Component, inject, output } from '@angular/core';
import { ConfigService } from './config.service';
import { EditService } from './edit.service';
import { Brightness } from './kiosk';

const DEF: Required<Pick<Brightness, 'day' | 'night' | 'nightClock'>> = { day: 200, night: 20, nightClock: { from: 23, to: 6, level: 5 } };

// /tablet ⚙️: brightness and night-clock hours; changes apply live, Mentés writes config.json, Mégse restores
@Component({
  selector: 'app-tablet-settings',
  template: `
    <div class="tset-bg" (click)="cancel()">
      <div class="card tset" (click)="$event.stopPropagation()">
        <h3>Tablet beállítások</h3>
        <label>☀️ Nappali fényerő <b>{{ pct(b().day) }}%</b>
          <input type="range" min="1" max="100" [value]="pct(b().day)" (input)="set({ day: raw($event) })" /></label>
        <label>🌆 Napnyugta után <b>{{ pct(b().night) }}%</b>
          <input type="range" min="1" max="100" [value]="pct(b().night)" (input)="set({ night: raw($event) })" /></label>
        <h4>🌙 Éjszakai óra</h4>
        <div class="tset-hours">
          <label>Kezdet <input type="number" min="0" max="23" [value]="nc().from" (change)="setNc({ from: hour($event) })" /> óra</label>
          <label>Vége <input type="number" min="0" max="23" [value]="nc().to" (change)="setNc({ to: hour($event) })" /> óra</label>
        </div>
        <label>Fényerő <b>{{ pct(nc().level) }}%</b>
          <input type="range" min="1" max="100" [value]="pct(nc().level)" (input)="setNc({ level: raw($event) })" /></label>
        @if (ed.error()) { <div class="err">{{ ed.error() }}</div> }
        <div class="wadd-btns">
          <button class="on" [disabled]="ed.busy()" (click)="save()">Mentés</button>
          <button [disabled]="ed.busy()" (click)="cancel()">Mégse</button>
        </div>
      </div>
    </div>`,
})
export class TabletSettings {
  private readonly cfg = inject(ConfigService);
  readonly ed = inject(EditService);
  readonly close = output();
  private readonly orig = structuredClone(this.cfg.config()?.tablet?.brightness);
  readonly b = () => ({ ...DEF, ...this.cfg.config()?.tablet?.brightness });
  readonly nc = () => this.b().nightClock ?? DEF.nightClock;

  // config is 0-255 (Fully's scale), the sliders are %
  pct = (v: number) => Math.max(1, Math.round((v / 255) * 100));
  raw = (e: Event) => Math.round((Number((e.target as HTMLInputElement).value) / 100) * 255);
  hour = (e: Event) => Math.min(23, Math.max(0, Math.trunc(Number((e.target as HTMLInputElement).value)) || 0));

  set(p: Partial<Brightness>) { this.ed.setBrightness({ ...this.b(), ...p }); }
  setNc(p: Partial<Brightness['nightClock']>) { this.set({ nightClock: { ...this.nc(), ...p } }); }

  async save() {
    await this.ed.save();
    if (!this.ed.error()) this.close.emit();
  }
  cancel() {
    this.ed.setBrightness(this.orig);
    this.close.emit();
  }
}
