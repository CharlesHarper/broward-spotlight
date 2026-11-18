import type { APIRoute } from 'astro';
import { env, str, isEmail, ghl, looksLikeBot, normUrl } from '../../lib/util';
import { CATEGORIES, CITY_NAMES, slugify } from '../../lib/shared';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  const f = await request.formData();
  if (looksLikeBot(f)) return redirect('/add-business?sent=1', 303);
  const bn = str(f.get('business_name'), 120), category = str(f.get('category'), 40), city = str(f.get('city'), 60);
  const email = str(f.get('email'), 200).toLowerCase(), name = str(f.get('name'), 80), phone = str(f.get('phone'), 40);
  if (!bn || !CATEGORIES.some((c) => c.slug === category) || !CITY_NAMES[city] || !isEmail(email) || !name || !phone) {
    return new Response('Please fill in the business name, category, city, phone, your name and email.', { status: 400 });
  }
  const base = slugify(`${bn} ${CITY_NAMES[city]}`);
  let slug = base;
  for (let i = 2; await e.DB.prepare(`SELECT 1 FROM businesses WHERE slug = ?`).bind(slug).first(); i++) slug = `${base}-${i}`;
  const website = normUrl(str(f.get('website'), 300));
  const isOwner = !!f.get('is_owner');
  await e.DB.prepare(`INSERT INTO businesses (slug, name, category, subtype, address, city, city_slug, zip, phone, website, description, source, status, owner_email)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'owner', 'pending', ?)`)
    .bind(slug, bn, category, str(f.get('subtype'), 60) || null, str(f.get('address'), 160) || null, CITY_NAMES[city], city,
      str(f.get('zip'), 10) || null, phone, website, str(f.get('description'), 1500) || null, isOwner ? email : null).run();
  await e.DB.prepare(`INSERT INTO leads (kind, name, email, phone, business_name, payload) VALUES ('add-business', ?, ?, ?, ?, ?)`)
    .bind(name, email, phone, bn, JSON.stringify({ slug, category, city, is_owner: isOwner })).run();
  await ghl(e, 'business_submitted', { name, email, phone, business_name: bn, category, city: CITY_NAMES[city], is_owner: isOwner, tags: ['spotlight-new-business'] });
  return redirect('/add-business?sent=1', 303);
};
