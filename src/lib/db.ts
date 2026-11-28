import { subcatWhere, type Subcat } from './subcats';
import type { Tone } from './shared';

export interface Business {
  id: number; slug: string; name: string; category: string; subtype: string | null;
  address: string | null; city: string | null; city_slug: string | null; zip: string | null;
  phone: string | null; website: string | null; email: string | null; facebook: string | null; instagram: string | null;
  description: string | null; hours: string | null; license_holder: string | null; source: string;
  dbpr_license: string | null; license_status: string | null; license_expires: string | null; seats: number | null;
  last_inspection_date: string | null; last_inspection_disposition: string | null; last_inspection_tone: Tone | null;
  claimed: number; status: string; featured?: number;
  btr_account: number | null; btr_category: string | null; started_on: string | null; hide_street: number;
  lat: number | null; lng: number | null; description_len?: number;
  osm_id: string | null; website_source: string | null;
}
export interface Inspection {
  id: number; visit_id: string; date: string; type: string | null; disposition: string | null; tone: Tone;
  total_violations: number | null; high_priority: number | null; intermediate: number | null; basic: number | null;
  business_id?: number; name?: string; slug?: string; city?: string;
}
export interface Review {
  id: number; business_id: number; name: string; rating: number; body: string; status: string;
  owner_response: string | null; owner_response_at: string | null; created_at: string; email?: string; business_name?: string; business_slug?: string;
}

export const PAGE_SIZE = 24;

/** One rule for "this listing is worth indexing", shared by the sitemap and the listing page's noindex. Empty strings count as missing. */
export const INDEXABLE_SQL = `(source != 'county' OR claimed = 1 OR TRIM(COALESCE(description, '')) != '' OR TRIM(COALESCE(phone, '')) != '' OR TRIM(COALESCE(website, '')) != ''
  OR EXISTS (SELECT 1 FROM reviews r WHERE r.business_id = businesses.id AND r.status = 'approved')
  OR EXISTS (SELECT 1 FROM mentions m WHERE m.business_id = businesses.id))`;
const filled = (v: unknown) => typeof v === 'string' ? v.trim() !== '' : v != null;
export function isThin(b: { source: string; claimed: number | boolean; description?: string | null; phone?: string | null; website?: string | null }, reviews: number, mentions: number) {
  return b.source === 'county' && !b.claimed && !filled(b.description) && !filled(b.phone) && !filled(b.website) && reviews === 0 && mentions === 0;
}
/** Extra columns every listing card uses: the first owner photo and the review summary. */
export const CARD_EXTRAS = `(SELECT p.key FROM photos p WHERE p.business_id = b.id AND p.status = 'live' ORDER BY p.id LIMIT 1) AS photo_key,
  (SELECT COUNT(*) FROM reviews r WHERE r.business_id = b.id AND r.status = 'approved') AS review_n,
  (SELECT ROUND(AVG(rating), 1) FROM reviews r WHERE r.business_id = b.id AND r.status = 'approved') AS review_avg`;
const today = () => new Date().toISOString().slice(0, 10);

const ACTIVE_PLACEMENT = `EXISTS (SELECT 1 FROM placements p WHERE p.business_id = b.id AND p.starts_on <= ?1 AND p.ends_on >= ?1
  AND (p.city_slug IS NULL OR p.city_slug = ?2) AND (p.category IS NULL OR p.category = ?3))`;

/** Featured spots sold per city + category page. */
export const FEATURED_SPOTS = 3;
export async function spotsTaken(db: D1Database, city: string | null, category: string | null) {
  const r = await db.prepare(`SELECT COUNT(DISTINCT business_id) AS n FROM placements WHERE starts_on <= ?1 AND ends_on >= ?1 AND city_slug IS ?2 AND category IS ?3`)
    .bind(today(), city, category).first<{ n: number }>();
  return r?.n ?? 0;
}

/** Paid Featured listings for a page scope. Always shown separately and labeled. */
export async function featured(db: D1Database, opts: { city?: string | null; category?: string | null; limit?: number }) {
  const { results } = await db
    .prepare(
      `SELECT b.*, ${CARD_EXTRAS}, 1 AS featured FROM businesses b WHERE b.status = 'active' AND ${ACTIVE_PLACEMENT}
       ORDER BY random() LIMIT ?4`,
    )
    .bind(today(), opts.city ?? null, opts.category ?? null, opts.limit ?? 3)
    .all<Business>();
  return results;
}

export async function listBusinesses(
  db: D1Database,
  opts: { city?: string | null; category?: string | null; sub?: Subcat | null; page?: number },
) {
  const where = [`b.status = 'active'`];
  const binds: unknown[] = [];
  if (opts.city) { where.push(`b.city_slug = ?${binds.length + 1}`); binds.push(opts.city); }
  if (opts.category) { where.push(`b.category = ?${binds.length + 1}`); binds.push(opts.category); }
  if (opts.sub) { const sw = subcatWhere(opts.sub, binds.length + 1); where.push(sw.sql); binds.push(...sw.binds); }
  const page = Math.max(1, opts.page ?? 1);
  const w = where.join(' AND ');
  const [rows, count] = await db.batch([
    db.prepare(`SELECT b.*, ${CARD_EXTRAS} FROM businesses b WHERE ${w} ORDER BY b.claimed DESC, (b.website IS NOT NULL OR b.phone IS NOT NULL) DESC, (b.last_inspection_date IS NOT NULL) DESC, b.name COLLATE NOCASE LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`).bind(...binds),
    db.prepare(`SELECT COUNT(*) AS n FROM businesses b WHERE ${w}`).bind(...binds),
  ]);
  return { items: rows.results as unknown as Business[], total: (count.results[0] as { n: number }).n, page };
}

/** Turn free text into a safe FTS5 query: each word becomes a quoted prefix term. */
export function ftsQuery(q: string): string | null {
  const words = q.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, 8) ?? [];
  if (!words.length) return null;
  return words.map((w) => `"${w}"*`).join(' ');
}

export async function search(db: D1Database, q: string, opts: { city?: string | null; category?: string | null; sub?: Subcat | null; page?: number }) {
  const fq = ftsQuery(q);
  const page = Math.max(1, opts.page ?? 1);
  if (!fq) return listBusinesses(db, opts);
  const where = [`businesses_fts MATCH ?1`, `b.status = 'active'`];
  const binds: unknown[] = [fq];
  if (opts.city) { where.push(`b.city_slug = ?${binds.length + 1}`); binds.push(opts.city); }
  if (opts.category) { where.push(`b.category = ?${binds.length + 1}`); binds.push(opts.category); }
  if (opts.sub) { const sw = subcatWhere(opts.sub, binds.length + 1); where.push(sw.sql); binds.push(...sw.binds); }
  const w = where.join(' AND ');
  const [rows, count] = await db.batch([
    db.prepare(`SELECT b.*, ${CARD_EXTRAS} FROM businesses_fts JOIN businesses b ON b.id = businesses_fts.rowid WHERE ${w}
      ORDER BY bm25(businesses_fts, 10.0, 2.0, 2.0, 1.0) - b.claimed * 4.0
        - ((b.last_inspection_date IS NOT NULL) + (b.phone IS NOT NULL) + (b.website IS NOT NULL)) * 0.75 LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`).bind(...binds),
    db.prepare(`SELECT COUNT(*) AS n FROM businesses_fts JOIN businesses b ON b.id = businesses_fts.rowid WHERE ${w}`).bind(...binds),
  ]);
  return { items: rows.results as unknown as Business[], total: (count.results[0] as { n: number }).n, page };
}

/** How many matches a search has in each category, for the filter chips. */
export async function searchCategories(db: D1Database, q: string, city: string | null) {
  const fq = ftsQuery(q);
  if (!fq) return [];
  const binds: unknown[] = [fq];
  let w = `businesses_fts MATCH ?1 AND b.status = 'active'`;
  if (city) { w += ` AND b.city_slug = ?2`; binds.push(city); }
  const { results } = await db.prepare(`SELECT b.category, COUNT(*) AS n FROM businesses_fts JOIN businesses b ON b.id = businesses_fts.rowid
    WHERE ${w} GROUP BY b.category ORDER BY n DESC`).bind(...binds).all<{ category: string; n: number }>();
  return results;
}

export async function getBusiness(db: D1Database, slug: string) {
  return db.prepare(`SELECT * FROM businesses WHERE slug = ? AND status != 'hidden' AND NOT (status = 'inactive' AND source = 'county')`).bind(slug).first<Business>();
}

export async function businessDetail(db: D1Database, b: Business) {
  const [insp, reviews, mentions, stats, photos] = await db.batch([
    db.prepare(`SELECT * FROM inspections WHERE business_id = ? ORDER BY date DESC LIMIT 40`).bind(b.id),
    db.prepare(`SELECT id, business_id, name, rating, body, status, owner_response, owner_response_at, created_at
      FROM reviews WHERE business_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 50`).bind(b.id),
    db.prepare(`SELECT * FROM mentions WHERE business_id = ? ORDER BY published_on DESC LIMIT 20`).bind(b.id),
    db.prepare(`SELECT COUNT(*) AS n, ROUND(AVG(rating), 1) AS avg FROM reviews WHERE business_id = ? AND status = 'approved'`).bind(b.id),
    db.prepare(`SELECT id, key, width, height, caption FROM photos WHERE business_id = ? AND status = 'live' ORDER BY id LIMIT 6`).bind(b.id),
  ]);
  return {
    inspections: insp.results as unknown as Inspection[],
    reviews: reviews.results as unknown as Review[],
    mentions: mentions.results as unknown as { title: string; url: string; source: string; summary: string | null; published_on: string | null }[],
    reviewStats: stats.results[0] as { n: number; avg: number | null },
    photos: photos.results as unknown as { id: number; key: string; width: number | null; height: number | null; caption: string | null }[],
  };
}

/** Other listings of the same kind in the same city. Fuller listings first, then the nearest neighbours so every page links to different ones. */
export async function related(db: D1Database, b: Business, limit = 6) {
  if (!b.city_slug) return [];
  const { results } = await db.prepare(`SELECT b.*, ${CARD_EXTRAS} FROM businesses b WHERE city_slug = ?1 AND category = ?2 AND status = 'active' AND id != ?3
    ORDER BY claimed DESC, (website IS NOT NULL) DESC, (phone IS NOT NULL) DESC, (last_inspection_date IS NOT NULL) DESC, ABS(b.id - ?3) LIMIT ?4`)
    .bind(b.city_slug, b.category, b.id, limit).all<Business>();
  return results;
}

export async function cityStats(db: D1Database, city: string) {
  const since90 = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const since365 = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const [total, cats, insp, recent, closures] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS n, SUM(claimed) AS claimed FROM businesses WHERE city_slug = ? AND status = 'active'`).bind(city),
    db.prepare(`SELECT category, COUNT(*) AS n FROM businesses WHERE city_slug = ? AND status = 'active' GROUP BY category ORDER BY n DESC`).bind(city),
    db.prepare(`SELECT i.tone, COUNT(*) AS n FROM inspections i JOIN businesses b ON b.id = i.business_id
      WHERE b.city_slug = ? AND i.date >= ? GROUP BY i.tone`).bind(city, since90),
    db.prepare(`SELECT i.*, b.name, b.slug, b.city FROM inspections i JOIN businesses b ON b.id = i.business_id
      WHERE b.city_slug = ? ORDER BY i.date DESC, i.id DESC LIMIT 8`).bind(city),
    db.prepare(`SELECT COUNT(DISTINCT i.business_id) AS n FROM inspections i JOIN businesses b ON b.id = i.business_id
      WHERE b.city_slug = ? AND i.date >= ? AND i.disposition LIKE '%EMERGENCY ORDER%'`).bind(city, since365),
  ]);
  const t = total.results[0] as { n: number; claimed: number | null };
  const tones = Object.fromEntries((insp.results as { tone: string; n: number }[]).map((r) => [r.tone, r.n]));
  const inspected90 = Object.values(tones).reduce((a: number, b) => a + (b as number), 0);
  return {
    listings: t.n,
    claimed: t.claimed ?? 0,
    categories: cats.results as { category: string; n: number }[],
    inspected90,
    tones: tones as Record<string, number>,
    recent: recent.results as unknown as Inspection[],
    closures365: (closures.results[0] as { n: number }).n,
  };
}

export async function recentFlagged(db: D1Database, days = 14, limit = 60) {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const [rows, summary] = await db.batch([
    db.prepare(`SELECT i.*, b.name, b.slug, b.city FROM inspections i JOIN businesses b ON b.id = i.business_id
      WHERE i.date >= ? AND i.tone IN ('warn', 'alert') ORDER BY i.date DESC, i.tone ASC LIMIT ?`).bind(since, limit),
    db.prepare(`SELECT tone, COUNT(*) AS n FROM inspections WHERE date >= ? GROUP BY tone`).bind(since),
  ]);
  return {
    since,
    items: rows.results as unknown as Inspection[],
    tones: Object.fromEntries((summary.results as { tone: string; n: number }[]).map((r) => [r.tone, r.n])) as Record<string, number>,
  };
}

export async function activeAd(db: D1Database, slot: 'home' | 'city' | 'category', scope?: string | null) {
  return db
    .prepare(`SELECT * FROM ads WHERE slot = ? AND (scope_slug IS NULL OR scope_slug = ?) AND starts_on <= ? AND ends_on >= ?
      ORDER BY scope_slug IS NULL, random() LIMIT 1`)
    .bind(slot, scope ?? null, today(), today())
    .first<{ advertiser: string; image_url: string; link_url: string; alt: string }>();
}

export async function cityRow(db: D1Database, slug: string) {
  return db.prepare(`SELECT * FROM cities WHERE slug = ?`).bind(slug).first<{ slug: string; name: string; intro: string | null; website?: string | null }>();
}

export async function cityCounts(db: D1Database) {
  const { results } = await db
    .prepare(`SELECT c.slug, c.name, (SELECT COUNT(*) FROM businesses b WHERE b.city_slug = c.slug AND b.status = 'active') AS n
      FROM cities c ORDER BY c.name`)
    .all<{ slug: string; name: string; n: number }>();
  return results;
}
