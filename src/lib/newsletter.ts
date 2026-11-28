import { ghl } from './util';

/** Subscribers are kept here for counts (useful when selling a sponsor spot) and in HighLevel, which sends the email. */
export async function ensureSubscribers(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS subscribers (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, city_slug TEXT, source TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`).run();
}

export async function subscribe(e: Env, email: string, city: string | null, source: string) {
  await ensureSubscribers(e.DB);
  const r = await e.DB.prepare(`INSERT INTO subscribers (email, city_slug, source) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET city_slug = COALESCE(excluded.city_slug, city_slug) RETURNING (created_at >= datetime('now', '-5 seconds')) AS fresh`)
    .bind(email, city, source).first<{ fresh: number }>();
  await ghl(e, 'newsletter_signup', { email, city: city ?? '', signup_source: source, tags: ['weekly-newsletter', ...(city ? [`city-${city}`] : [])] });
  return !!r?.fresh;
}

export async function subscriberCount(db: D1Database) {
  await ensureSubscribers(db);
  return (await db.prepare(`SELECT COUNT(*) AS n FROM subscribers`).first<{ n: number }>())?.n ?? 0;
}

/** Monday 00:00 (Eastern, approximated as UTC-5) of the week containing `d`, as YYYY-MM-DD. */
export function weekStart(d = new Date()) {
  const et = new Date(d.getTime() - 5 * 3600e3);
  const dow = (et.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(et.getUTCFullYear(), et.getUTCMonth(), et.getUTCDate() - dow)).toISOString().slice(0, 10);
}

export const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const rfc822 = (s: string) => new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z').toUTCString();
