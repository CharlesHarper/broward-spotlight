import type { APIRoute } from 'astro';

// Serves a paid banner from file storage.
export const GET: APIRoute = async ({ params, locals }) => {
  const key = String(params.key ?? '');
  const env = locals.runtime.env;
  if (!/^[a-z0-9]{16,40}$/i.test(key) || !env.PHOTOS) return new Response('Not found', { status: 404 });
  const obj = await env.PHOTOS.get(`ads/${key}.jpg`);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff', etag: obj.httpEtag } });
};
