import type { APIRoute } from 'astro';
import { env, str } from '../../lib/util';
import { stripe, stripeReady } from '../../lib/stripe';

// Sends a buyer to Stripe's own page to update their card, see receipts or cancel.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  const f = await request.formData();
  const t = str(f.get('order'), 64);
  const o = await e.DB.prepare(`SELECT stripe_customer_id FROM orders WHERE token = ?`).bind(t).first<{ stripe_customer_id: string | null }>();
  if (!stripeReady(e) || !o?.stripe_customer_id) return redirect(`/order/${t}?portal=0`, 303);
  try {
    const s = await stripe(e, 'billing_portal/sessions', { customer: o.stripe_customer_id, return_url: `${e.SITE_URL.replace(/\/$/, '')}/order/${t}` });
    return redirect(s.url, 303);
  } catch (err) {
    console.log('portal failed', String(err));
    return redirect(`/order/${t}?portal=0`, 303);
  }
};
