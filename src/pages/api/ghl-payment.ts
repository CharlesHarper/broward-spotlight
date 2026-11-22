import type { APIRoute } from 'astro';
import { env, ghl, str } from '../../lib/util';
import { applyPayment, paymentsKey } from '../../lib/payments';

// HighLevel calls this when a Broward Spotlight product is paid for or a subscription is canceled.
// The private key in the address (shown on the admin page) proves the message came from your HighLevel account.
export const POST: APIRoute = async ({ request, locals, url }) => {
  const e = env(locals);
  if (url.searchParams.get('key') !== (await paymentsKey(e.DB))) return new Response('Forbidden', { status: 403 });
  let body: Record<string, any> = {};
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('json')) body = await request.json().catch(() => ({}));
  else { const f = await request.formData(); body = Object.fromEntries(f.entries()); }
  const pick = (...keys: string[]) => { for (const k of keys) { const v = k.split('.').reduce((o: any, p) => o?.[p], body); if (v != null && String(v).trim()) return String(v).trim(); } return ''; };
  // Which plan: from the address, or from the product name / amount HighLevel sends.
  const rawText = JSON.stringify(body);
  const raw = rawText.toLowerCase();
  // Keep the latest message so the format HighLevel sends can be checked from the database.
  await e.DB.prepare(`INSERT INTO import_state (key, value) VALUES ('last_payment_message', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .bind(rawText.slice(0, 8000)).run();
  const amt = Number(pick('amount', 'customData.amount', 'payment.amount', 'payment.total_amount')) || 0;
  const plan = (url.searchParams.get('plan') ?? pick('plan', 'customData.plan')).toLowerCase()
    || (raw.includes('featured listing') ? 'featured' : raw.includes('spotlight article') ? 'spotlight' : raw.includes('display ad') ? 'ad' : '')
    || (amt === 79 ? 'featured' : amt === 249 ? 'spotlight' : amt === 99 ? 'ad' : '');
  const event = ((url.searchParams.get('event') ?? pick('event', 'customData.event')) || 'paid').toLowerCase();
  const email = pick('email', 'contact.email', 'customData.email');
  if (!email) return Response.json({ ok: false, note: 'no email in message' }, { status: 400 });
  const name = pick('full_name', 'name', 'contact.name', 'first_name');
  const amount = amt || null;
  const result = await applyPayment(e, { event, plan, email, name, amount, business: str(pick('company_name', 'business_name'), 120) });
  if (!result.ok) {
    // Never drop a payment silently: tell Charles so he can set it up by hand.
    await ghl(e, 'payment_needs_review', { email, name, details: `A ${event} payment message from ${email} couldn't be matched to a plan (${result.note}). Amount: ${amount ?? 'unknown'}. Set it up from the admin page.` });
  }
  return Response.json(result);
};
