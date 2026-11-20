import type { APIRoute } from 'astro';

// Serves one owner photo. Addresses are random and never reused, so browsers may keep a copy for a day.
export const GET: APIRoute = async ({ params, locals }) => {
  const key = String(params.key ?? '');
  if (!/^[a-z0-9]{16,40}$/i.test(key)) return new Response('Not found', { status: 404 });
  const env = locals.runtime.env;
  const live = await env.DB.prepare(`SELECT 1 FROM photos WHERE key = ? AND status = 'live'`).bind(key).first();
  if (!live) return new Response('Not found', { status: 404 });
  if (env.PHOTOS) {
    const obj = await env.PHOTOS.get(`photos/${key}.jpg`);
    if (obj) return new Response(obj.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff', etag: obj.httpEtag } });
  }
  const row = await env.DB.prepare(`SELECT d.data FROM photos p JOIN photo_data d ON d.photo_id = p.id WHERE p.key = ? AND p.status = 'live'`)
    .bind(key).first<{ data: ArrayBuffer | number[] }>();
  if (!row) return new Response('Not found', { status: 404 });
  const body = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data);
  return new Response(body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' } });
};
