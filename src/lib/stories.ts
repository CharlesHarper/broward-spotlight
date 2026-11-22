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
    if (!html || !isRealStory(html)) return null;
    const title = decode(meta(html, 'og:title') ?? html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? slug);
    return { slug, title, description: decode(meta(html, 'og:description') ?? meta(html, 'description') ?? ''), image: meta(html, 'og:image'),
      published: meta(html, 'article:published_time') } as Story;
  }));
  return stories.filter((s): s is Story => Boolean(s)).sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''));
}

/** Skip drafts and test posts: a real Spotlight has at least a few paragraphs of text. */
function isRealStory(page: string) {
  const body = innerOf(page, /<div[^>]*id="blogPostContent"[^>]*>/i) ?? '';
  return body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length >= 400;
}

/** The inner HTML of the first element whose opening tag matches `open` (balanced on <div>). */
function innerOf(html: string, open: RegExp): string | null {
  const m = open.exec(html);
  if (!m) return null;
  const start = m.index + m[0].length;
  const re = /<(\/?)div\b[^>]*>/gi;
  re.lastIndex = start;
  let depth = 1, t: RegExpExecArray | null;
  while ((t = re.exec(html))) {
    depth += t[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, t.index);
  }
  return null;
}
const textOf = (html: string, cls: string) => decode((html.match(new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/`, 'i'))?.[1] ?? '').replace(/<[^>]+>/g, '').trim());

/** Cleans editor HTML: keeps the article, drops scripts (except structured data), styles, inline handlers and inline styles. */
function clean(html: string) {
  return html
    .replace(/<script(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/javascript:/gi, '')
    .replaceAll(`https://${STORIES_HOST}/post/`, '/post/')
    .replace(/https:\/\/(www\.)?browardspotlight\.com\//g, '/');
}

export interface StoryPage extends Story { html: string; category: string | null; dateText: string | null; author: string | null }

export async function getStory(slug: string): Promise<StoryPage | null> {
  if (!/^[a-z0-9][a-z0-9-]{1,120}$/i.test(slug)) return null;
  const html = await get(`https://${STORIES_HOST}/post/${slug}`);
  if (!html) return null;
  const body = innerOf(html, /<div[^>]*id="blogPostContent"[^>]*>/i);
  if (body === null || !isRealStory(html)) return null;
  const cover = innerOf(html, /<div[^>]*class="[^"]*blog-cover-image-container[^"]*"[^>]*>/i)?.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? null;
  const title = textOf(html, 'blog-content-title') || decode(meta(html, 'og:title') ?? slug);
  return {
    slug, title, html: clean(body),
    description: decode(meta(html, 'og:description') ?? meta(html, 'description') ?? ''),
    image: meta(html, 'og:image') ?? cover,
    published: meta(html, 'article:published_time'),
    category: textOf(html, 'blog-category') || null,
    dateText: textOf(html, 'blog-date') || null,
    author: textOf(html, 'blog-author-name') || null,
  };
}
