import { DestroyRef } from '@angular/core';

export function poll(ref: DestroyRef, ms: number, fn: () => void) {
  fn();
  const id = setInterval(fn, ms);
  ref.onDestroy(() => clearInterval(id));
}
