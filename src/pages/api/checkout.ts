import type { APIRoute } from 'astro';
import { env, str, isEmail, normUrl, token, looksLikeBot } from '../../lib/util';
import { PLANS, isPlan, stripe, stripeReady } from '../../lib/stripe';
import { CATEGORIES, CITY_NAMES, categoryLabel } from '../../lib/shared';

// Starts a Stripe Checkout for one plan. Featured and Spotlight come from a verified owner's page; display ads from the Advertise page.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  if (!stripeReady(e)) return redirect('/advertise#inquire', 303);
  const f = await request.formData();
  if (looksLikeBot(f)) return redirect('/advertise', 303);
  const plan = str(f.get('plan'), 20);
  if (!isPlan(plan)) return new Response('Unknown plan.', { status: 400 });
  const P = PLANS[plan];
  const site = e.SITE_URL.replace(/\/$/, '');
  let o: { business_id: number | null; business_name: string; name: string; email: string; city_slug: string | null; category: string | null; ad_slot: string | null; ad_scope: string | null; link_url: string | null };

  if (plan === 'ad') {
    const email = str(f.get('email'), 200).toLowerCase();
    const slot = ['home', 'city', 'category'].includes(str(f.get('slot'))) ? str(f.get('slot')) : 'home';
    const scope = slot === 'city' ? (CITY_NAMES[str(f.get('city'))] ? str(f.get('city')) : null) : slot === 'category' ? (CATEGORIES.some((c) => c.slug === str(f.get('category'))) ? str(f.get('category')) : null) : null;
    const link = normUrl(str(f.get('link_url'), 500));
    o = { business_id: null, business_name: str(f.get('business_name'), 120), name: str(f.get('name'), 80), email, city_slug: null, category: null, ad_slot: slot, ad_scope: scope, link_url: link };
    if (!o.business_name || !o.name || !isEmail(email) || !link) return new Response('Please add your name, business, email and the link people should go to.', { status: 400 });
  } else {
    const b = await e.DB.prepare(`SELECT id, name, city_slug, category, owner_email FROM businesses WHERE owner_token = ?`).bind(str(f.get('token'), 100))
      .first<{ id: number; name: string; city_slug: string | null; category: string; owner_email: string | null }>();
    if (!b) return new Response('Featured and Spotlight are bought from your owner page after you claim your listing.', { status: 403 });
    if (plan === 'featured') {
      const live = await e.DB.prepare(`SELECT 1 FROM orders WHERE business_id = ? AND kind = 'featured' AND status = 'paid' AND paid_through >= date('now')`).bind(b.id).first();
      if (live) return redirect(`/owner/${str(f.get('token'), 100)}#promote`, 303);
    }
    o = { business_id: b.id, business_name: b.name, name: '', email: b.owner_email ?? '', city_slug: b.city_slug && CITY_NAMES[b.city_slug] ? b.city_slug : null, category: b.category, ad_slot: null, ad_scope: null, link_url: null };
  }

  const t = token(16);
  const row = await e.DB.prepare(`INSERT INTO orders (token, kind, business_id, business_name, name, email, city_slug, category, ad_slot, ad_scope, link_url, amount_cents)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(t, plan, o.business_id, o.business_name, o.name || null, o.email || null, o.city_slug, o.category, o.ad_slot, o.ad_scope, o.link_url, P.cents).first<{ id: number }>();
  const where = plan === 'featured' ? `${categoryLabel(o.category ?? '')} in ${o.city_slug ? CITY_NAMES[o.city_slug] : 'Broward County'}`
    : plan === 'ad' ? (o.ad_slot === 'home' ? 'Home page' : o.ad_scope ? `${o.ad_slot === 'city' ? CITY_NAMES[o.ad_scope] : categoryLabel(o.ad_scope)} pages` : `All ${o.ad_slot} pages`) : o.business_name;
  const meta = { order_id: String(row!.id), kind: plan };
  try {
    const s = await stripe(e, 'checkout/sessions', {
      mode: P.monthly ? 'subscription' : 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: P.cents, product_data: { name: `Broward Spotlight ${P.label}`, description: `${where}. ${P.blurb}` }, ...(P.monthly ? { recurring: { interval: 'month' } } : {}) } }],
      customer_email: o.email || undefined,
      client_reference_id: String(row!.id),
      metadata: meta,
      ...(P.monthly ? { subscription_data: { metadata: meta } } : { payment_intent_data: { metadata: meta } }),
      allow_promotion_codes: 'true',
      success_url: `${site}/order/${t}?paid=1`,
      cancel_url: plan === 'ad' ? `${site}/advertise?canceled=1#ad` : `${site}/owner/${str(f.get('token'), 100)}?canceled=1#promote`,
    });
    await e.DB.prepare(`UPDATE orders SET stripe_session_id = ? WHERE id = ?`).bind(s.id, row!.id).run();
    return redirect(s.url, 303);
  } catch (err) {
    console.log('checkout failed', String(err));
    return new Response('Checkout is not available right now. Please try again in a few minutes or use the form on the Advertise page.', { status: 502 });
  }
};
