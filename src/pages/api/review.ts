import type { APIRoute } from 'astro';
import { env, str, isEmail, token, ghl, looksLikeBot } from '../../lib/util';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  const f = await request.formData();
  const slug = str(f.get('slug'), 120);
  const back = `/business/${slug}`;
  if (looksLikeBot(f)) return redirect(`${back}?sent=review#reviews`, 303);
  const id = Number(str(f.get('business_id')));
  const rating = Number(str(f.get('rating')));
  const body = str(f.get('body'), 3000);
  const name = str(f.get('name'), 60);
  const email = str(f.get('email'), 200).toLowerCase();
  if (!id || !(rating >= 1 && rating <= 5) || body.length < 30 || !name || !isEmail(email) || !f.get('certify')) {
    return new Response('Please fill in every field, including the customer checkbox, and write at least 30 characters.', { status: 400 });
  }
  const biz = await e.DB.prepare(`SELECT id, name, slug, owner_email FROM businesses WHERE id = ?`).bind(id).first<{ id: number; name: string; slug: string; owner_email: string | null }>();
  if (!biz) return new Response('Business not found', { status: 404 });
  if (biz.owner_email && biz.owner_email.toLowerCase() === email) {
    return new Response('Owners can respond to reviews from their owner page but cannot review their own business.', { status: 400 });
  }
  const dup = await e.DB.prepare(`SELECT 1 FROM reviews WHERE business_id = ? AND email = ? AND created_at > datetime('now','-180 days')`).bind(id, email).first();
  if (dup) return new Response('You have already reviewed this business in the last six months.', { status: 400 });
  const vt = token(16);
  await e.DB.prepare(`INSERT INTO reviews (business_id, name, email, rating, body, verify_token) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, name, email, rating, body, vt).run();
  await ghl(e, 'review_submitted', {
    email, name, business_name: biz.name, business_url: new URL(`/business/${biz.slug}`, e.SITE_URL).toString(),
    rating, verify_url: new URL(`/review/verify/${vt}`, e.SITE_URL).toString(), tags: ['spotlight-reviewer'],
  });
  return redirect(`${back}?sent=review#reviews`, 303);
};
