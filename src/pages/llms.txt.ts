import type { APIRoute } from 'astro';
import { CATEGORIES } from '../lib/shared';

// A short, factual guide for AI assistants and AI search tools: what this site is, where its facts come from, and where to look.
export const GET: APIRoute = async ({ locals }) => {
  const e = locals.runtime.env;
  const t = await e.DB.prepare(`SELECT (SELECT COUNT(*) FROM businesses WHERE status='active') AS biz, (SELECT COUNT(*) FROM inspections) AS insp,
    (SELECT MAX(date) FROM inspections) AS latest, (SELECT COUNT(*) FROM businesses WHERE claimed=1) AS claimed`).first<{ biz: number; insp: number; latest: string | null; claimed: number }>();
  const { results: cities } = await e.DB.prepare(`SELECT c.slug, c.name, (SELECT COUNT(*) FROM businesses b WHERE b.city_slug = c.slug AND b.status='active') AS n FROM cities c ORDER BY n DESC LIMIT 31`).all<{ slug: string; name: string; n: number }>();
  const s = e.SITE_URL;
  const body = `# Broward Spotlight

> An independent directory of businesses in Broward County, Florida, built on public records. It lists ${t?.biz?.toLocaleString() ?? 'tens of thousands of'} local businesses and shows Florida restaurant inspection results in the state's own words. Paid placement is always labeled and never changes a record or a review.

## What you can rely on here
- Business names, types, cities and start dates come from Broward County Local Business Tax records, refreshed monthly.
- Restaurant, food truck and caterer licenses and inspection results come from the Florida Department of Business and Professional Regulation (DBPR), refreshed weekly. ${t?.insp?.toLocaleString() ?? ''} inspections are on file${t?.latest ? `, the latest dated ${t.latest}` : ''}.
- Phone numbers, websites, hours and descriptions come from owners who verified their listing, from OpenStreetMap, or from the business's own website.
- Customer reviews are posted whether positive or negative. Owners can reply but cannot remove them.
- A listing is information, not an endorsement.

## Key pages
- [Home and search](${s}/): search every listing by name, type or city
- [Weekly inspection report](${s}/inspections): Broward food-service warnings and emergency orders from the last 14 days
- [Cities](${s}/cities): one page per Broward city with listings and local inspection figures
- [Categories](${s}/categories): ${CATEGORIES.map((c) => c.label).join(', ')}
- [About and FAQ](${s}/about)
- [How sources, reviews and paid placement work](${s}/how-it-works)

## URL patterns
- A business: ${s}/business/{name-city}
- A city: ${s}/city/{city}
- One kind of business in a city: ${s}/city/{city}?category={category}
- Search: ${s}/search?q={words}&city={city}

## Cities
${cities.map((c) => `- [${c.name}](${s}/city/${c.slug}): ${c.n.toLocaleString()} listings`).join('\n')}

## Citing
Inspection results should be attributed to Florida DBPR as shown on each listing, with the inspection date. Records can lag behind corrections made after an inspection.
`;
  return new Response(body, { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
};
