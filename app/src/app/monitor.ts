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

// Sonarr/Radarr /api/v3/queue → what is downloading and how far it got
export type QueueItem = { name: string; pct: number; left: string; status: string };
type ArrRecord = {
  title: string; size: number; sizeleft: number; timeleft?: string; status: string;
  series?: { title: string }; episode?: { seasonNumber: number; episodeNumber: number }; movie?: { title: string };
};
export function toQueue(records: ArrRecord[]): QueueItem[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  return records.map(r => ({
    name: r.movie?.title ?? (r.series ? `${r.series.title}${r.episode ? ` S${pad(r.episode.seasonNumber)}E${pad(r.episode.episodeNumber)}` : ''}` : r.title),
    pct: r.size > 0 ? Math.round((1 - r.sizeleft / r.size) * 100) : 0,
    left: r.timeleft?.replace(/\.\d+$/, '') ?? '', // "1.02:03:04" → d.hh:mm:ss
    status: r.status,
  }));
}
