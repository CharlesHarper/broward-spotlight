import { defineMiddleware } from 'astro:middleware';

function unauthorized() {
  return new Response('Admin sign-in required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Broward Spotlight admin", charset="UTF-8"' } });
}

const MAIN_HOST = 'browardspotlight.com';
// Addresses from the earlier GoHighLevel site, sent to their new homes.
const LEGACY: Record<string, string> = {
  '/home': '/', '/contact-us': '/about#contact', '/spotlights': '/categories', '/featured-businesses': '/categories', '/get-featured': '/advertise',
  '/spotlights/category/automotive': '/category/auto', '/spotlights/category/home-services': '/category/home-services',
  '/spotlights/category/health-wellness': '/category/health', '/spotlights/category/beauty': '/category/beauty',
  '/spotlights/category/food-drink': '/category/restaurants', '/spotlights/category/professional-services': '/category/professional',
};

export const onRequest = defineMiddleware(async (ctx, next) => {
  const p = ctx.url.pathname;
  const host = ctx.url.hostname;
  if (host === `www.${MAIN_HOST}` || host === `directory.${MAIN_HOST}`) {
    return Response.redirect(`https://${MAIN_HOST}${p}${ctx.url.search}`, 301);
  }
  const legacy = LEGACY[p.replace(/\/$/, '') || '/'];
  if (legacy && p !== '/') return Response.redirect(new URL(legacy, ctx.url).toString(), 301);
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
