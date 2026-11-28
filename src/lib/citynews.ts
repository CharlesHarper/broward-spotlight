// Local news and events for each city, read from the city's own official website feeds.
// Most Broward cities run CivicPlus sites, which publish standard RSS for "News Flash" and the calendar.
// Others publish WordPress feeds. Feeds are found automatically and re-checked weekly.

// Official sites. Where a city has used more than one address, both are listed and the first that answers wins.
export const CITY_SITES: Record<string, string | string[]> = {
  'coconut-creek': 'www.coconutcreek.net',
  'cooper-city': ['www.coopercity.gov', 'www.coopercityfl.org'],
  'coral-springs': 'www.coralsprings.gov',
  'dania-beach': 'daniabeachfl.gov',
  davie: 'www.davie-fl.gov',
  'deerfield-beach': ['www.deerfield-beach.com', 'www.deerfield-beachfl.gov'],
  'fort-lauderdale': 'www.fortlauderdale.gov',
  'hallandale-beach': ['www.hallandalebeachfl.gov', 'www.cohb.org'],
  'hillsboro-beach': 'www.townofhillsborobeach.com',
  hollywood: 'www.hollywoodfl.org',
  'lauderdale-by-the-sea': 'www.lbts-fl.gov',
  'lauderdale-lakes': ['www.lauderdalelakes.org', 'www.lauderdalelakesfl.gov'],
  lauderhill: 'www.lauderhill-fl.gov',
  'lighthouse-point': 'www.lighthousepoint.com',
  margate: 'www.margatefl.com',
  miramar: 'www.miramarfl.gov',
  'north-lauderdale': ['www.nlauderdale.org', 'www.northlauderdalefl.gov'],
  'oakland-park': 'www.oaklandparkfl.gov',
  parkland: 'www.cityofparkland.org',
  'pembroke-park': 'www.tppfl.gov',
  'pembroke-pines': 'www.ppines.com',
  plantation: 'www.plantation.org',
  'pompano-beach': 'www.pompanobeachfl.gov',
  'sea-ranch-lakes': ['www.searanchlakesflorida.gov', 'www.searanchlakesfl.gov'],
  'southwest-ranches': 'www.southwestranches.org',
  sunrise: 'www.sunrisefl.gov',
  tamarac: 'www.tamarac.org',
  'west-park': ['www.cityofwestpark.org', 'www.westparkfl.gov'],
  weston: 'www.westonfl.org',
  'wilton-manors': 'www.wiltonmanors.com',
  'unincorporated-broward': 'www.broward.org',
};

const UA = 'BrowardSpotlightCityFeeds/1.0 (+https://browardspotlight.com/how-it-works)';

export interface FeedItem {
  title: string; link: string; pubDate: string | null; description: string;
  eventDates: string | null; eventTimes: string | null; location: string | null;
}

const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const text = (s: string) => decode(decode(s)).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').trim();
const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? text(m[1]) : null;
};

/** A small RSS reader (Workers have no DOM parser). */
export function parseRss(xml: string): FeedItem[] {
  if (!/<rss|<channel/i.test(xml)) return [];
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(([it]) => ({
    title: tag(it, 'title') ?? '',
    link: tag(it, 'link') ?? '',
    pubDate: tag(it, 'pubDate'),
    description: tag(it, 'description') ?? '',
    eventDates: tag(it, 'calendarEvent:EventDates'),
    eventTimes: tag(it, 'calendarEvent:EventTimes'),
    location: tag(it, 'calendarEvent:Location'),
  })).filter((i) => i.title && /^https?:\/\//.test(i.link));
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
/** "December 2, 2026" → "2026-12-02" */
function day(s: string): string | null {
  const m = s.toLowerCase().match(/([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (!m) return null;
  const mi = MONTHS.findIndex((x) => x.startsWith(m[1].slice(0, 3)));
  return mi < 0 ? null : `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}
/** "04:00 PM" → "16:00" */
function clock(s: string): string | null {
  const m = s.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/** Granicus Vision calendars put the date in the title: "Council Meeting (11/23/2026 6:00 PM - 11:00 PM)". */
const TITLE_DATE = /\s*\((\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{2}\s*[AP]M))?(?:\s*-\s*(?:(\d{1,2})\/(\d{1,2})\/(\d{4}))?\s*(\d{1,2}:\d{2}\s*[AP]M)?)?\)\s*$/i;
export const eventTitle = (t: string) => t.replace(TITLE_DATE, '').trim();
function whenFromTitle(t: string) {
  const m = t.match(TITLE_DATE);
  if (!m) return null;
  const ymd = (y: string, mo: string, d: string) => `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const d1 = ymd(m[3], m[1], m[2]);
  const d2 = m[7] ? ymd(m[7], m[5], m[6]) : null;
  const t1 = m[4] ? clock(m[4]) : null, t2 = m[8] ? clock(m[8]) : null;
  return {
    starts: `${d1} ${t1 ?? '00:00'}`,
    ends: d2 ? `${d2} ${t2 ?? '23:59'}` : t2 ? `${d1} ${t2}` : null,
    timeText: t1 ? [m[4], m[8]].filter(Boolean).join(' - ').toUpperCase() : null,
  };
}

export function eventWhen(i: FeedItem): { starts: string; ends: string | null; timeText: string | null } | null {
  const fromTitle = !i.eventDates && !/Event dates?:/i.test(i.description) ? whenFromTitle(i.title) : null;
  if (fromTitle) return fromTitle;
  const src = i.eventDates ?? (i.description.match(/Event dates?:\s*([^\n]+)/i)?.[1] ?? '');
  const parts = src.split(/\s+-\s+/);
  const d1 = day(parts[0] ?? ''), d2 = parts[1] ? day(parts[1]) : null;
  if (!d1) return null;
  const times = i.eventTimes ?? (i.description.match(/Event Time:\s*([^\n]+)/i)?.[1] ?? null);
  const [t1, t2] = (times ?? '').split(/\s+-\s+/).map((t) => clock(t));
  const allDay = !t1 || (t1 === '00:00' && (!t2 || t2 === '23:59'));
  return {
    starts: `${d1} ${allDay ? '00:00' : t1}`,
    ends: d2 ? `${d2} ${t2 ?? '23:59'}` : t2 && !allDay ? `${d1} ${t2}` : null,
    timeText: allDay ? null : times?.replace(/\s+/g, ' ').trim() ?? null,
  };
}

const SKIP_EVENT = /\b(cancel+ed|postponed|strategy session|collective bargaining|executive session|shade meeting)\b/i;

async function get(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml, */*' }, redirect: 'follow', cf: { cacheTtl: 900 } } as RequestInit);
    if (!r.ok) return null;
    const t = await r.text();
    return t.length > 50_000_000 ? null : t;
  } catch { return null; }
}

/** Finds a city's news and events feeds. Only feeds that actually parse with items are kept. */
export async function discoverFeeds(domain: string) {
  const host = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const tryList = async (urls: string[], wantEvents: boolean) => {
    for (const u of urls) {
      const xml = await get(u);
      if (!xml) continue;
      const items = parseRss(xml);
      if (!items.length) continue;
      if (wantEvents && !items.some((i) => eventWhen(i))) continue;
      return u;
    }
    return null;
  };
  // CivicPlus, then Granicus Vision (ctID 5 = news, 6 = calendar), then WordPress.
  const vision = `https://${host}/Home/Components/RssFeeds/RssFeed/View?ctID=`;
  const news = await tryList([`https://${host}/RSSFeed.aspx?ModID=1&CID=All-newsflash.xml`, `${vision}5`, `https://${host}/feed/`], false);
  const events = await tryList([`https://${host}/RSSFeed.aspx?ModID=58&CID=All-calendar.xml`, `${vision}6`], true);
  return { news, events };
}

// Places that are towns or villages rather than cities, for the source label.
/**
 * Cities whose sites have no RSS. Each reader uses one public page the city already publishes:
 * Fort Lauderdale lists every news story in its sitemap; Coconut Creek shows upcoming events on its home page.
 */
interface Extra { news: { title: string; url: string; published: string | null }[]; events: { title: string; url: string; starts: string; timeText: string | null }[] }
const slugTitle = (u: string) => decodeURIComponent(u.split('/').filter(Boolean).pop() ?? '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
const EXTRA: Record<string, () => Promise<Extra>> = {
  'fort-lauderdale': async () => {
    const xml = (await get('https://www.fortlauderdale.gov/sitemap.xml')) ?? '';
    const news = [...xml.matchAll(/<loc>([^<]+\/Residents\/City-News\/[^<\/]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)]
      .map((m) => ({ url: decode(m[1]), title: slugTitle(m[1]), published: m[2].slice(0, 19).replace('T', ' ') }))
      .filter((n) => n.title.length > 8)
      .sort((a, b) => b.published.localeCompare(a.published)).slice(0, 20);
    return { news, events: [] };
  },
  'coconut-creek': async () => {
    const html = (await get('https://www.coconutcreek.gov/')) ?? '';
    const events: Extra['events'] = [];
    for (const m of html.matchAll(/<a href="((?:https:\/\/www\.coconutcreek\.gov)?\/news-and-events\/events\/(\d{4})\/(\d{2})\/(\d{2})\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const title = text((m[5].match(/<h3[^>]*>([\s\S]*?)<\/h3>/) ?? [])[1] ?? '');
      const when = text((m[5].match(/class="date"[^>]*>([\s\S]*?)<\/div>/) ?? [])[1] ?? '');
      if (!title || SKIP_EVENT.test(title)) continue;
      const t = clock(when);
      const url = m[1].startsWith('http') ? m[1] : `https://www.coconutcreek.gov${m[1]}`;
      const timeText = when.replace(/^[A-Za-z]+\s+\d{1,2},\s*\d{4}\s*/, '').trim() || null;
      if (!events.some((e) => e.url === url)) events.push({ title, url, starts: `${m[2]}-${m[3]}-${m[4]}${t ? ` ${t}` : ''}`, timeText });
    }
    return { news: [], events };
  },
};

const TOWNS: Record<string, string> = { davie: 'Town', 'pembroke-park': 'Town', 'southwest-ranches': 'Town', 'lauderdale-by-the-sea': 'Town', 'hillsboro-beach': 'Town', 'lazy-lake': 'Village', 'sea-ranch-lakes': 'Village' };

type City = { slug: string; name: string; website: string | null; news_feed: string | null; events_feed: string | null; feeds_checked_at: string | null };

/** Refreshes a handful of cities per run (keeps each run under the platform's request limits). */
export async function refreshCityFeeds(db: D1Database, perRun = 4) {
  const { results: cities } = await db.prepare(`SELECT slug, name, website, news_feed, events_feed, feeds_checked_at FROM cities
    WHERE feeds_checked_at IS NULL OR feeds_checked_at < datetime('now', '-12 hours') ORDER BY feeds_checked_at IS NOT NULL, feeds_checked_at LIMIT ?`).bind(perRun).all<City>();
  let added = 0;
  const notes: string[] = [];
  for (const c of cities) {
    const candidates = c.website ? [c.website] : ([] as string[]).concat(CITY_SITES[c.slug] ?? []);
    let domain = candidates[0] ?? null;
    let { news_feed: news, events_feed: events } = c;
    // Look for feeds the first time, and again weekly while a city still has none.
    const due = !c.feeds_checked_at || (!news && !events && Date.parse(c.feeds_checked_at.replace(' ', 'T') + 'Z') < Date.now() - 7 * 864e5);
    if (due) {
      for (const d of candidates) {
        const found = await discoverFeeds(d);
        if (found.news || found.events) { news = found.news; events = found.events; domain = d; break; }
      }
    }
    const kind = TOWNS[c.slug] ?? 'City';
    const source = c.slug === 'unincorporated-broward' ? 'Broward County' : `${kind} of ${c.name}`;
    const stmts: D1PreparedStatement[] = [];
    if (news) {
      const items = parseRss((await get(news)) ?? '').slice(0, 25);
      for (const i of items) {
        const pub = i.pubDate && !Number.isNaN(Date.parse(i.pubDate)) ? new Date(i.pubDate).toISOString().slice(0, 19).replace('T', ' ') : null;
        const summary = i.description.replace(/\s+/g, ' ').slice(0, 240) || null;
        stmts.push(db.prepare(`INSERT INTO city_items (city_slug, kind, title, url, source, summary, published_at) VALUES (?, 'news', ?, ?, ?, ?, ?)
          ON CONFLICT(kind, url) DO UPDATE SET title = excluded.title, summary = excluded.summary, source = excluded.source, fetched_at = datetime('now')`)
          .bind(c.slug, i.title.slice(0, 300), i.link, source, summary, pub));
      }
    }
    if (events) {
      const items = parseRss((await get(events)) ?? '').slice(0, 60);
      for (const i of items) {
        if (SKIP_EVENT.test(i.title)) continue;
        const w = eventWhen(i);
        if (!w) continue;
        stmts.push(db.prepare(`INSERT INTO city_items (city_slug, kind, title, url, source, location, starts_at, ends_at, time_text) VALUES (?, 'event', ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(kind, url) DO UPDATE SET title = excluded.title, source = excluded.source, location = excluded.location, starts_at = excluded.starts_at, ends_at = excluded.ends_at, time_text = excluded.time_text, fetched_at = datetime('now')`)
          .bind(c.slug, eventTitle(i.title).slice(0, 300), i.link, source, i.location?.slice(0, 300) || null, w.starts, w.ends, w.timeText));
      }
    }
    const extra = EXTRA[c.slug] ? await EXTRA[c.slug]().catch(() => null) : null;
    for (const n of extra?.news ?? []) {
      stmts.push(db.prepare(`INSERT INTO city_items (city_slug, kind, title, url, source, published_at) VALUES (?, 'news', ?, ?, ?, ?)
        ON CONFLICT(kind, url) DO UPDATE SET title = excluded.title, source = excluded.source, fetched_at = datetime('now')`)
        .bind(c.slug, n.title.slice(0, 300), n.url, source, n.published));
    }
    for (const ev of extra?.events ?? []) {
      stmts.push(db.prepare(`INSERT INTO city_items (city_slug, kind, title, url, source, starts_at, time_text) VALUES (?, 'event', ?, ?, ?, ?, ?)
        ON CONFLICT(kind, url) DO UPDATE SET title = excluded.title, source = excluded.source, starts_at = excluded.starts_at, time_text = excluded.time_text, fetched_at = datetime('now')`)
        .bind(c.slug, ev.title.slice(0, 300), ev.url, source, ev.starts, ev.timeText));
    }
    stmts.push(db.prepare(`UPDATE cities SET website = COALESCE(website, ?), news_feed = ?, events_feed = ?, feeds_checked_at = datetime('now') WHERE slug = ?`)
      .bind(domain ? `https://${domain.replace(/^https?:\/\//, '')}` : null, news, events, c.slug));
    await db.batch(stmts);
    added += stmts.length - 1;
    notes.push(`${c.slug}:${news ? 'N' : '-'}${events ? 'E' : '-'}${extra ? `+${extra.news.length + extra.events.length}` : ''}`);
  }
  // Drop news older than 6 months and events that have finished.
  await db.prepare(`DELETE FROM city_items WHERE (kind = 'news' AND published_at < datetime('now', '-180 days')) OR (kind = 'event' AND COALESCE(ends_at, starts_at) < datetime('now', '-1 day'))`).run();
  return { read: cities.length, kept: added, note: notes.join(' ') || 'nothing due' };
}

export async function cityItems(db: D1Database, slug: string, kind: 'news' | 'event', limit = 6) {
  const sql = kind === 'event'
    ? `SELECT * FROM city_items WHERE city_slug = ? AND kind = 'event' AND COALESCE(ends_at, starts_at) >= datetime('now', '-5 hours') ORDER BY starts_at LIMIT ?`
    : `SELECT * FROM city_items WHERE city_slug = ? AND kind = 'news' ORDER BY published_at DESC LIMIT ?`;
  const { results } = await db.prepare(sql).bind(slug, limit).all<CityItem>().catch(() => ({ results: [] as CityItem[] }));
  return results;
}
/** Upcoming events or latest news across every Broward city, optionally one city. */
export async function browardItems(db: D1Database, kind: 'news' | 'event', limit = 30, city?: string | null) {
  const where = city ? 'AND i.city_slug = ?' : '';
  const sql = kind === 'event'
    ? `SELECT i.*, c.name AS city_name FROM city_items i LEFT JOIN cities c ON c.slug = i.city_slug WHERE i.kind = 'event' AND COALESCE(i.ends_at, i.starts_at) >= datetime('now', '-5 hours') ${where} ORDER BY i.starts_at LIMIT ?`
    : `SELECT i.*, c.name AS city_name FROM city_items i LEFT JOIN cities c ON c.slug = i.city_slug WHERE i.kind = 'news' ${where} ORDER BY i.published_at DESC LIMIT ?`;
  const st = city ? db.prepare(sql).bind(city, limit) : db.prepare(sql).bind(limit);
  const { results } = await st.all<CityItem & { city_name: string | null }>().catch(() => ({ results: [] as (CityItem & { city_name: string | null })[] }));
  return results;
}
/** Cities that have at least one current item, with counts, for filter chips. */
export async function feedCities(db: D1Database) {
  const { results } = await db.prepare(`SELECT i.city_slug, c.name, SUM(i.kind = 'event' AND COALESCE(i.ends_at, i.starts_at) >= datetime('now', '-5 hours')) AS events, SUM(i.kind = 'news') AS news
    FROM city_items i JOIN cities c ON c.slug = i.city_slug GROUP BY i.city_slug ORDER BY c.name`).all<{ city_slug: string; name: string; events: number; news: number }>().catch(() => ({ results: [] as { city_slug: string; name: string; events: number; news: number }[] }));
  return results;
}
export interface CityItem { id: number; city_slug: string; kind: string; title: string; url: string; source: string | null; summary: string | null; published_at: string | null; starts_at: string | null; ends_at: string | null; time_text: string | null; location: string | null }

/** "2026-12-02 16:00" → "Wed, Dec 2" */
export function eventDay(s: string | null) {
  if (!s) return '';
  const d = new Date(s.slice(0, 10) + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Broward headlines from local TV newsrooms. We keep only the headline, a link to the station's story, the station's name
 * and the date: no story text, no photos. Each station's robots.txt allows its RSS feed.
 * Violent-crime and death stories are left out; this is a business and community site.
 */
const STATIONS: { source: string; url: string; browardOnly: boolean }[] = [
  { source: 'WSVN 7News', url: 'https://wsvn.com/news/local/broward/feed/', browardOnly: true },
  { source: 'Local 10 News', url: 'https://www.local10.com/arc/outboundfeeds/rss/', browardOnly: false },
  { source: 'NBC 6 South Florida', url: 'https://www.nbcmiami.com/?rss=y&most_recent=y', browardOnly: false },
];
const GRIM = /\b(shot|shoot|shooting|gunfire|gunman|killed|kill|murder|homicide|stabb|dead|death|dies|died|fatal|body|bodies|arrest|charged|sentenced|suspect|robbery|assault|sex|abuse|overdose|drown|missing|manhunt|carjack|police chase|crash)/i;
// Longest names first so "North Lauderdale" wins over "Lauderdale". Words that are also ordinary words need a place cue.
const PLACES: [RegExp, string][] = Object.entries({
  'lauderdale-by-the-sea': 'Lauderdale[- ]By[- ]The[- ]Sea', 'north-lauderdale': 'North Lauderdale', 'lauderdale-lakes': 'Lauderdale Lakes',
  'fort-lauderdale': '(?:Fort|Ft\\.?) Lauderdale', 'hallandale-beach': 'Hallandale', 'deerfield-beach': 'Deerfield Beach', 'pompano-beach': 'Pompano',
  'dania-beach': 'Dania', 'hillsboro-beach': 'Hillsboro Beach', 'lighthouse-point': 'Lighthouse Point', 'pembroke-pines': 'Pembroke Pines',
  'pembroke-park': 'Pembroke Park', 'coconut-creek': 'Coconut Creek', 'coral-springs': 'Coral Springs', 'cooper-city': 'Cooper City',
  'oakland-park': 'Oakland Park', 'wilton-manors': 'Wilton Manors', 'southwest-ranches': 'Southwest Ranches', 'sea-ranch-lakes': 'Sea Ranch Lakes',
  'west-park': 'West Park', lauderhill: 'Lauderhill', tamarac: 'Tamarac', davie: 'Davie', miramar: 'Miramar',
  margate: '(?:in|of|near) Margate|Margate (?:police|city|fire|commission)', parkland: '(?:in|of|near) Parkland|Parkland (?:police|city|commission)|Parkland\\b(?=.*Broward)',
  weston: '(?:in|of|near) Weston|Weston (?:police|city|commission|neighborhood)', plantation: '(?:in|of|near) Plantation|Plantation (?:police|city|fire|commission)',
  sunrise: '(?:in|of|near) Sunrise\\b|Sunrise (?:police|city|fire|commission)|Amerant Bank Arena', hollywood: '(?:in|of|near) Hollywood\\b|Hollywood (?:Beach|police|city|fire|commission)',
}).map(([slug, re]) => [new RegExp(`\\b(?:${re})`, 'i'), slug]);
export function placeOf(text: string): string | null {
  for (const [re, slug] of PLACES) if (re.test(text)) return slug;
  return /\bBroward\b/i.test(text) ? 'broward' : null;
}

export async function refreshStationNews(db: D1Database) {
  const last = await db.prepare(`SELECT value FROM import_state WHERE key = 'station_news_at'`).first<{ value: string }>().catch(() => null);
  if (last && Date.now() - Date.parse(last.value) < 2 * 3600e3) return { read: 0, kept: 0, note: 'not due' };
  let read = 0;
  const stmts: D1PreparedStatement[] = [];
  const notes: string[] = [];
  for (const st of STATIONS) {
    const items = parseRss((await get(st.url)) ?? '');
    read += items.length;
    let kept = 0;
    for (const i of items) {
      if (GRIM.test(i.title)) continue;
      const slug = placeOf(i.title) ?? (st.browardOnly ? placeOf(i.description) ?? 'broward' : null);
      if (!slug) continue;
      const pub = i.pubDate && !Number.isNaN(Date.parse(i.pubDate)) ? new Date(i.pubDate).toISOString().slice(0, 19).replace('T', ' ') : null;
      stmts.push(db.prepare(`INSERT INTO city_items (city_slug, kind, title, url, source, published_at) VALUES (?, 'news', ?, ?, ?, ?)
        ON CONFLICT(kind, url) DO UPDATE SET title = excluded.title, fetched_at = datetime('now')`).bind(slug, i.title.slice(0, 300), i.link, st.source, pub));
      kept++;
    }
    notes.push(`${st.source}:${kept}/${items.length}`);
  }
  // Station headlines age quickly; keep 45 days of them.
  stmts.push(db.prepare(`DELETE FROM city_items WHERE kind = 'news' AND source IN (${STATIONS.map(() => '?').join(',')}) AND published_at < datetime('now', '-45 days')`).bind(...STATIONS.map((s) => s.source)));
  stmts.push(db.prepare(`INSERT INTO import_state (key, value) VALUES ('station_news_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(new Date().toISOString()));
  await db.batch(stmts);
  return { read, kept: stmts.length - 2, note: notes.join(' ') };
}
