// Turns a HighLevel "paid" or "canceled" message into a live Featured spot, a booked Spotlight or a display ad.
import { addDays, PLANS, isPlan, money } from './plans';
import { ghl, token } from './util';

export async function paymentsKey(db: D1Database) {
  const row = await db.prepare(`SELECT value FROM import_state WHERE key = 'payments_key'`).first<{ value: string }>();
  if (row) return row.value;
  const k = token(20);
  await db.prepare(`INSERT INTO import_state (key, value) VALUES ('payments_key', ?) ON CONFLICT(key) DO NOTHING`).bind(k).run();
  return (await db.prepare(`SELECT value FROM import_state WHERE key = 'payments_key'`).first<{ value: string }>())!.value;
}

type Order = { id: number; paid_at: string | null; token: string; kind: string; business_id: number | null; business_name: string; email: string | null; placement_id: number | null; ad_id: number | null; paid_through: string | null; status: string };

export async function applyPayment(e: Env, p: { event: string; plan: string; email: string; name: string; amount?: number | null; business?: string }) {
  const db = e.DB;
  if (!isPlan(p.plan)) return { ok: false, note: 'unknown plan' };
  const site = e.SITE_URL.replace(/\/$/, '');
  const email = p.email.toLowerCase();
  const plan = p.plan;
  const today = new Date();
  const last = await db.prepare(`SELECT * FROM orders WHERE kind = ? AND lower(email) = ? AND status IN ('paid', 'unmatched') ORDER BY id DESC LIMIT 1`).bind(plan, email).first<Order>();

  if (p.event === 'canceled') {
    if (!last) return { ok: true, note: 'nothing to cancel' };
    await db.prepare(`UPDATE orders SET status = 'canceled', paid_through = date('now') WHERE id = ?`).bind(last.id).run();
    if (last.placement_id) await db.prepare(`UPDATE placements SET ends_on = date('now') WHERE id = ?`).bind(last.placement_id).run();
    if (last.ad_id) await db.prepare(`UPDATE ads SET ends_on = date('now') WHERE id = ?`).bind(last.ad_id).run();
    await ghl(e, 'order_canceled', { email, business_name: last.business_name, interest: plan, details: `${PLANS[plan].label} canceled.`, tags: ['spotlight-canceled'] });
    return { ok: true, note: 'canceled' };
  }

  // Paid. A monthly plan that is already running is a renewal: push its end date out.
  if (PLANS[plan].monthly && last && last.status === 'paid' && (last.paid_through ?? '') >= addDays(today, -7)) {
    // HighLevel can report the same charge twice; a real renewal comes about a month after the last one.
    if (last.paid_at && last.paid_at.slice(0, 10) > addDays(today, -20)) return { ok: true, note: 'already counted' };
    const base = last.paid_through && last.paid_through > today.toISOString().slice(0, 10) ? new Date(last.paid_through + 'T12:00:00Z') : today;
    const through = addDays(base, 31);
    await db.prepare(`UPDATE orders SET paid_through = ?, paid_at = datetime('now') WHERE id = ?`).bind(through, last.id).run();
    if (last.placement_id) await db.prepare(`UPDATE placements SET ends_on = ? WHERE id = ?`).bind(through, last.placement_id).run();
    if (last.ad_id) await db.prepare(`UPDATE ads SET ends_on = ? WHERE id = ?`).bind(through, last.ad_id).run();
    return { ok: true, note: 'renewed' };
  }

  // New purchase. Featured and Spotlight attach to the listing this email owns.
  const biz = plan === 'ad' ? null : await db.prepare(`SELECT id, name, city_slug, category FROM businesses WHERE lower(owner_email) = ? AND claimed = 1 ORDER BY updated_at DESC LIMIT 1`).bind(email)
    .first<{ id: number; name: string; city_slug: string | null; category: string }>();
  const through = PLANS[plan].monthly ? addDays(today, 33) : null;
  const t = token(16);
  const status = plan !== 'ad' && !biz ? 'unmatched' : 'paid';
  const order = await db.prepare(`INSERT INTO orders (token, kind, business_id, business_name, name, email, city_slug, category, amount_cents, status, paid_through, paid_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) RETURNING id`)
    .bind(t, plan, biz?.id ?? null, biz?.name || p.business || p.name || email, p.name || null, email, biz?.city_slug ?? null, biz?.category ?? null,
      p.amount ? Math.round(p.amount * 100) : PLANS[plan].cents, status, through).first<{ id: number }>();
  if (plan === 'featured' && biz) {
    const pl = await db.prepare(`INSERT INTO placements (business_id, city_slug, category, starts_on, ends_on, note) VALUES (?, ?, ?, date('now'), ?, ?) RETURNING id`)
      .bind(biz.id, biz.city_slug, biz.category, through, `HighLevel order ${order!.id}`).first<{ id: number }>();
    await db.prepare(`UPDATE orders SET placement_id = ? WHERE id = ?`).bind(pl!.id, order!.id).run();
  }
  const orderUrl = `${site}/order/${t}`;
  const what = plan === 'featured' ? (biz ? 'Featured is live.' : 'No claimed listing uses this email; assign it in admin.')
    : plan === 'spotlight' ? (biz ? 'Write the Spotlight article.' : 'No claimed listing uses this email; assign it in admin.')
    : 'Buyer uploads the banner from the order page.';
  await ghl(e, plan === 'ad' ? 'ad_order_ready' : 'order_paid', { email, name: p.name, business_name: biz?.name || p.business || p.name || '', interest: plan, owner_url: orderUrl,
    details: `${PLANS[plan].label} paid${p.amount ? ` (${money(Math.round(p.amount * 100))})` : ''}. ${what} Order: ${orderUrl}`, tags: ['spotlight-customer', `spotlight-${plan}`] });
  return { ok: true, note: status };
}
