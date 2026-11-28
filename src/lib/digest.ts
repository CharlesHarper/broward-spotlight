import { CITY_NAMES } from './shared';
import { cityPhotoUrl } from '../data/cities';
import { eventDay } from './citynews';
import { weekStart } from './newsletter';

export interface DigestItem { guid: string; title: string; link: string; description: string; pubDate: string; image: string | null; kind: 'event' | 'news' | 'inspections' | 'city' }

const abs = (site: string, p: string | null) => (p ? (p.startsWith('http') ? p : `${site}${p}`) : null);

/** Inspection counts for a date window, overall and per city. */
export async function inspectionWindow(db: D1Database, from: string, to: string) {
  const { results } = await db.prepare(`SELECT b.city_slug AS city, i.tone, COUNT(*) AS n FROM inspections i JOIN businesses b ON b.id = i.business_id
    WHERE i.date >= ? AND i.date < ? GROUP BY b.city_slug, i.tone`).bind(from, to).all<{ city: string | null; tone: string; n: number }>();
  const byCity: Record<string, { ok: number; warn: number; alert: number; total: number }> = {};
  const all = { ok: 0, warn: 0, alert: 0, total: 0 };
  for (const r of results) {
    const t = (r.tone === 'ok' || r.tone === 'warn' || r.tone === 'alert') ? r.tone : null;
    const c = (byCity[r.city ?? ''] ??= { ok: 0, warn: 0, alert: 0, total: 0 });
    c.total += r.n; all.total += r.n;
    if (t) { c[t] += r.n; all[t] += r.n; }
  }
  return { all, byCity };
}

/**
 * The weekly email's items: the inspection roundup, upcoming events and recent news.
 * HighLevel's RSS schedule sends whatever is new since its last send, so each item is dated when it first appeared.
 */
export async function weeklyItems(db: D1Database, site: string): Promise<DigestItem[]> {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 864e5).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  const insp = await inspectionWindow(db, from, to);
  const items: DigestItem[] = [];
  if (insp.all.total) {
    items.push({ guid: `inspections-${to}`, kind: 'inspections', link: `${site}/inspections`, image: `${site}/og.png`, pubDate: now.toUTCString(),
      title: `Restaurant inspections this week: ${insp.all.ok.toLocaleString()} passed, ${insp.all.warn.toLocaleString()} warnings, ${insp.all.alert.toLocaleString()} closed`,
      description: `Florida inspectors visited ${insp.all.total.toLocaleString()} Broward food businesses in the last seven days. See which ones got warnings or were ordered closed, explained in plain words.` });
  }
  const { results: ev } = await db.prepare(`SELECT i.*, c.name AS city_name FROM city_items i JOIN cities c ON c.slug = i.city_slug WHERE i.kind = 'event'
    AND i.starts_at >= datetime('now', '-5 hours') AND i.starts_at < datetime('now', '+10 days') ORDER BY i.starts_at LIMIT 60`).all<any>();
  // A few per city so one busy calendar doesn't fill the email.
  const perCity: Record<string, number> = {};
  for (const e of ev) {
    if ((perCity[e.city_slug] = (perCity[e.city_slug] ?? 0) + 1) > 3) continue;
    if (/\b(meeting|board|committee|workshop|hearing|budget|agenda|council)\b/i.test(e.title) && items.length > 6) continue;
    items.push({ guid: `ev-${e.id}`, kind: 'event', link: e.url, image: abs(site, cityPhotoUrl(e.city_slug, 640)), pubDate: new Date((e.fetched_at as string).replace(' ', 'T') + 'Z').toUTCString(),
      title: `${eventDay(e.starts_at)} · ${e.city_name}: ${e.title}`, description: [e.time_text, (e.location ?? '').split('\n')[0]].filter(Boolean).join(' · ') || `Upcoming in ${e.city_name}.` });
    if (items.filter((x) => x.kind === 'event').length >= 14) break;
  }
  const { results: nw } = await db.prepare(`SELECT i.*, c.name AS city_name FROM city_items i LEFT JOIN cities c ON c.slug = i.city_slug WHERE i.kind = 'news'
    AND i.published_at >= datetime('now', '-7 days') ORDER BY i.published_at DESC LIMIT 40`).all<any>();
  const seen: Record<string, number> = {};
  for (const n of nw) {
    const k = n.city_slug + n.source;
    if ((seen[k] = (seen[k] ?? 0) + 1) > 2) continue;
    items.push({ guid: `news-${n.id}`, kind: 'news', link: n.url, image: abs(site, cityPhotoUrl(n.city_slug, 640)), pubDate: new Date((n.fetched_at as string).replace(' ', 'T') + 'Z').toUTCString(),
      title: `${n.city_name ?? 'Broward'}: ${n.title}`, description: n.source ?? '' });
    if (items.filter((x) => x.kind === 'news').length >= 10) break;
  }
  return items;
}

/**
 * Social posts: one per city per week for the inspection roundup and for what's coming up, linking back to our pages.
 * Dated through the week so the Social Planner publishes a few a day instead of all at once.
 */
export async function socialItems(db: D1Database, site: string): Promise<DigestItem[]> {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 864e5).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  const week = weekStart(now);
  const insp = await inspectionWindow(db, from, to);
  const items: DigestItem[] = [];
  let slot = 0;
  const at = () => new Date(now.getTime() - (slot++ % 6) * 3600e3).toUTCString();
  const { results: evCounts } = await db.prepare(`SELECT city_slug, COUNT(*) AS n, GROUP_CONCAT(title, ' | ') AS titles FROM (SELECT city_slug, title FROM city_items WHERE kind = 'event'
    AND starts_at >= datetime('now', '-5 hours') AND starts_at < datetime('now', '+8 days') ORDER BY starts_at) GROUP BY city_slug HAVING n >= 3`).all<{ city_slug: string; n: number; titles: string }>();
  for (const e of evCounts) {
    const name = CITY_NAMES[e.city_slug]; if (!name) continue;
    const top = e.titles.split(' | ').filter((t) => !/\b(meeting|board|committee|hearing|agenda)\b/i.test(t)).slice(0, 3);
    items.push({ guid: `social-ev-${e.city_slug}-${week}`, kind: 'city', link: `${site}/city/${e.city_slug}/events?week=${week}`, image: abs(site, cityPhotoUrl(e.city_slug)), pubDate: at(),
      title: `What's happening in ${name} this week: ${e.n} events on the city calendar`, description: top.length ? `Including ${top.join(', ')}. Full list and times:` : 'Full list and times:' });
  }
  for (const [city, c] of Object.entries(insp.byCity)) {
    const name = CITY_NAMES[city]; if (!name || c.total < 4) continue;
    const parts = [`${c.ok} passed`, c.warn ? `${c.warn} got warnings or follow-ups` : '', c.alert ? `${c.alert} ${c.alert === 1 ? 'was' : 'were'} ordered closed` : ''].filter(Boolean);
    items.push({ guid: `social-insp-${city}-${week}`, kind: 'inspections', link: `${site}/city/${city}?week=${week}#inspections`, image: abs(site, cityPhotoUrl(city)), pubDate: at(),
      title: `${name} restaurant inspections this week: ${parts.join(', ')}`, description: `State inspectors checked ${c.total} ${name} food businesses in the last 7 days. See every result in plain words:` });
  }
  return items;
}

export function rss(site: string, title: string, description: string, selfPath: string, items: DigestItem[]) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(title)}</title>
<link>${site}/</link>
<description>${esc(description)}</description>
<language>en-us</language>
<image><url>${site}/og.png</url><title>${esc(title)}</title><link>${site}/</link></image>
<atom:link href="${site}${selfPath}" rel="self" type="application/rss+xml" />
${items.map((i) => `<item>
<title>${esc(i.title)}</title>
<link>${esc(i.link)}</link>
<guid isPermaLink="false">${esc(i.guid)}</guid>
<pubDate>${i.pubDate}</pubDate>
<description>${esc(i.description)}</description>${i.image ? `
<enclosure url="${esc(i.image)}" type="image/jpeg" length="0" />
<media:content url="${esc(i.image)}" medium="image" />` : ''}
</item>`).join('\n')}
</channel>
</rss>`;
}
