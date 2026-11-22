// Owner sign-in: a one-time link by email starts a session kept in an HttpOnly cookie.
import type { AstroCookies } from 'astro';

export const SESSION_COOKIE = 'bs_owner';
export const SESSION_DAYS = 60;
export const LOGIN_MINUTES = 30;

/** The signed-in owner's email, or null. */
export async function ownerEmail(db: D1Database, cookies: AstroCookies): Promise<string | null> {
  const id = cookies.get(SESSION_COOKIE)?.value;
  if (!id || !/^[a-f0-9]{40,80}$/.test(id)) return null;
  const row = await db.prepare(`SELECT email FROM owner_sessions WHERE id = ? AND expires_at > datetime('now')`).bind(id).first<{ email: string }>().catch(() => null);
  return row?.email ?? null;
}

/** Claimed listings this email manages. */
export async function ownedListings(db: D1Database, email: string) {
  const { results } = await db.prepare(`SELECT id, slug, name, city, category, owner_token FROM businesses WHERE claimed = 1 AND lower(owner_email) = lower(?) AND status != 'hidden' ORDER BY name`)
    .bind(email).all<{ id: number; slug: string; name: string; city: string | null; category: string; owner_token: string }>();
  return results;
}
