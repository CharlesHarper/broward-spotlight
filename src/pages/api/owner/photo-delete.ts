import type { APIRoute } from 'astro';
import { env, str } from '../../../lib/util';

// A verified owner removes one of their own photos. The image is deleted, not hidden.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  const f = await request.formData();
  const t = str(f.get('token'), 100);
  const b = await e.DB.prepare(`SELECT id FROM businesses WHERE owner_token = ?`).bind(t).first<{ id: number }>();
  if (!t || !b) return new Response('Invalid owner link', { status: 403 });
  const id = Number(str(f.get('photo_id'))) || 0;
  const p = await e.DB.prepare(`SELECT id, key FROM photos WHERE id = ? AND business_id = ?`).bind(id, b.id).first<{ id: number; key: string }>();
  if (p) {
    if (e.PHOTOS) await e.PHOTOS.delete(`photos/${p.key}.jpg`);
    await e.DB.batch([
      e.DB.prepare(`DELETE FROM photo_data WHERE photo_id = ?`).bind(p.id),
      e.DB.prepare(`DELETE FROM photos WHERE id = ?`).bind(p.id),
      e.DB.prepare(`UPDATE businesses SET updated_at = datetime('now') WHERE id = ?`).bind(b.id),
    ]);
  }
  return redirect(`/owner/${t}?saved=photos#photos`, 303);
};
