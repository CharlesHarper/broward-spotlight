import type { APIRoute } from 'astro';
import { env, token } from '../../lib/util';
import { SESSION_COOKIE, SESSION_DAYS } from '../../lib/owner';

// Opens from the emailed sign-in link: uses up the link and starts a session.
export const GET: APIRoute = async ({ url, locals, cookies, redirect }) => {
  const e = env(locals);
  const t = url.searchParams.get('t') ?? '';
  if (!/^[a-f0-9]{40,80}$/.test(t)) return redirect('/owner/login?expired=1', 303);
  const row = await e.DB.prepare(`UPDATE owner_logins SET used_at = datetime('now') WHERE token = ? AND used_at IS NULL AND expires_at > datetime('now') RETURNING email`)
    .bind(t).first<{ email: string }>();
  if (!row) return redirect('/owner/login?expired=1', 303);
  const id = token(32);
  await e.DB.prepare(`INSERT INTO owner_sessions (id, email, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`).bind(id, row.email).run();
  cookies.set(SESSION_COOKIE, id, { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: SESSION_DAYS * 86400 });
  return redirect('/owner', 303);
};
