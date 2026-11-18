import type { APIRoute } from 'astro';
import { env, str } from '../../../lib/util';
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  const f = await request.formData();
  const t = str(f.get('token'), 100);
  const b = await e.DB.prepare(`SELECT id FROM businesses WHERE owner_token = ?`).bind(t).first<{ id: number }>();
  if (!b) return new Response('Invalid owner link', { status: 403 });
  const resp = str(f.get('response'), 1500);
  await e.DB.prepare(`UPDATE reviews SET owner_response = ?, owner_response_at = CASE WHEN ? IS NULL THEN NULL ELSE datetime('now') END WHERE id = ? AND business_id = ?`)
    .bind(resp || null, resp || null, Number(str(f.get('review_id'))), b.id).run();
  return redirect(`/owner/${t}?saved=1`, 303);
};
