import type { APIRoute } from 'astro';
import { env, str, token } from '../../../lib/util';
import { cleanJpeg, MAX_PHOTOS, MAX_PHOTO_BYTES } from '../../../lib/photos';

// A verified owner adds one photo to their listing.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
  const f = await request.formData();
  const t = str(f.get('token'), 100);
  const fail = (msg: string, status = 400) => wantsJson ? Response.json({ ok: false, error: msg }, { status }) : new Response(msg, { status });
  const b = await e.DB.prepare(`SELECT id FROM businesses WHERE owner_token = ?`).bind(t).first<{ id: number }>();
  if (!t || !b) return fail('Invalid owner link', 403);
  if (!str(f.get('rights'))) return fail('Please confirm you have the right to use this photo.');
  const file = f.get('file');
  if (!(file instanceof File) || file.size === 0) return fail('Choose a photo first.');
  if (file.size > MAX_PHOTO_BYTES) return fail('That photo is too large. Photos are resized in your browser; if this keeps happening, try a smaller picture.');
  const n = await e.DB.prepare(`SELECT COUNT(*) AS n FROM photos WHERE business_id = ? AND status = 'live'`).bind(b.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_PHOTOS) return fail(`A listing can have up to ${MAX_PHOTOS} photos. Remove one to add another.`);
  const clean = cleanJpeg(new Uint8Array(await file.arrayBuffer()));
  if (!clean) return fail('We could not read that file as a photo. Use a JPG, PNG or WebP picture.');
  const key = token(12);
  const row = await e.DB.prepare(`INSERT INTO photos (business_id, key, bytes, width, height, caption) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(b.id, key, clean.data.length, clean.width, clean.height, str(f.get('caption'), 120) || null).first<{ id: number }>();
  // Prefer file storage (R2) when it is connected; otherwise keep the image in the database.
  if (e.PHOTOS) await e.PHOTOS.put(`photos/${key}.jpg`, clean.data, { httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=86400' } });
  else await e.DB.prepare(`INSERT INTO photo_data (photo_id, data) VALUES (?, ?)`).bind(row!.id, clean.data).run();
  await e.DB.prepare(`UPDATE businesses SET updated_at = datetime('now') WHERE id = ?`).bind(b.id).run();
  return wantsJson ? Response.json({ ok: true }) : redirect(`/owner/${t}?saved=photos#photos`, 303);
};
