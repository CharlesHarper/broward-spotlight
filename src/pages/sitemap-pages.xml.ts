import type { APIRoute } from 'astro';
import { CATEGORIES } from '../lib/shared';
import { listStories } from '../lib/stories';
import { subcatsFor, subcatCounts } from '../lib/subcats';
export const GET: APIRoute = async ({ locals }) => {
  const e = locals.runtime.env;
  const { results } = await e.DB.prepare(`SELECT c.slug FROM cities c WHERE EXISTS (SELECT 1 FROM businesses b WHERE b.city_slug = c.slug AND b.status = 'active')`).all<{ slug: string }>();
  const urls = ['/', '/cities', '/categories', '/inspections', '/news', '/advertise', '/add-business', '/claim', '/how-it-works', '/about',
    ...results.map((r) => `/city/${r.slug}`), ...CATEGORIES.map((c) => `/category/${c.slug}`)];
  const combos = await e.DB.prepare(`SELECT city_slug, category, COUNT(*) AS n FROM businesses WHERE status = 'active' AND city_slug IN (SELECT slug FROM cities)
    GROUP BY city_slug, category HAVING n >= 5`).all<{ city_slug: string; category: string }>();
  for (const c of combos.results) urls.push(`/city/${c.city_slug}/${c.category}`);
  // City news and events pages that have enough items.
  const feeds = await e.DB.prepare(`SELECT city_slug, kind, COUNT(*) AS n FROM city_items WHERE kind = 'news' OR COALESCE(ends_at, starts_at) >= datetime('now', '-5 hours') GROUP BY city_slug, kind HAVING n >= (CASE kind WHEN 'event' THEN 5 ELSE 3 END)`).all<{ city_slug: string; kind: string }>().catch(() => ({ results: [] as { city_slug: string; kind: string }[] }));
  for (const f of feeds.results) urls.push(`/city/${f.city_slug}/${f.kind === 'event' ? 'events' : 'news'}`);
  // Sub-category landing pages such as /category/auto/tint-wraps, when they have listings.
  for (const cat of CATEGORIES) {
    if (!subcatsFor(cat.slug).length) continue;
    const counts = await subcatCounts(e.DB, cat.slug).catch(() => ({} as Record<string, number>));
    for (const sc of subcatsFor(cat.slug)) if ((counts[sc.slug] ?? 0) >= 3) urls.push(`/category/${cat.slug}/${sc.slug}`);
  }
  // Spotlight stories from the HighLevel blog, shown on this site at /post/<slug>.
  const stories = await listStories(200).catch(() => []);
  if (stories.length) urls.push('/stories', ...stories.map((st) => `/post/${st.slug}`));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${e.SITE_URL}${u}</loc></url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' } });
};
