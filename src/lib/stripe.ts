// Stripe Checkout through Stripe's web API (no extra library needed on Cloudflare Workers).
export const PLANS = {
  featured: { label: 'Featured listing', cents: 7900, monthly: true, blurb: 'Top of your city and category pages, labeled Featured. Billed monthly, cancel any time.' },
  spotlight: { label: 'Spotlight article', cents: 24900, monthly: false, blurb: 'A researched feature story about your business, labeled Sponsored. One-time payment.' },
  ad: { label: 'Display ad', cents: 9900, monthly: true, blurb: 'A banner on the pages you pick, labeled Advertisement. Billed monthly, cancel any time.' },
} as const;
export type PlanKey = keyof typeof PLANS;
export const isPlan = (k: string): k is PlanKey => k in PLANS;
export const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

export const stripeReady = (e: Env) => Boolean(e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET);

/** Turns { a: { b: 1 }, c: [ { d: 2 } ] } into a=…&a[b]=1&c[0][d]=2, the form Stripe expects. */
function encode(obj: Record<string, unknown>, prefix = '', out: string[] = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') encode(v as Record<string, unknown>, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export async function stripe<T = any>(e: Env, path: string, params: Record<string, unknown> = {}, method = 'POST'): Promise<T> {
  const body = encode(params).join('&');
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === 'GET' && body ? `?${body}` : ''}`, {
    method,
    headers: { authorization: `Bearer ${e.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : body,
  });
  const json = (await res.json()) as any;
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe error ${res.status}`);
  return json as T;
}

/** Checks the Stripe-Signature header so only real Stripe events are accepted. */
export async function verifyStripe(raw: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]).filter((p) => p.length === 2).map(([k, v]) => [k, v]));
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => s.length === hex.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

/** A date string `days` after `from` (YYYY-MM-DD). */
export const addDays = (from: Date, days: number) => new Date(from.getTime() + days * 864e5).toISOString().slice(0, 10);
