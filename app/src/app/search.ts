import type { Bang } from './config';

export function resolveSearch(q: string, bangs: Bang[]): string {
  const [first, ...rest] = q.trim().split(/\s+/);
  const bang = bangs.find(b => b.shortcut === first);
  const query = encodeURIComponent(bang ? rest.join(' ') : q.trim());
  return (bang?.url ?? 'https://duckduckgo.com/?q={QUERY}').replace('{QUERY}', query);
}
