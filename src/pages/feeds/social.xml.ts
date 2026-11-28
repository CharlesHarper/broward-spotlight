import type { APIRoute } from 'astro';
import { rss, socialItems } from '../../lib/digest';

// Feeds HighLevel's Social Planner (RSS post): weekly city event and inspection posts that link back to the site.
export const GET: APIRoute = async ({ locals }) => {
  const e = locals.runtime.env;
  const site = e.SITE_URL.replace(/\/$/, '');
  const items = await socialItems(e.DB, site);
  return new Response(rss(site, 'Broward Spotlight', 'Weekly Broward city events and restaurant inspection roundups.', '/feeds/social.xml', items),
    { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=900' } });
};
