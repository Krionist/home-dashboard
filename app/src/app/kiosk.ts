import { DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { HaService } from './ha.service';

// Fully Kiosk Browser injects this object; absent in any other browser
declare const fully: { setScreenBrightness(v: number): void; turnScreenOn(): void; getScreenBrightness(): number } | undefined;

// 0-255, Fully's scale; nightClock: black screen with only a clock between from..to (hours)
// freekiosk: FreeKiosk has no JS bridge, so its own REST API is called instead (Settings → Advanced: REST API + remote control on)
export interface Brightness { day: number; night: number; nightClock?: { from: number; to: number; level: number }; freekiosk?: { url?: string; key?: string } }
// event: HA event entity whose state (a timestamp) changes on every ring; camera shown full screen for `seconds`
export interface Doorbell { event: string; camera: string; seconds?: number }

// /tablet: keep the screen on and dim it while the sun is down
export function kiosk(brightness: () => Brightness | undefined, doorbell: () => Doorbell | undefined) {
  const ha = inject(HaService);
  const fk = typeof fully !== 'undefined' ? fully : undefined;
  const now = signal(new Date());
  const tick = setInterval(() => now.set(new Date()), 15_000);
  const test = signal(false); // night clock on demand, from the test button
  const ringing = signal(false);
  let ringTimer: ReturnType<typeof setTimeout> | undefined;
  const ring = (on = true) => {
    clearTimeout(ringTimer);
    ringing.set(on);
    if (on) ringTimer = setTimeout(() => ringing.set(false), (doorbell()?.seconds ?? 30) * 1000);
  };
  let last: string | undefined; // first state seen is history, not a ring
  effect(() => {
    const id = doorbell()?.event, st = id ? ha.entities()[id]?.state : undefined;
    if (!st || st === 'unavailable' || st === 'unknown') return;
    if (last !== undefined && st !== last) ring();
    last = st;
  });
  const night = computed(() => {
    if (ringing()) return false;
    if (test()) return true;
    const n = brightness()?.nightClock ?? { from: 23, to: 6, level: 5 };
    const h = now().getHours();
    return n.from > n.to ? h >= n.from || h < n.to : h >= n.from && h < n.to;
  });

  // ponytail: Fully's own "Keep Screen On" setting is the real guarantee; wake lock covers plain Chrome on https
  const lock = () => navigator.wakeLock?.request('screen').catch(() => {});
  const onVis = () => document.visibilityState === 'visible' && lock();
  lock();
  document.addEventListener('visibilitychange', onVis);
  inject(DestroyRef).onDestroy(() => { document.removeEventListener('visibilitychange', onVis); clearInterval(tick); clearTimeout(ringTimer); });

  // wanted brightness on Fully's 0-255 scale; null until sun.sun is known
  const target = computed(() => {
    const b = brightness() ?? { day: 200, night: 20 };
    if (ringing()) return b.day;
    if (night()) return b.nightClock?.level ?? 5;
    const sun = ha.entities()['sun.sun']?.state;
    return sun ? (sun === 'below_horizon' ? b.night : b.day) : null;
  });

  if (fk) {
    fk.turnScreenOn();
    effect(() => {
      const v = target();
      if (ringing()) fk.turnScreenOn();
      if (v !== null && fk.getScreenBrightness() !== v) fk.setScreenBrightness(v);
    });
  } else {
    // FreeKiosk answers CORS with *, so a plain fetch works; brightness is 0-100 there
    const api = (path: string, body?: object) => {
      const fk = brightness()?.freekiosk;
      if (!fk) return Promise.resolve();
      return fetch((fk.url ?? 'http://127.0.0.1:8080') + path, {
        method: 'POST', body: JSON.stringify(body ?? {}),
        headers: { 'Content-Type': 'application/json', ...(fk.key ? { 'X-Api-Key': fk.key } : {}) },
      }).then(r => { if (!r.ok) throw new Error(`FreeKiosk ${path}: ${r.status}`); });
    };
    let sent: number | null = null; // one call per change
    effect(() => {
      const v = target();
      if (v === null || !brightness()?.freekiosk) return;
      const pct = Math.max(1, Math.round((v / 255) * 100));
      if (pct !== sent) api('/api/brightness', { value: pct }).then(() => (sent = pct), e => console.warn(e));
    });
    effect(() => { if (ringing()) api('/api/screen/on').then(() => api('/api/wake')).catch(e => console.warn(e)); });
  }
  return { now, night, test, ringing, ring };
}
