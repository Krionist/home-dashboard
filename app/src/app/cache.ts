export const HALF_HOUR = 30 * 60_000;

// per-browser cache in localStorage, survives reloads; storage may throw (private mode, quota) -> just call fn.
// Only resolved values are stored, so a failed fetch is retried on the next call.
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  try {
    const hit = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  } catch { /* fall through */ }
  const v = await fn();
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), v })); } catch { /* not cached */ }
  return v;
}
