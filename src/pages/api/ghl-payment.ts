import type { APIRoute } from 'astro';
import { env, str } from '../../lib/util';
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
  const plan = (url.searchParams.get('plan') ?? pick('plan', 'customData.plan')).toLowerCase();
  const event = ((url.searchParams.get('event') ?? pick('event', 'customData.event')) || 'paid').toLowerCase();
  const email = pick('email', 'contact.email', 'customData.email');
  if (!email) return Response.json({ ok: false, note: 'no email in message' }, { status: 400 });
  const name = pick('full_name', 'name', 'contact.name', 'first_name');
  const amount = Number(pick('amount', 'customData.amount', 'payment.amount')) || null;
  const result = await applyPayment(e, { event, plan, email, name, amount, business: str(pick('company_name', 'business_name'), 120) });
  return Response.json(result);
};
