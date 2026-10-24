import { Injectable, signal } from '@angular/core';
import {
  Connection, ERR_INVALID_AUTH, HassEntities, callService, createConnection, getAuth, subscribeEntities,
} from 'home-assistant-js-websocket';

const TOKENS_KEY = 'hassTokens';

@Injectable({ providedIn: 'root' })
export class HaService {
  readonly entities = signal<HassEntities>({});
  readonly connected = signal(false);
  readonly error = signal('');
  private conn?: Connection;

  async connect(hassUrl: string) {
    try {
      // first run redirects to the HA login page; the library only persists tokens if we give it storage
      const auth = await getAuth({
        hassUrl,
        saveTokens: d => localStorage.setItem(TOKENS_KEY, JSON.stringify(d)),
        loadTokens: async () => JSON.parse(localStorage.getItem(TOKENS_KEY) ?? 'null'),
      });
      if (location.search.includes('auth_callback')) history.replaceState(null, '', location.pathname);
      const conn = (this.conn = await createConnection({ auth }));
      conn.addEventListener('ready', () => this.connected.set(true));
      conn.addEventListener('disconnected', () => this.connected.set(false));
      this.connected.set(true);
      subscribeEntities(conn, e => this.entities.set(e));
    } catch (e) {
      if (e === ERR_INVALID_AUTH) {
        localStorage.removeItem(TOKENS_KEY);
        location.reload();
        return;
      }
      this.error.set(`HA: ${e}`);
    }
  }

  toggle(entity_id: string) {
    return callService(this.conn!, 'homeassistant', 'toggle', { entity_id });
  }

  call(domain: string, service: string, data: Record<string, unknown>) {
    return callService(this.conn!, domain, service, data);
  }

  ws<T>(msg: { type: string; [k: string]: unknown }) {
    return this.conn!.sendMessagePromise<T>(msg);
  }
}
