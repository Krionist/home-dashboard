import { Injectable, signal } from '@angular/core';
import { Config, parseConfig } from './config';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  readonly config = signal<Config | null>(null);
  readonly error = signal('');

  async load() {
    try {
      const r = await fetch('config.json');
      if (!r.ok) throw new Error(`config.json: ${r.status}`);
      this.config.set(parseConfig(await r.json()));
    } catch (e) {
      this.error.set(String(e));
    }
  }
}
