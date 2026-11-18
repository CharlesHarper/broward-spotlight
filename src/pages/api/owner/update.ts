import type { APIRoute } from 'astro';
import { env, str, normUrl, isEmail } from '../../../lib/util';
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  const f = await request.formData();
  const t = str(f.get('token'), 100);
  const b = await e.DB.prepare(`SELECT id FROM businesses WHERE owner_token = ?`).bind(t).first<{ id: number }>();
  if (!b) return new Response('Invalid owner link', { status: 403 });
  const email = str(f.get('email'), 200);
  await e.DB.prepare(`UPDATE businesses SET phone = ?, website = ?, email = ?, hours = ?, description = ?, facebook = ?, instagram = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(str(f.get('phone'), 40) || null, normUrl(str(f.get('website'), 300)), isEmail(email) ? email : null, str(f.get('hours'), 500) || null,
      str(f.get('description'), 2000) || null, normUrl(str(f.get('facebook'), 300)), normUrl(str(f.get('instagram'), 300)), b.id).run();
  return redirect(`/owner/${t}?saved=1`, 303);
};
