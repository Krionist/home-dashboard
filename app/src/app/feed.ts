export interface FeedItem { title: string; link: string; date: number; image?: string; severity?: Severity; tags?: string[]; unplayed?: number; watched?: boolean }
export interface Severity { score: number; level: string } // cvefeed.io: "Severity: 9.8 | CRITICAL" in the description

export function severityOf(desc: string): Severity | undefined {
  const m = desc.match(/Severity:\s*(?:<\/strong>)?\s*([\d.]+)\s*\|\s*([A-Z]+)/);
  return m ? { score: Number(m[1]), level: m[2].toLowerCase() } : undefined;
}

// Jellyfin /Items response → feed items; 16:9 art preferred (Thumb > Backdrop > Primary), images via the /jellyfin proxy
interface JfItem { Id: string; ServerId: string; Name: string; ProductionYear?: number; DateCreated?: string; DateLastContentAdded?: string;
  ImageTags?: Record<string, string>; BackdropImageTags?: string[]; UserData?: { UnplayedItemCount?: number; Played?: boolean } } // UserData only with ?userId=
export function parseJellyfin(res: { Items: JfItem[] }, web: string): FeedItem[] {
  return res.Items.map(i => {
    const art = i.ImageTags?.['Thumb'] ? 'Thumb' : i.BackdropImageTags?.length ? 'Backdrop' : i.ImageTags?.['Primary'] ? 'Primary' : '';
    const item: FeedItem = {
      title: i.ProductionYear ? `${i.Name} (${i.ProductionYear})` : i.Name,
      link: `${web}/web/#/details?id=${i.Id}&serverId=${i.ServerId}`,
      date: Date.parse(i.DateLastContentAdded || i.DateCreated || '') || 0,
    };
    if (art) item.image = `/jellyfin/Items/${i.Id}/Images/${art}?maxWidth=320`;
    if (i.UserData?.UnplayedItemCount) item.unplayed = i.UserData.UnplayedItemCount;
    else if (i.UserData?.Played) item.watched = true;
    return item;
  });
}

// well-known platforms / languages / vendors spotted in the title or description → badge label
const TECH: [RegExp, string][] = [
  [/\bWordPress\b/, 'WordPress'], [/\bDrupal\b/, 'Drupal'], [/\bJoomla\b/, 'Joomla'], [/\bTwig\b|\bLaravel\b|\bPHP\b/, 'PHP'],
  [/\bPython\b|\bPyPI\b|\bDjango\b/, 'Python'], [/\bJava\b(?!Script)/, 'Java'], [/\bNode\.js\b|\bnpm\b/, 'Node.js'],
  [/\bJavaScript\b|\bTypeScript\b/, 'JavaScript'], [/\bRust\b|\bcrate\b|\bWasmtime\b|\bCranelift\b/, 'Rust'], [/\bGolang\b|\bGo module\b/, 'Go'],
  [/\bRuby\b|\bRails\b/, 'Ruby'], [/\.NET\b/, '.NET'], [/\bLinux kernel\b/, 'Linux'], [/\bWindows\b/, 'Windows'], [/\bAndroid\b/, 'Android'],
  [/\biOS\b|\bmacOS\b/, 'Apple'], [/\bChrom(e|ium)\b/, 'Chrome'], [/\bFirefox\b/, 'Firefox'], [/\bDocker\b/, 'Docker'],
  [/\bKubernetes\b/, 'Kubernetes'], [/\bnginx\b/i, 'nginx'], [/\bApache\b/, 'Apache'], [/\bOpenSSL\b/, 'OpenSSL'],
  [/\bAmazon Web Services\b|\bAWS\b/, 'AWS'], [/\bAzure\b/, 'Azure'], [/\bCisco\b/, 'Cisco'], [/\bFortinet\b|\bFortiOS\b/, 'Fortinet'],
  [/\bIvanti\b/, 'Ivanti'], [/\bVMware\b/, 'VMware'], [/\bOracle\b/, 'Oracle'], [/\bSAP\b/, 'SAP'], [/\bZephyr\b/, 'Zephyr'],
  [/\bGitLab\b/, 'GitLab'], [/\bJenkins\b/, 'Jenkins'], [/\bGrafana\b/, 'Grafana'], [/\bNextcloud\b/, 'Nextcloud'], [/\bHome Assistant\b/, 'Home Assistant'],
  [/\bCraft CMS\b/, 'Craft CMS'], [/\bHP\b/, 'HP'], [/\bBluetooth\b/, 'Bluetooth'], [/\bUSB\b/, 'USB'],
];

// badges for a CVE: the product named in the title ("CVE-… - Wasmtime: …", "CVE-… - Prime Mover <= 2.2.1 - …") + known tech, max 3
// ponytail: keyword list, extend TECH when a common stack keeps showing up unlabelled
export function cveTags(title: string, desc: string): string[] {
  const rest = title.replace(/^CVE-\d+-\d+\s*[-–]\s*/, '');
  const product = rest.match(/^([^:]{2,32}):\s/)?.[1] ?? rest.match(/^(.{2,32}?)\s+(?:<=?|<|before|prior to|through)\s*v?\d/)?.[1]
    // else the description's subject: "Postiz lets…", "The Foo plugin is…"
    ?? desc.match(/Description :\s*(?:<\/strong>)?\s*(?:The\s+)?([A-Z][\w.-]*(?:\s[A-Z][\w.-]*){0,2})\s+(?:is|lets|allows|has|does|before|versions?|plugin|component)\b/)?.[1];
  const tech = TECH.filter(([re]) => re.test(title) || re.test(desc)).map(([, l]) => l);
  return [...new Set([product, ...tech].filter((t): t is string => !!t))].slice(0, 3);
}

// "5 perce" / "3 órája" / "2 napja"
export function ago(ts: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - ts) / 60_000));
  return m < 60 ? `${m} perce` : m < 1440 ? `${Math.floor(m / 60)} órája` : `${Math.floor(m / 1440)} napja`;
}

export function parseFeed(xml: string): FeedItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('bad feed');
  return [...doc.querySelectorAll('item, entry')].map(i => {
    const text = (s: string) => i.querySelector(s)?.textContent?.trim() ?? '';
    const link = i.querySelector('link');
    const item: FeedItem = {
      title: text('title'),
      link: link?.getAttribute('href') ?? link?.textContent?.trim() ?? '',
      date: Date.parse(text('pubDate') || text('published') || text('updated')) || 0,
    };
    const image = imageOf(i);
    if (image) item.image = image;
    const severity = severityOf(text('description'));
    if (severity) item.severity = severity;
    if (severity) item.tags = cveTags(item.title, text('description'));
    return item;
  });
}

// media:thumbnail (YouTube) > media:content > image enclosure > first <img> in the HTML body (444.hu)
function imageOf(i: Element): string {
  const attr = (tag: string) => [...i.getElementsByTagName(tag)].find(e => e.getAttribute('medium') !== 'video')?.getAttribute('url');
  const enc = [...i.getElementsByTagName('enclosure')].find(e => e.getAttribute('type')?.startsWith('image'));
  const html = [...i.getElementsByTagName('content:encoded'), ...i.getElementsByTagName('description')].map(e => e.textContent).join(' ');
  return attr('media:thumbnail') || attr('media:content') || enc?.getAttribute('url') || html.match(/<img[^>]+src="([^"]+)"/)?.[1] || '';
}
