import { defineMiddleware } from 'astro:middleware';

function unauthorized() {
  return new Response('Admin sign-in required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Broward Spotlight admin", charset="UTF-8"' } });
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const p = ctx.url.pathname;
  if (p.startsWith('/admin') || p.startsWith('/api/admin')) {
    const pw = ctx.locals.runtime?.env?.ADMIN_PASSWORD;
    if (!pw) return new Response('Set the ADMIN_PASSWORD secret to use the admin.', { status: 503 });
    const h = ctx.request.headers.get('authorization') ?? '';
    const [scheme, enc] = h.split(' ');
    if (scheme !== 'Basic' || !enc) return unauthorized();
    let user = '', pass = '';
    try { [user, pass] = atob(enc).split(/:(.*)/s); } catch { return unauthorized(); }
    if (user !== 'admin' || pass !== pw) return unauthorized();
    const res = await next();
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Robots-Tag', 'noindex');
    return res;
  }
  const res = await next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return res;
});
