import { site, tabsOf } from './linkwarden';

describe('linkwarden helpers', () => {
  it('derives an icon slug from the url', () => {
    expect(site('https://www.github.com/Graphify-Labs/graphify')).toBe('github');
    expect(site('https://lpmobile.hu/termek/x/')).toBe('lpmobile');
    expect(site('not a url')).toBe('');
  });
  it('builds a recent tab plus one per non-empty collection', () => {
    const links = [{ name: 'a', url: 'u1', collection: 'AI' }, { name: 'b', url: 'u2', collection: 'Job' }, { name: 'c', url: 'u3', collection: 'AI' }];
    const tabs = tabsOf(links, [{ name: 'AI', count: 2 }, { name: 'Empty', count: 0 }, { name: 'Job', count: 1 }], 2);
    expect(tabs.map(t => [t.name, t.links.length])).toEqual([['Legutóbbi', 2], ['AI', 2], ['Job', 1]]);
  });
});
