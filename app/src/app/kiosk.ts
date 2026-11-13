import { DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { HaService } from './ha.service';

// Fully Kiosk Browser injects this object; absent in any other browser
declare const fully: { setScreenBrightness(v: number): void; turnScreenOn(): void; getScreenBrightness(): number } | undefined;

// 0-255, Fully's scale; nightClock: black screen with only a clock between from..to (hours)
export interface Brightness { day: number; night: number; nightClock?: { from: number; to: number; level: number } }
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

  if (fk) fkBrightness(fk, ha, brightness, night, ringing);
  return { now, night, test, ringing, ring };
}

function fkBrightness(fk: NonNullable<typeof fully>, ha: HaService, brightness: () => Brightness | undefined, night: () => boolean, ringing: () => boolean) {
  fk.turnScreenOn();
  effect(() => {
    const b = brightness() ?? { day: 200, night: 20 };
    if (ringing()) { fk.turnScreenOn(); fk.setScreenBrightness(b.day); return; }
    const sun = ha.entities()['sun.sun']?.state;
    if (!night() && !sun) return;
    const v = night() ? (b.nightClock?.level ?? 5) : sun === 'below_horizon' ? b.night : b.day;
    if (fk.getScreenBrightness() !== v) fk.setScreenBrightness(v);
  });
}
