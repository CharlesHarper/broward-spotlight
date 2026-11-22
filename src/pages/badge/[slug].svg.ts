import type { APIRoute } from 'astro';
import { env } from '../../lib/util';

// "Verified on Broward Spotlight" badge that owners put on their own website, linking back to their listing.
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const GET: APIRoute = async ({ params, locals }) => {
  const e = env(locals);
  const b = await e.DB.prepare(`SELECT name, claimed FROM businesses WHERE slug = ? AND status = 'active'`).bind(params.slug).first<{ name: string; claimed: number }>();
  if (!b?.claimed) return new Response('Not found', { status: 404 });
  const r = await e.DB.prepare(`SELECT COUNT(*) AS n, ROUND(AVG(rating), 1) AS avg FROM reviews WHERE business_id = (SELECT id FROM businesses WHERE slug = ?) AND status = 'approved'`).bind(params.slug).first<{ n: number; avg: number | null }>();
  const line2 = r?.n ? `★ ${r.avg} · ${r.n} ${r.n === 1 ? 'review' : 'reviews'}` : 'Owner verified listing';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="64" viewBox="0 0 220 64" role="img" aria-label="${esc(`${b.name} is verified on Broward Spotlight`)}">
<rect width="220" height="64" rx="12" fill="#0F2A33"/>
<g transform="translate(12 12)"><rect width="40" height="40" rx="9" fill="#0F2A33" stroke="#E6EEEE" stroke-opacity=".25"/><path d="M6 34 L25 9 L32 16 Z" fill="#FFC72C"/><circle cx="29" cy="13" r="5" fill="#FFC72C"/><circle cx="29" cy="13" r="2" fill="#0F2A33"/></g>
<text x="62" y="27" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="#FFFFFF">Verified on</text>
<text x="62" y="43" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" fill="#FFC72C">Broward Spotlight</text>
<text x="62" y="56" font-family="Arial,Helvetica,sans-serif" font-size="9.5" fill="#E6EEEE">${esc(line2)}</text>
</svg>`;
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' } });
};
