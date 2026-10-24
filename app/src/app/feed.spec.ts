import { describe, it, expect } from 'vitest';
import { parseFeed } from './feed';

const rss = `<rss><channel><item><title>A</title><link>http://a</link><pubDate>Wed, 01 Jan 2025 10:00:00 GMT</pubDate></item></channel></rss>`;
const atom = `<feed><entry><title>B</title><link href="http://b"/><updated>2025-01-02T10:00:00Z</updated></entry></feed>`;

describe('parseFeed', () => {
  it('parses RSS', () => {
    expect(parseFeed(rss)).toEqual([{ title: 'A', link: 'http://a', date: Date.parse('2025-01-01T10:00:00Z') }]);
  });
  it('parses Atom', () => {
    expect(parseFeed(atom)).toEqual([{ title: 'B', link: 'http://b', date: Date.parse('2025-01-02T10:00:00Z') }]);
  });
  it('extracts preview images', () => {
    const yt = `<feed xmlns:media="http://search.yahoo.com/mrss/"><entry><title>V</title><media:group><media:thumbnail url="http://t.jpg"/></media:group></entry></feed>`;
    const enc = `<rss><channel><item><title>E</title><enclosure url="http://e.jpg" type="image/jpeg"/></item></channel></rss>`;
    const img = `<rss><channel><item><title>I</title><description>&lt;img src="http://i.jpg" /&gt;</description></item></channel></rss>`;
    expect([yt, enc, img].map(x => parseFeed(x)[0].image)).toEqual(['http://t.jpg', 'http://e.jpg', 'http://i.jpg']);
  });
  it('throws on invalid XML', () => {
    expect(() => parseFeed('<rss><item>')).toThrow(/bad feed/);
  });
});

import { ago, cveTags, parseJellyfin, severityOf } from './feed';
describe('parseJellyfin', () => {
  it('maps items with year, details link and 16:9 art', () => {
    const res: Parameters<typeof parseJellyfin>[0] = { Items: [
      { Id: 'm1', ServerId: 's', Name: 'Dune', ProductionYear: 2021, DateCreated: '2026-10-01T10:00:00Z', BackdropImageTags: ['x'], ImageTags: { Primary: 'p' }, UserData: { Played: true } },
      { Id: 's1', ServerId: 's', Name: 'Severance', DateLastContentAdded: '2026-10-02T10:00:00Z', ImageTags: { Thumb: 't', Primary: 'p' }, UserData: { UnplayedItemCount: 7 } },
      { Id: 'n', ServerId: 's', Name: 'Bare' },
    ] };
    const [m, s, n] = parseJellyfin(res, 'http://jf');
    expect(m).toEqual({ title: 'Dune (2021)', link: 'http://jf/web/#/details?id=m1&serverId=s', date: Date.parse('2026-10-01T10:00:00Z'), image: '/jellyfin/Items/m1/Images/Backdrop?maxWidth=320', watched: true });
    expect(s.image).toBe('/jellyfin/Items/s1/Images/Thumb?maxWidth=320');
    expect(s.date).toBe(Date.parse('2026-10-02T10:00:00Z'));
    expect(s.unplayed).toBe(7);
    expect(n.image).toBeUndefined();
    expect(n.unplayed).toBeUndefined();
  });
});
describe('cve severity / age', () => {
  it('reads cvefeed.io severity', () => {
    expect(severityOf('<strong>Severity:</strong> 9.8 | CRITICAL <br />')).toEqual({ score: 9.8, level: 'critical' });
    expect(severityOf('no score here')).toBeUndefined();
  });
  it('formats age', () => {
    const now = 10 * 86_400_000;
    expect(ago(now - 5 * 60_000, now)).toBe('5 perce');
    expect(ago(now - 3 * 3_600_000, now)).toBe('3 órája');
    expect(ago(now - 2 * 86_400_000, now)).toBe('2 napja');
  });
});

describe('cveTags', () => {
  it('takes the product from the title and known tech from the text', () => {
    expect(cveTags('CVE-2026-1 - Prime Mover <= 2.2.1 - PHP Object Injection', 'The Prime Mover plugin for WordPress is vulnerable'))
      .toEqual(['Prime Mover', 'WordPress', 'PHP']);
    expect(cveTags('CVE-2026-2 - Wasmtime: Cranelift miscompilation', '')).toEqual(['Wasmtime', 'Rust']);
    expect(cveTags('CVE-2026-3 - Product Registration Module Reflected XSS', 'nothing known')).toEqual([]);
    expect(cveTags('CVE-2026-4 - Arbitrary file read', '<strong>Description :</strong>Postiz lets a signed-in user run a function.')).toEqual(['Postiz']);
  });
});
