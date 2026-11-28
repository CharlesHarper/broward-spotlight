import type { APIRoute } from 'astro';
import { CITY_INFO } from '../../../data/cities';

const UA = 'BrowardSpotlight/1.0 (+https://browardspotlight.com/about; city photos with credit)';

// Serves a city's credited Wikimedia Commons photo. Fetched once per size, then kept in R2 so Wikimedia isn't hit on every view.
export const GET: APIRoute = async ({ params, locals, url }) => {
  const slug = String(params.slug ?? '');
  const photo = CITY_INFO[slug]?.photo;
  if (!photo) return new Response('Not found', { status: 404 });
  const env = locals.runtime.env;
  // Wikimedia's standard thumbnail steps. PNG photos are capped smaller because they don't compress like JPEGs.
  const asked = Number(url.searchParams.get('w')) || 1280;
  const w = [320, 640, 960, 1280].find((x) => x >= asked) ?? 1280;
  const width = /\.png$/i.test(photo.file) ? Math.min(w, 960) : w;
  const key = `city/${slug}-${photo.file.length}-${width}.img`;
  const headers = (type: string) => ({ 'content-type': type, 'cache-control': 'public, max-age=2592000', 'x-content-type-options': 'nosniff' });
  if (env.PHOTOS) {
    const obj = await env.PHOTOS.get(key);
    if (obj) return new Response(obj.body, { headers: headers(obj.httpMetadata?.contentType ?? 'image/jpeg') });
  }
  const src = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(photo.file)}?width=${width}`;
  const r = await fetch(src, { headers: { 'user-agent': UA }, redirect: 'follow' });
  const type = r.headers.get('content-type') ?? '';
  if (!r.ok || !type.startsWith('image/')) return new Response('Not found', { status: 404 });
  const data = await r.arrayBuffer();
  if (env.PHOTOS) await env.PHOTOS.put(key, data, { httpMetadata: { contentType: type } });
  return new Response(data, { headers: headers(type) });
};
