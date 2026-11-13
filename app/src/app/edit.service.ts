import { Injectable, inject, signal } from '@angular/core';
import { Config, Page, Widget, isWidget } from './config';
import { ConfigService } from './config.service';
import { HaService } from './ha.service';

export type PageKey = number | 'tablet';

// edit mode works on cfg.config() in place (a fresh clone per change, so signals fire); cancel restores the snapshot
@Injectable({ providedIn: 'root' })
export class EditService {
  private readonly cfg = inject(ConfigService);
  private readonly ha = inject(HaService);
  readonly on = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly trash = signal<Widget[]>([]); // removed this session, offered again in the catalog
  private snapshot: Config | null = null;

  start() {
    this.snapshot = structuredClone(this.cfg.config());
    this.trash.set([]);
    this.error.set('');
    this.on.set(true);
  }

  cancel() {
    if (this.snapshot) this.cfg.config.set(this.snapshot);
    this.on.set(false);
  }

  async save() {
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await fetch('config.json', {
        method: 'PUT', body: JSON.stringify(this.cfg.config()),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await this.ha.token()}` },
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
      this.on.set(false);
    } catch (e) {
      this.error.set(`Mentés sikertelen: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.busy.set(false);
    }
  }

  remove(key: PageKey, col: number, i: number) {
    this.change(key, p => this.trash.update(t => [...t, ...p.columns[col].widgets.splice(i, 1)]));
  }

  // dy: up/down within the column, dx: to the neighbouring column (appended at the end)
  move(key: PageKey, col: number, i: number, dy: number, dx: number) {
    this.change(key, p => {
      const from = p.columns[col].widgets;
      if (dx) {
        const to = p.columns[col + dx]?.widgets;
        if (to) to.push(...from.splice(i, 1));
      } else if (from[i + dy]) {
        [from[i], from[i + dy]] = [from[i + dy], from[i]];
      }
    });
  }

  toggleCompact(key: PageKey, col: number, i: number) {
    this.change(key, p => {
      const w = p.columns[col].widgets[i];
      if (w.compact) delete w.compact; else w.compact = true;
    });
  }

  add(key: PageKey, col: number, w: Widget) {
    this.change(key, p => p.columns[col].widgets.push(structuredClone(w)));
  }

  // every distinct widget in the config plus the trash: the add list
  catalog(): { label: string; w: Widget }[] {
    const c = this.cfg.config();
    if (!c) return [];
    const all = [...c.pages, ...(c.tablet ? [c.tablet] : [])].flatMap(p => p.columns.flatMap(col => col.widgets));
    const seen = new Map<string, Widget>();
    for (const w of [...this.trash(), ...all]) seen.set(JSON.stringify(w), w);
    return [...seen.values()].map(w => ({ w, label: `${w.type} · ${'title' in w && w.title ? w.title : 'entity' in w ? w.entity : ''}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  parse(json: string): Widget {
    const w = JSON.parse(json);
    if (!isWidget(w)) throw new Error('ismeretlen widget type');
    return w;
  }

  private change(key: PageKey, fn: (p: Page) => void) {
    const c = structuredClone(this.cfg.config()!);
    const p = key === 'tablet' ? c.tablet : c.pages[key];
    if (!p) return;
    fn(p);
    this.cfg.config.set(c);
  }
}
