import type { APIRoute } from 'astro';
import { CATEGORIES } from '../lib/shared';
export const GET: APIRoute = async ({ locals }) => {
  const e = locals.runtime.env;
  const { results } = await e.DB.prepare(`SELECT c.slug FROM cities c WHERE EXISTS (SELECT 1 FROM businesses b WHERE b.city_slug = c.slug AND b.status = 'active')`).all<{ slug: string }>();
  const urls = ['/', '/cities', '/categories', '/inspections', '/advertise', '/add-business', '/claim', '/how-it-works',
    ...results.map((r) => `/city/${r.slug}`), ...CATEGORIES.map((c) => `/category/${c.slug}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${e.SITE_URL}${u}</loc></url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' } });
};
