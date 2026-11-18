import type { APIRoute } from 'astro';
export const GET: APIRoute = ({ locals }) => {
  const site = locals.runtime.env.SITE_URL;
  return new Response(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /owner/\nDisallow: /claim/\nDisallow: /correction/\nDisallow: /search\nSitemap: ${site}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
};
