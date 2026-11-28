import type { APIRoute } from 'astro';
import { rss, weeklyItems } from '../../lib/digest';

// Feeds the "This Week in Broward" email (HighLevel RSS schedule).
export const GET: APIRoute = async ({ locals }) => {
  const e = locals.runtime.env;
  const site = e.SITE_URL.replace(/\/$/, '');
  const items = await weeklyItems(e.DB, site);
  return new Response(rss(site, 'This Week in Broward', 'Events, city news and restaurant inspections across Broward County, every week.', '/feeds/weekly.xml', items),
    { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=900' } });
};
