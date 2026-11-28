export function env(locals: App.Locals): Env {
  return locals.runtime.env;
}

export function token(bytes = 24): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
}

export function str(v: FormDataEntryValue | null, max = 2000): string {
  return (typeof v === 'string' ? v : '').trim().slice(0, max);
}

export function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export function normUrl(s: string): string | null {
  if (!s) return null;
  const v = /^https?:\/\//i.test(s) ? s : 'https://' + s;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function telHref(phone: string) {
  const d = phone.replace(/\D/g, '');
  return 'tel:+' + (d.length === 10 ? '1' + d : d);
}

export function fmtPhone(p: string | null | undefined) {
  const d = (p ?? '').replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return p ?? '';
}

/** Send an event to the HighLevel inbound webhook. Never throws; the site works without it. */
/** Every event carries the same set of fields (blank when not relevant), so HighLevel can map them once from any sample. */
export const GHL_FIELDS = ['email', 'name', 'phone', 'business_name', 'city', 'category', 'website', 'claim_url', 'listing_url', 'verify_url',
  'owner_url', 'business_url', 'rating', 'interest', 'target', 'details', 'is_owner'] as const;
const ghlShape = (data: Record<string, unknown>) => {
  const out: Record<string, unknown> = Object.fromEntries(GHL_FIELDS.map((k) => [k, '']));
  for (const [k, v] of Object.entries(data)) out[k] = v ?? '';
  if (!Array.isArray(out.tags)) out.tags = [];
  return out;
};

export async function ghl(e: Env, event: string, data: Record<string, unknown>) {
  if (!e.GHL_WEBHOOK_URL) return false;
  try {
    const res = await fetch(e.GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, source: 'browardspotlight.com', sent_at: new Date().toISOString(), ...ghlShape(data) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Simple per-IP throttle using the leads table timestamps is overkill; use a honeypot + min fill time instead. */
export function looksLikeBot(form: FormData): boolean {
  if (str(form.get('website_hp'))) return true;
  const t = Number(str(form.get('t')));
  if (t && Date.now() - t < 2500) return true;
  return false;
}

export function mapsUrl(name: string, address?: string | null, city?: string | null) {
  const q = [name, address, city, 'FL'].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

/** When someone claims a listing, tell HighLevel so the invitation reminders stop for the address we invited. */
export async function stopInviteReminders(e: Env, businessId: number) {
  const b = await e.DB.prepare(`SELECT name, slug, contact_email, invited_at FROM businesses WHERE id = ?`).bind(businessId)
    .first<{ name: string; slug: string; contact_email: string | null; invited_at: string | null }>();
  if (!b?.contact_email || !b.invited_at) return false;
  return ghl(e, 'listing_claimed', { email: b.contact_email, business_name: b.name, business_url: new URL(`/business/${b.slug}`, e.SITE_URL).toString(), tags: ['spotlight-owner'] });
}

/** Makes someone the verified owner and emails them their private owner link through HighLevel. */
export async function grantOwnership(e: Env, businessId: number, email: string, name?: string) {
  const t = token(24);
  const b = await e.DB.prepare(`UPDATE businesses SET claimed = 1, owner_token = ?, owner_email = ?, updated_at = datetime('now') WHERE id = ? RETURNING name, slug, contact_email`)
    .bind(t, email, businessId).first<{ name: string; slug: string; contact_email: string | null }>();
  if (!b) return null;
  const site = (p: string) => new URL(p, e.SITE_URL).toString();
  await ghl(e, 'owner_link', { email, name: name ?? '', business_name: b.name, owner_url: site(`/owner/${t}`), business_url: site(`/business/${b.slug}`), badge_img: site('/badge-verified.png'), badge_page: site(`/owner/${t}#badge`), tags: ['spotlight-owner'] });
  if (b.contact_email && b.contact_email.toLowerCase() !== email.toLowerCase()) await stopInviteReminders(e, businessId);
  return t;
}
