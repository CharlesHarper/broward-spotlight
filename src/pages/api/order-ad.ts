import type { APIRoute } from 'astro';
import { env, str, token } from '../../lib/util';
import { cleanJpeg, MAX_PHOTO_BYTES } from '../../lib/photos';

// A paid display-ad buyer uploads (or swaps) their banner. The ad goes live right away for the paid period.
export const POST: APIRoute = async ({ request, locals }) => {
  const e = env(locals);
  const f = await request.formData();
  const o = await e.DB.prepare(`SELECT * FROM orders WHERE token = ? AND kind = 'ad'`).bind(str(f.get('order'), 64))
    .first<{ id: number; status: string; paid_through: string | null; ad_id: number | null; business_name: string; ad_slot: string; ad_scope: string | null; link_url: string }>();
  const fail = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });
  if (!o) return fail('Order not found.', 404);
  if (o.status !== 'paid') return fail('This order is not active.');
  if (!e.PHOTOS) return fail('Banner uploads are not available right now.', 503);
  const file = f.get('file');
  if (!(file instanceof File) || file.size === 0) return fail('Choose an image first.');
  if (file.size > MAX_PHOTO_BYTES) return fail('That image is too large.');
  const clean = cleanJpeg(new Uint8Array(await file.arrayBuffer()));
  if (!clean) return fail('We could not read that image.');
  const alt = str(f.get('alt'), 200) || `${o.business_name} advertisement`;
  const key = token(12);
  await e.PHOTOS.put(`ads/${key}.jpg`, clean.data, { httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=86400' } });
  const url = `/ad-image/${key}.jpg`;
  if (o.ad_id) {
    const old = await e.DB.prepare(`SELECT image_url FROM ads WHERE id = ?`).bind(o.ad_id).first<{ image_url: string }>();
    await e.DB.prepare(`UPDATE ads SET image_url = ?, alt = ? WHERE id = ?`).bind(url, alt, o.ad_id).run();
    const m = old?.image_url.match(/^\/ad-image\/([a-z0-9]+)\.jpg$/);
    if (m) await e.PHOTOS.delete(`ads/${m[1]}.jpg`);
  } else {
    const ad = await e.DB.prepare(`INSERT INTO ads (advertiser, slot, scope_slug, image_url, link_url, alt, starts_on, ends_on) VALUES (?, ?, ?, ?, ?, ?, date('now'), ?) RETURNING id`)
      .bind(o.business_name, o.ad_slot, o.ad_scope, url, o.link_url, alt, o.paid_through).first<{ id: number }>();
    await e.DB.prepare(`UPDATE orders SET ad_id = ? WHERE id = ?`).bind(ad!.id, o.id).run();
  }
  return Response.json({ ok: true });
};
