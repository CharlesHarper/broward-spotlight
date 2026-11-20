// Spotlight stories are written in the HighLevel blog. This reads the published list from it (cached) for /stories and the sitemap.
export const STORIES_HOST = 'stories.browardspotlight.com';
export interface Story { slug: string; title: string; description: string; image: string | null; published: string | null }

const meta = (html: string, prop: string) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'))?.[1]
  ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'))?.[1] ?? null;
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function get(url: string) {
  const r = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } } as RequestInit);
  return r.ok ? r.text() : '';
}

export async function listStories(limit = 24): Promise<Story[]> {
  const home = await get(`https://${STORIES_HOST}/`);
  const slugs = [...new Set([...home.matchAll(/\/post\/([a-z0-9][a-z0-9-]{1,120})/gi)].map((m) => m[1].toLowerCase()))].slice(0, limit);
  const stories = await Promise.all(slugs.map(async (slug) => {
    const html = await get(`https://${STORIES_HOST}/post/${slug}`);
    if (!html) return null;
    const title = decode(meta(html, 'og:title') ?? html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? slug);
    return { slug, title, description: decode(meta(html, 'og:description') ?? meta(html, 'description') ?? ''), image: meta(html, 'og:image'),
      published: meta(html, 'article:published_time') } as Story;
  }));
  return stories.filter((s): s is Story => Boolean(s)).sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''));
}
