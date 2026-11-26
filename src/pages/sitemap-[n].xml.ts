import type { APIRoute } from 'astro';
import { INDEXABLE_SQL } from '../lib/db';
const PER = 20000;
export const GET: APIRoute = async ({ locals, params }) => {
  const e = locals.runtime.env;
  const n = Math.max(1, Number(params.n) || 1);
  const { results } = await e.DB.prepare(`SELECT slug, updated_at FROM businesses WHERE status = 'active' AND ${INDEXABLE_SQL} ORDER BY id LIMIT ? OFFSET ?`).bind(PER, (n - 1) * PER).all<{ slug: string; updated_at: string }>();
  if (!results.length) return new Response('Not found', { status: 404 });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${results.map((r) => `<url><loc>${e.SITE_URL}/business/${r.slug}</loc><lastmod>${r.updated_at.slice(0, 10)}</lastmod></url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' } });
};
