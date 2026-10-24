// no-cors: resolves if the host answered at all (any HTTP status), rejects on network failure.
// A response with Cross-Origin-Resource-Policy: same-origin is also a rejection -> point checkUrl at a file without it.
export async function isUp(url: string, timeoutMs = 5000): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    if (url.startsWith('/')) return (await fetch(url, { signal: ctl.signal })).ok; // same-origin check endpoint, e.g. sidecar /reddit/up?url=
    await fetch(url, { mode: 'no-cors', signal: ctl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
