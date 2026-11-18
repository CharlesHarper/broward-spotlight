import type { APIRoute } from 'astro';
import { env, str, isEmail, ghl, looksLikeBot } from '../../lib/util';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  const f = await request.formData();
  const slug = str(f.get('slug'), 120);
  if (looksLikeBot(f)) return redirect(`/business/${slug}?sent=claim`, 303);
  const b = await e.DB.prepare(`SELECT id, name, website, phone, address, city, claimed FROM businesses WHERE slug = ?`).bind(slug)
    .first<{ id: number; name: string; website: string | null; phone: string | null; address: string | null; city: string | null; claimed: number }>();
  if (!b) return new Response('Business not found', { status: 404 });
  const name = str(f.get('name'), 80), role = str(f.get('role'), 40), email = str(f.get('email'), 200).toLowerCase(), phone = str(f.get('phone'), 40), note = str(f.get('note'), 1000);
  if (!name || !role || !isEmail(email) || !phone) return new Response('Please fill in your name, role, email and phone.', { status: 400 });
  let domainMatch = 0;
  try {
    if (b.website) {
      const host = new URL(b.website).hostname.replace(/^www\./, '');
      if (email.endsWith('@' + host)) domainMatch = 1;
    }
  } catch {}
  await e.DB.prepare(`INSERT INTO claims (business_id, name, role, email, phone, note, domain_match) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(b.id, name, role, email, phone, note, domainMatch).run();
  await ghl(e, 'claim_submitted', {
    name, email, phone, role, note, business_name: b.name, business_address: [b.address, b.city].filter(Boolean).join(', '),
    business_url: new URL(`/business/${slug}`, e.SITE_URL).toString(), email_matches_website: !!domainMatch, tags: ['spotlight-claim'],
  });
  return redirect(`/business/${slug}?sent=claim`, 303);
};
