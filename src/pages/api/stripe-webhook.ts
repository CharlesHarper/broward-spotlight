import type { APIRoute } from 'astro';
import { env, ghl } from '../../lib/util';
import { verifyStripe, addDays, money } from '../../lib/stripe';

type Order = { id: number; token: string; kind: string; business_id: number | null; business_name: string; name: string | null; email: string | null; city_slug: string | null; category: string | null; ad_id: number | null; placement_id: number | null; status: string; amount_cents: number };

// Stripe tells us about payments here. Paid Featured orders switch on by themselves; renewals extend them; cancellations end them.
export const POST: APIRoute = async ({ request, locals }) => {
  const e = env(locals);
  const raw = await request.text();
  if (!e.STRIPE_WEBHOOK_SECRET || !(await verifyStripe(raw, request.headers.get('stripe-signature'), e.STRIPE_WEBHOOK_SECRET))) return new Response('Bad signature', { status: 400 });
  const ev = JSON.parse(raw);
  const obj = ev.data?.object ?? {};
  const db = e.DB;
  const site = e.SITE_URL.replace(/\/$/, '');
  const today = new Date();

  if (ev.type === 'checkout.session.completed' && (obj.payment_status === 'paid' || obj.payment_status === 'no_payment_required')) {
    const o = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(Number(obj.metadata?.order_id ?? obj.client_reference_id)).first<Order>();
    if (!o || o.status !== 'pending') return new Response('ok');
    const through = o.kind === 'spotlight' ? null : addDays(today, 33); // a month plus a short grace period
    const email = (obj.customer_details?.email ?? o.email ?? '').toLowerCase() || null;
    await db.prepare(`UPDATE orders SET status = 'paid', paid_at = datetime('now'), paid_through = ?, email = ?, name = COALESCE(name, ?), stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?`)
      .bind(through, email, obj.customer_details?.name ?? null, obj.customer ?? null, obj.subscription ?? null, o.id).run();
    if (o.kind === 'featured' && o.business_id) {
      const p = await db.prepare(`INSERT INTO placements (business_id, city_slug, category, starts_on, ends_on, note) VALUES (?, ?, ?, date('now'), ?, ?) RETURNING id`)
        .bind(o.business_id, o.city_slug, o.category, through, `Stripe order ${o.id}`).first<{ id: number }>();
      await db.prepare(`UPDATE orders SET placement_id = ? WHERE id = ?`).bind(p!.id, o.id).run();
      await db.prepare(`UPDATE businesses SET updated_at = datetime('now') WHERE id = ?`).bind(o.business_id).run();
    }
    await ghl(e, 'order_paid', { email, name: obj.customer_details?.name ?? o.name ?? '', business_name: o.business_name, interest: o.kind,
      details: `${o.kind} paid ${money(o.amount_cents)}. Order page: ${site}/order/${o.token}${o.kind === 'spotlight' ? ' — write the Spotlight article.' : o.kind === 'ad' ? ' — the buyer uploads the banner from the order page.' : ' — Featured is live.'}`,
      tags: ['spotlight-customer', `spotlight-${o.kind}`] });
  }

  if (ev.type === 'invoice.paid' && obj.billing_reason === 'subscription_cycle') {
    const sub = obj.subscription ?? obj.parent?.subscription_details?.subscription;
    const end = obj.lines?.data?.[0]?.period?.end;
    if (sub && end) {
      const through = addDays(new Date(end * 1000), 2);
      const o = await db.prepare(`SELECT * FROM orders WHERE stripe_subscription_id = ?`).bind(typeof sub === 'string' ? sub : sub.id).first<Order>();
      if (o) {
        await db.prepare(`UPDATE orders SET paid_through = ?, status = 'paid' WHERE id = ?`).bind(through, o.id).run();
        if (o.placement_id) await db.prepare(`UPDATE placements SET ends_on = ? WHERE id = ?`).bind(through, o.placement_id).run();
        if (o.ad_id) await db.prepare(`UPDATE ads SET ends_on = ? WHERE id = ?`).bind(through, o.ad_id).run();
      }
    }
  }

  if (ev.type === 'customer.subscription.deleted') {
    const o = await db.prepare(`SELECT * FROM orders WHERE stripe_subscription_id = ?`).bind(obj.id).first<Order>();
    if (o) {
      await db.prepare(`UPDATE orders SET status = 'canceled', paid_through = date('now') WHERE id = ?`).bind(o.id).run();
      if (o.placement_id) await db.prepare(`UPDATE placements SET ends_on = date('now') WHERE id = ?`).bind(o.placement_id).run();
      if (o.ad_id) await db.prepare(`UPDATE ads SET ends_on = date('now') WHERE id = ?`).bind(o.ad_id).run();
      await ghl(e, 'order_canceled', { email: o.email ?? '', business_name: o.business_name, interest: o.kind, details: `${o.kind} subscription canceled.`, tags: ['spotlight-canceled'] });
    }
  }
  return new Response('ok');
};
