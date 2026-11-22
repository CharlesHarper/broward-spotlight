import type { APIRoute } from 'astro';
import { env, ghl, isEmail, looksLikeBot, str, token } from '../../../lib/util';
import { LOGIN_MINUTES, ownedListings } from '../../../lib/owner';

// Emails a one-time sign-in link to an owner. The reply is the same whether or not the email
// manages a listing, so the form can't be used to find out who owns what.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  const f = await request.formData();
  const email = str(f.get('email'), 200).toLowerCase();
  const done = redirect('/owner/login?sent=1', 303);
  if (looksLikeBot(f) || !isEmail(email)) return done;
  const listings = await ownedListings(e.DB, email);
  if (!listings.length) return done;
  // At most 5 links per email per hour.
  const recent = await e.DB.prepare(`SELECT COUNT(*) AS n FROM owner_logins WHERE email = ? AND created_at > datetime('now', '-1 hour')`).bind(email).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) return done;
  const t = token(32);
  await e.DB.prepare(`INSERT INTO owner_logins (token, email, expires_at) VALUES (?, ?, datetime('now', '+${LOGIN_MINUTES} minutes'))`).bind(t, email).run();
  const site = e.SITE_URL.replace(/\/$/, '');
  await ghl(e, 'owner_login', {
    email,
    business_name: listings.length === 1 ? listings[0].name : `${listings.length} listings`,
    owner_url: `${site}/owner/signin?t=${t}`,
  });
  return done;
};
