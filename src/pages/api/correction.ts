import type { APIRoute } from 'astro';
import { env, str, isEmail, ghl, looksLikeBot } from '../../lib/util';
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  const f = await request.formData();
  const slug = str(f.get('slug'), 120);
  if (looksLikeBot(f)) return redirect(`/business/${slug}?sent=correction`, 303);
  const details = str(f.get('details'), 2000), email = str(f.get('email'), 200).toLowerCase();
  if (!details || !isEmail(email)) return new Response('Please describe the mistake and add your email.', { status: 400 });
  const b = await e.DB.prepare(`SELECT name FROM businesses WHERE slug = ?`).bind(slug).first<{ name: string }>();
  await e.DB.prepare(`INSERT INTO leads (kind, email, business_name, payload) VALUES ('correction', ?, ?, ?)`).bind(email, b?.name ?? slug, JSON.stringify({ slug, details })).run();
  await ghl(e, 'correction_reported', { email, business_name: b?.name, details, business_url: new URL(`/business/${slug}`, e.SITE_URL).toString(), tags: ['spotlight-correction'] });
  return redirect(`/business/${slug}?sent=correction`, 303);
};
