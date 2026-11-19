import type { APIRoute } from 'astro';

// Serves one owner photo. Addresses are random and never reused, so browsers may keep a copy for a day.
export const GET: APIRoute = async ({ params, locals }) => {
  const key = String(params.key ?? '');
  if (!/^[a-z0-9]{16,40}$/i.test(key)) return new Response('Not found', { status: 404 });
  const row = await locals.runtime.env.DB.prepare(`SELECT d.data FROM photos p JOIN photo_data d ON d.photo_id = p.id WHERE p.key = ? AND p.status = 'live'`)
    .bind(key).first<{ data: ArrayBuffer | number[] }>();
  if (!row) return new Response('Not found', { status: 404 });
  const body = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data);
  return new Response(body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' } });
};
