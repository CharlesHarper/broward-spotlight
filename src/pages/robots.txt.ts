import type { APIRoute } from 'astro';
export const GET: APIRoute = ({ locals }) => {
  const site = locals.runtime.env.SITE_URL;
  return new Response(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /owner/\nDisallow: /claim/*\nAllow: /claim$\nDisallow: /correction/\nDisallow: /search\n\n# AI assistants and AI search are welcome on the same terms. A plain-language guide to this site: ${site}/llms.txt\nSitemap: ${site}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
};
