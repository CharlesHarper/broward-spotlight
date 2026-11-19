import type { APIRoute } from 'astro';

const PER = 20000;
export const GET: APIRoute = async ({ locals }) => {
  const e = locals.runtime.env;
  const n = (await e.DB.prepare(`SELECT COUNT(*) AS n FROM businesses WHERE status = 'active' AND (source != 'county' OR claimed = 1 OR description IS NOT NULL OR phone IS NOT NULL OR website IS NOT NULL OR EXISTS (SELECT 1 FROM reviews r WHERE r.business_id = businesses.id AND r.status = 'approved'))`).first<{ n: number }>())?.n ?? 0;
  const parts = Math.max(1, Math.ceil(n / PER));
  const maps = [`${e.SITE_URL}/sitemap-pages.xml`, ...Array.from({ length: parts }, (_, i) => `${e.SITE_URL}/sitemap-${i + 1}.xml`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${maps.map((m) => `<sitemap><loc>${m}</loc></sitemap>`).join('')}</sitemapindex>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' } });
};
