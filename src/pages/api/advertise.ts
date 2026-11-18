import type { APIRoute } from 'astro';
import { env, str, isEmail, ghl, looksLikeBot } from '../../lib/util';
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  const f = await request.formData();
  if (looksLikeBot(f)) return redirect('/advertise?sent=1#inquire', 303);
  const name = str(f.get('name'), 80), bn = str(f.get('business_name'), 120), email = str(f.get('email'), 200).toLowerCase();
  const phone = str(f.get('phone'), 40), interest = str(f.get('interest'), 40), target = str(f.get('target'), 200);
  if (!name || !bn || !isEmail(email) || !interest) return new Response('Please add your name, business, email and what you are interested in.', { status: 400 });
  await e.DB.prepare(`INSERT INTO leads (kind, name, email, phone, business_name, payload) VALUES ('advertise', ?, ?, ?, ?, ?)`)
    .bind(name, email, phone, bn, JSON.stringify({ interest, target })).run();
  await ghl(e, 'advertise_inquiry', { name, email, phone, business_name: bn, interest, target, tags: ['spotlight-advertiser'] });
  return redirect('/advertise?sent=1#inquire', 303);
};
