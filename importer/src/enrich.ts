// Automatic enrichment, two sources:
//  1. OpenStreetMap (ODbL, © OpenStreetMap contributors): website, phone and opening hours for mapped places.
//  2. The business's own website: confirms the site belongs to the listing, then reads its phone, social links
//     and public contact email. Only facts are taken; no text or photos are copied.


export interface EnrichEnv {
  DB: D1Database;
  OVERPASS_URL: string;
  SITE_URL: string;
  GHL_WEBHOOK_URL?: string;
  INVITES_PER_DAY?: string;
}

const UA = 'BrowardSpotlightBot/1.0 (+https://browardspotlight.com/about)';
const norm = (v: string) => v.toLowerCase().replace(/&/g, ' and ').replace(/\b(llc|inc|corp|corporation|co|pa|llp|pllc|ltd|the)\b/g, '').replace(/[^a-z0-9]/g, '');
const nowSql = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function cleanUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let v = raw.trim().split(/[;\s]/)[0];
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    if (!u.hostname.includes('.')) return null;
    u.hash = '';
    return u.toString();
  } catch { return null; }
}
export function cleanPhone(raw: string | undefined): string | null {
  const d = (raw ?? '').split(/[;,]/)[0].replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : null;
}
const DAYS: Record<string, string> = { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun', PH: 'Holidays' };
export function readableHours(oh: string | undefined): string | null {
  if (!oh || oh.length > 200) return null;
  if (/^24\/7$/.test(oh.trim())) return 'Open 24 hours';
  if (/[\[\]"]|week|sunrise|sunset/i.test(oh)) return null; // too complex to show reliably
  return oh.split(';').map((p) => p.trim().replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (m) => DAYS[m]).replace(/\boff\b/g, 'closed').replace(/-/g, '–')).filter(Boolean).join('\n');
}

/** Stage 1: OpenStreetMap. One request for the whole county, matched by location and name. Runs monthly. */
export async function enrichFromOsm(env: EnrichEnv) {
  const db = env.DB;
  const q = `[out:json][timeout:120];area["name"="Broward County"]["admin_level"="6"]->.a;(nwr(area.a)["name"]["website"];nwr(area.a)["name"]["contact:website"];nwr(area.a)["name"]["phone"];nwr(area.a)["name"]["contact:phone"];nwr(area.a)["name"]["opening_hours"];);out tags center;`;
  const res = await fetch(env.OVERPASS_URL, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' } });
  if (!res.ok) throw new Error(`OpenStreetMap request failed: ${res.status}`);
  const data = (await res.json()) as { elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };

  // Listings without coordinates (state restaurant records) are matched by name and city or ZIP.
  const byName = new Map<string, { id: number; city_slug: string | null; zip: string | null }[]>();
  {
    const { results } = await db.prepare(`SELECT id, name, city_slug, zip FROM businesses WHERE status = 'active' AND lat IS NULL`).all<{ id: number; name: string; city_slug: string | null; zip: string | null }>();
    for (const r of results) { const k = norm(r.name); if (k.length >= 4) byName.set(k, [...(byName.get(k) ?? []), r]); }
  }
  const near = db.prepare(`SELECT id, name FROM businesses WHERE status = 'active' AND lat BETWEEN ?1 AND ?2 AND lng BETWEEN ?3 AND ?4 AND name LIKE ?5 ORDER BY (lower(name) = lower(?6)) DESC LIMIT 40`);
  const update = db.prepare(`UPDATE businesses SET
      website = COALESCE(website, ?2), website_source = CASE WHEN website IS NULL AND ?2 IS NOT NULL THEN 'osm' ELSE website_source END,
      phone = COALESCE(phone, ?3), hours = COALESCE(hours, ?4), osm_id = ?5, updated_at = datetime('now')
    WHERE id = ?1 AND claimed = 0`);

  const els = data.elements.filter((e) => e.tags?.name);
  let matched = 0;
  const pending: D1PreparedStatement[] = [];
  for (let i = 0; i < els.length; i += 40) {
    const chunk = els.slice(i, i + 40);
    const lookups = chunk.map((e) => {
      const lat = e.lat ?? e.center?.lat ?? 0, lon = e.lon ?? e.center?.lon ?? 0;
      // Narrow by the longest word in the name so busy plazas don't overflow the candidate list.
      const word = (e.tags!.name.match(/[A-Za-z0-9]{4,}/g) ?? [e.tags!.name]).sort((a, b) => b.length - a.length)[0].replace(/[%_]/g, '');
      return near.bind(lat - 0.0015, lat + 0.0015, lon - 0.0017, lon + 0.0017, `%${word}%`, e.tags!.name);
    });
    const found = await db.batch<{ id: number; name: string }>(lookups);
    chunk.forEach((e, j) => {
      const t = e.tags!;
      const n = norm(t.name);
      if (n.length < 4) return;
      let id: number | undefined;
      const cands = found[j].results.filter((r) => { const m = norm(r.name); return m === n || (n.length >= 6 && m.includes(n)) || (m.length >= 6 && n.includes(m)); });
      if (cands.length === 1) id = cands[0].id;
      else if (cands.length > 1) id = cands.find((r) => norm(r.name) === n)?.id;
      if (!id) {
        const same = byName.get(n) ?? [];
        const city = (t['addr:city'] ?? '').toLowerCase().replace(/[^a-z]+/g, '-');
        const zip = (t['addr:postcode'] ?? '').slice(0, 5);
        const hit = same.filter((r) => (zip && r.zip === zip) || (city && r.city_slug === city));
        if (hit.length === 1) id = hit[0].id;
      }
      if (!id) return;
      const website = cleanUrl(t.website ?? t['contact:website']);
      const phone = cleanPhone(t.phone ?? t['contact:phone']);
      const hours = readableHours(t.opening_hours);
      if (!website && !phone && !hours) return;
      pending.push(update.bind(id, website, phone, hours, `${e.type}/${e.id}`));
      matched++;
    });
    if (pending.length >= 60) await db.batch(pending.splice(0));
  }
  if (pending.length) await db.batch(pending.splice(0));
  return { read: els.length, kept: matched, note: `OpenStreetMap places with details: ${els.length}; matched to listings: ${matched}` };
}

// ---------- Stage 2: the business's own website ----------

const PARKED = /domain (is|may be) for sale|buy this domain|parked free|godaddy\.com\/domainsearch|sedoparking|hugedomains|this domain has expired|website coming soon/i;
const SOCIAL_SKIP = /(share|sharer|intent|plugins|dialog|policies|privacy|login|hashtag|\/p\/|\/reel\/|\/explore\/)/i;
const EMAIL_SKIP = /(example\.|sentry|wixpress|godaddy|domain\.com|yourdomain|email\.com$|\.png$|\.jpg$|\.webp$|noreply|no-reply|donotreply)/i;

async function get(url: string, ms: number, maxBytes = 300_000): Promise<{ url: string; text: string } | null> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,text/plain;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(ms) });
    if (!res.ok || !res.body) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!/text\/|html/.test(ct)) return null;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let text = '';
    while (text.length < maxBytes) {
      const { value, done } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
    }
    reader.cancel().catch(() => {});
    return { url: res.url, text };
  } catch { return null; }
}

async function robotsAllows(origin: string): Promise<boolean> {
  const r = await get(origin + '/robots.txt', 4000, 20_000);
  if (!r) return true;
  let applies = false;
  for (const line of r.text.split('\n')) {
    const [k, ...rest] = line.split(':');
    const key = k.trim().toLowerCase(), val = rest.join(':').trim();
    if (key === 'user-agent') applies = val === '*' || /browardspotlight/i.test(val);
    else if (applies && key === 'disallow' && val === '/') return false;
  }
  return true;
}

export function extractFacts(html: string, host: string) {
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  const tel = links.find((l) => /^tel:/i.test(l));
  const phone = cleanPhone(tel?.slice(4)) ?? cleanPhone((html.replace(/<[^>]+>/g, ' ').match(/\(?\b(954|754|305|786|561)\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/) ?? [])[0]);
  const social = (re: RegExp) => { const l = links.find((x) => re.test(x) && !SOCIAL_SKIP.test(x)); return l ? cleanUrl(l.split('?')[0]) : null; };
  const facebook = social(/^https?:\/\/(www\.|m\.)?facebook\.com\/[A-Za-z0-9.\-_]{3,}/i);
  const instagram = social(/^https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]{2,}\/?$/i);
  const base = host.replace(/^www\./, '');
  const mails = [...new Set([...links.filter((l) => /^mailto:/i.test(l)).map((l) => decodeURIComponent(l.slice(7).split('?')[0])), ...(html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [])].map((m) => m.trim().toLowerCase()))]
    .filter((m) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(m) && !EMAIL_SKIP.test(m) && m.length < 80);
  // Prefer an address at the site's own domain; otherwise a common mailbox provider. Never anything else.
  const email = mails.find((m) => m.endsWith('@' + base)) ?? mails.find((m) => /@(gmail|yahoo|outlook|hotmail|aol|icloud|bellsouth|att|comcast)\.(com|net)$/.test(m)) ?? null;
  return { phone, facebook, instagram, email };
}

/** Does this page belong to this listing? Needs the business name and a Broward location signal. */
export function pageMatches(text: string, name: string, city: string | null, zip: string | null): boolean {
  const body = text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').toLowerCase();
  if (PARKED.test(body) || body.replace(/\s+/g, ' ').length < 300) return false;
  const tokens = name.toLowerCase().replace(/\b(llc|inc|corp|the|and|of)\b/g, ' ').match(/[a-z0-9]{3,}/g) ?? [];
  if (!tokens.length || !tokens.every((t) => body.includes(t))) return false;
  const zipHit = !!zip && body.includes(zip);
  const cityHit = !!city && body.includes(city.toLowerCase()) && /\b(fl|florida)\b/.test(body);
  return zipHit || cityHit;
}

function candidates(name: string): string[] {
  const base = name.toLowerCase().replace(/&/g, 'and').replace(/\b(llc|inc|corp|corporation|co|pa|llp|pllc|ltd)\b\.?/g, '').replace(/[^a-z0-9]/g, '');
  if (base.length < 6 || base.length > 32) return [];
  return [`https://www.${base}.com`];
}

/** Stage 2 runner: a small batch each run so it never hammers anyone. */
export async function enrichFromWebsites(env: EnrichEnv, batchSize = 120) {
  const db = env.DB;
  const { results } = await db.prepare(`SELECT id, name, city, zip, website, phone, facebook, instagram FROM businesses
    WHERE status = 'active' AND claimed = 0 AND enrich_checked_at IS NULL
    ORDER BY (website IS NOT NULL) DESC, (category IN ('restaurants','auto','beauty','health','fitness','retail','pets','home-services')) DESC, id
    LIMIT ?`).bind(batchSize).all<{ id: number; name: string; city: string | null; zip: string | null; website: string | null; phone: string | null; facebook: string | null; instagram: string | null }>();
  const save = db.prepare(`UPDATE businesses SET website = COALESCE(website, ?2), website_source = CASE WHEN website IS NULL AND ?2 IS NOT NULL THEN 'auto' ELSE website_source END,
      phone = COALESCE(phone, ?3), facebook = COALESCE(facebook, ?4), instagram = COALESCE(instagram, ?5), contact_email = COALESCE(contact_email, ?6),
      enrich_checked_at = ?7, updated_at = datetime('now') WHERE id = ?1`);
  const miss = db.prepare(`UPDATE businesses SET enrich_checked_at = ?2 WHERE id = ?1`);
  const stamp = nowSql();
  let found = 0, read = 0, emails = 0;
  const out: D1PreparedStatement[] = [];
  for (let i = 0; i < results.length; i += 8) {
    await Promise.all(results.slice(i, i + 8).map(async (b) => {
      const known = !!b.website;
      const urls = known ? [b.website!] : candidates(b.name);
      for (const u of urls) {
        const origin = (() => { try { return new URL(u).origin; } catch { return null; } })();
        if (!origin) continue;
        const page = await get(u, 7000);
        if (!page) continue;
        if (!known && !pageMatches(page.text, b.name, b.city, b.zip)) continue;
        if (!(await robotsAllows(origin))) continue;
        const host = new URL(page.url).hostname;
        const f = extractFacts(page.text, host);
        read++;
        if (!known) found++;
        if (f.email) emails++;
        out.push(save.bind(b.id, known ? null : new URL(page.url).origin + '/', f.phone, f.facebook, f.instagram, f.email, stamp));
        return;
      }
      out.push(miss.bind(b.id, stamp));
    }));
    if (out.length >= 60) await db.batch(out.splice(0));
  }
  if (out.length) await db.batch(out.splice(0));
  return { read: results.length, kept: read, note: `checked ${results.length}; new websites confirmed ${found}; sites read ${read}; contact emails found ${emails}` };
}

/** Stage 3: hand unclaimed listings with a public contact email to HighLevel, a few per day. */
export async function sendClaimInvites(env: EnrichEnv) {
  if (!env.GHL_WEBHOOK_URL) return { read: 0, kept: 0, note: 'GHL_WEBHOOK_URL not set; invitations are off' };
  const perDay = Math.max(0, Number(env.INVITES_PER_DAY ?? 25));
  const sentToday = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM businesses WHERE invited_at >= date('now')`).first<{ n: number }>())?.n ?? 0;
  const room = Math.min(10, perDay - sentToday);
  if (room <= 0) return { read: 0, kept: 0, note: `daily invitation limit reached (${perDay})` };
  const { results } = await env.DB.prepare(`SELECT id, slug, name, city, category, contact_email, phone, website FROM businesses
    WHERE status = 'active' AND claimed = 0 AND contact_email IS NOT NULL AND invited_at IS NULL
      AND contact_email NOT IN (SELECT contact_email FROM businesses WHERE invited_at IS NOT NULL AND contact_email IS NOT NULL)
    GROUP BY contact_email ORDER BY id LIMIT ?`).bind(room).all<{ id: number; slug: string; name: string; city: string | null; category: string; contact_email: string; phone: string | null; website: string | null }>();
  let sent = 0;
  for (const b of results) {
    const ok = await fetch(env.GHL_WEBHOOK_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'claim_invite', source: 'browardspotlight.com', email: b.contact_email, business_name: b.name, city: b.city ?? '', category: b.category,
        phone: b.phone, website: b.website, listing_url: `${env.SITE_URL}/business/${b.slug}`, claim_url: `${env.SITE_URL}/claim/${b.slug}`, tags: ['spotlight-claim-invite'] }),
    }).then((r) => r.ok).catch(() => false);
    if (!ok) break;
    await env.DB.prepare(`UPDATE businesses SET invited_at = datetime('now') WHERE id = ?`).bind(b.id).run();
    sent++;
  }
  return { read: results.length, kept: sent, note: `claim invitations handed to HighLevel: ${sent}` };
}
