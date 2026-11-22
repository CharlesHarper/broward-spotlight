import type { APIRoute } from 'astro';
import { env } from '../../lib/util';
import { SESSION_COOKIE } from '../../lib/owner';

export const POST: APIRoute = async ({ locals, cookies, redirect }) => {
  const id = cookies.get(SESSION_COOKIE)?.value;
  if (id) await env(locals).DB.prepare(`DELETE FROM owner_sessions WHERE id = ?`).bind(id).run();
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect('/owner/login?out=1', 303);
};
