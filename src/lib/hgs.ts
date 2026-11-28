/**
 * Harper Growth Systems prospecting, built on Broward Spotlight's listings.
 * Each night a few listing websites are checked for problems a better site would fix. Charles picks prospects in admin,
 * each pick gets a personal concept preview page, and HighLevel (HGS account) sends the email and the follow-ups.
 */

export const HGS_UA = 'HarperGrowthSiteCheck/1.0 (+https://tryharpergrowth.com)';

export async function ensureHgs(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS hgs_prospects (
      business_id INTEGER PRIMARY KEY, checked_at TEXT, site_status TEXT, final_url TEXT, score INTEGER NOT NULL DEFAULT 0, issues TEXT,
      email TEXT, builder TEXT, picked_at TEXT, sent_at TEXT, token TEXT UNIQUE, first_name TEXT, views INTEGER NOT NULL DEFAULT 0,
      viewed_at TEXT, outcome TEXT, skip INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hgs_score ON hgs_prospects(skip, sent_at, score DESC)`),
  ]);
}

/** Problems we look for, the weight each adds, and how it reads in plain words to an owner. */
export const ISSUES: Record<string, { weight: number; label: string; pitch: string }> = {
  dead: { weight: 50, label: 'Site down or parked', pitch: 'your website isn\'t loading right now, so anyone who clicks it from Google hits a dead end' },
  none: { weight: 40, label: 'No website', pitch: 'people searching for you can find your phone number but not a website to check you out' },
  no_mobile: { weight: 30, label: 'Not built for phones', pitch: 'your site isn\'t set up for phones, so it shows up tiny and hard to tap on mobile' },
  no_call: { weight: 15, label: 'No tap-to-call', pitch: 'there\'s no tap-to-call button, so people on their phone have to copy your number by hand' },
  no_quote: { weight: 15, label: 'No quote or booking button', pitch: 'there\'s no clear "get a quote" or "book now" button, so visitors have to hunt for how to reach you' },
  no_form: { weight: 10, label: 'No contact form', pitch: 'there\'s no form, so after hours the only option is to call and hope someone picks up' },
  old_copyright: { weight: 10, label: 'Looks out of date', pitch: 'the copyright at the bottom is a few years old, which makes the site look unattended' },
  no_https: { weight: 10, label: 'No secure (https) connection', pitch: 'the site isn\'t secure (no https), so some browsers warn people before they open it' },
};

export function topPitch(issues: string[]) {
  const best = [...issues].sort((a, b) => (ISSUES[b]?.weight ?? 0) - (ISSUES[a]?.weight ?? 0))[0];
  return best ? ISSUES[best]?.pitch ?? '' : '';
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BAD_EMAIL = /(example\.|sentry|wixpress|godaddy|domain\.com|email\.com|yourdomain|\.png|\.jpg|\.gif|\.webp|@2x|noreply|no-reply|u003e)/i;

function pickEmail(html: string, host: string): string | null {
  const mailtos = [...html.matchAll(/mailto:([^"'?>\s]+)/gi)].map((m) => decodeURIComponent(m[1]));
  const found = [...mailtos, ...(html.match(EMAIL_RE) ?? [])].map((x) => x.toLowerCase().trim()).filter((x) => !BAD_EMAIL.test(x) && x.length < 80);
  const base = host.replace(/^www\./, '');
  return found.find((x) => x.endsWith(`@${base}`)) ?? found[0] ?? null;
}

async function get(url: string, ms = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'user-agent': HGS_UA, accept: 'text/html,*/*' }, redirect: 'follow', signal: ctl.signal });
    const type = r.headers.get('content-type') ?? '';
    const body = type.includes('html') || type.includes('text') ? (await r.text()).slice(0, 1_500_000) : '';
    return { ok: r.ok, status: r.status, url: r.url || url, html: body };
  } catch {
    return { ok: false, status: 0, url, html: '' };
  } finally { clearTimeout(t); }
}

/** True when robots.txt tells every crawler to stay off the whole site. */
function blocksAll(txt: string) {
  let agents: string[] = []; let inRules = false; let star = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (inRules) { agents = []; inRules = false; } agents.push(v); continue; }
    inRules = true;
    if (agents.includes('*') && k === 'disallow' && v === '/') star = true;
    if (agents.includes('*') && k === 'allow' && v === '/') return false;
  }
  return star;
}

/** Checks one homepage. Respects robots.txt "Disallow: /" for all agents. */
export async function checkSite(website: string) {
  const start = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  let host = '';
  try { host = new URL(start).host; } catch { return { status: 'dead', issues: ['dead'], email: null, finalUrl: start, builder: null }; }
  const robots = await get(`https://${host}/robots.txt`, 5000);
  if (robots.ok && blocksAll(robots.html)) {
    return { status: 'blocked', issues: [] as string[], email: null, finalUrl: start, builder: null };
  }
  let page = await get(start);
  if (!page.ok && start.startsWith('https://')) page = await get(start.replace('https://', 'http://'));
  const html = page.html;
  const parked = /(domain (is|may be) for sale|buy this domain|parked free|this domain has expired|account suspended|coming soon|under construction)/i.test(html) && html.length < 60_000;
  if (!page.ok || html.length < 400 || parked) return { status: 'dead', issues: ['dead'], email: null, finalUrl: page.url, builder: null };
  if (/leadconnectorhq|msgsndr|gohighlevel/i.test(html)) return { status: 'on_ghl', issues: [] as string[], email: pickEmail(html, host), finalUrl: page.url, builder: 'HighLevel' };
  const issues: string[] = [];
  if (!/<meta[^>]+name=["']?viewport/i.test(html)) issues.push('no_mobile');
  if (!/href=["']?tel:/i.test(html)) issues.push('no_call');
  if (!/(get (a |your )?(free )?(quote|estimate)|request (a )?(quote|estimate|service)|free (quote|estimate)|book (now|online|an appointment|today)|schedule (now|online|service|an appointment)|order online|reserv)/i.test(html)) issues.push('no_quote');
  if (!/<form[\s>]/i.test(html)) issues.push('no_form');
  const years = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1])).filter((y) => y > 1995 && y < 2100);
  if (years.length && Math.max(...years) <= new Date().getUTCFullYear() - 3) issues.push('old_copyright');
  if (page.url.startsWith('http://')) issues.push('no_https');
  const builder = /wix\.com|wixstatic/i.test(html) ? 'Wix' : /squarespace/i.test(html) ? 'Squarespace' : /godaddy|wsimg\.com/i.test(html) ? 'GoDaddy' : /weebly/i.test(html) ? 'Weebly' : /wp-content|wordpress/i.test(html) ? 'WordPress' : /shopify/i.test(html) ? 'Shopify' : null;
  let email = pickEmail(html, host);
  if (!email) {
    const contact = html.match(/href=["']([^"']*contact[^"']*)["']/i)?.[1];
    if (contact) {
      try {
        const c = await get(new URL(contact, page.url).toString(), 7000);
        email = pickEmail(c.html, host);
      } catch { /* bad link */ }
    }
  }
  return { status: issues.length ? 'weak' : 'ok', issues, email, finalUrl: page.url, builder };
}

export const scoreOf = (issues: string[]) => issues.reduce((s, i) => s + (ISSUES[i]?.weight ?? 0), 0);

/** Categories worth prospecting for a website. Restaurants get far more value from Spotlight than a site rebuild, but are included. */
const SKIP_CATS = `('hotels')`;

/** One importer pass: list no-website businesses, then check a handful of websites. */
export async function hgsCheckBatch(db: D1Database, perRun = 10) {
  await ensureHgs(db);
  // Businesses with a phone but no website, once a day.
  const last = await db.prepare(`SELECT value FROM import_state WHERE key = 'hgs_nosite_at'`).first<{ value: string }>().catch(() => null);
  if (!last || Date.now() - Date.parse(last.value) > 864e5) {
    await db.batch([
      db.prepare(`INSERT INTO hgs_prospects (business_id, checked_at, site_status, score, issues)
        SELECT id, datetime('now'), 'none', 40, '["none"]' FROM businesses WHERE status = 'active' AND (website IS NULL OR TRIM(website) = '') AND phone IS NOT NULL AND TRIM(phone) != ''
        AND category NOT IN ${SKIP_CATS} ON CONFLICT(business_id) DO NOTHING`),
      db.prepare(`INSERT INTO import_state (key, value) VALUES ('hgs_nosite_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(new Date().toISOString()),
    ]);
  }
  // Websites not checked in 30 days. Skip chains: a website shared by 3+ listings.
  const { results } = await db.prepare(`SELECT b.id, b.website FROM businesses b LEFT JOIN hgs_prospects h ON h.business_id = b.id
    WHERE b.status = 'active' AND b.website IS NOT NULL AND TRIM(b.website) != '' AND b.category NOT IN ${SKIP_CATS}
      AND (h.business_id IS NULL OR (h.sent_at IS NULL AND h.checked_at < datetime('now', '-30 days')))
      AND (SELECT COUNT(*) FROM businesses x WHERE x.website = b.website) < 3
    ORDER BY h.business_id IS NOT NULL, b.claimed DESC, b.id LIMIT ?`).bind(perRun).all<{ id: number; website: string }>();
  const stmts: D1PreparedStatement[] = [];
  let weak = 0;
  for (const b of results) {
    const r = await checkSite(b.website);
    if (r.status === 'weak' || r.status === 'dead') weak++;
    stmts.push(db.prepare(`INSERT INTO hgs_prospects (business_id, checked_at, site_status, final_url, score, issues, email, builder) VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?)
      ON CONFLICT(business_id) DO UPDATE SET checked_at = excluded.checked_at, site_status = excluded.site_status, final_url = excluded.final_url, score = excluded.score,
        issues = excluded.issues, email = COALESCE(excluded.email, hgs_prospects.email), builder = excluded.builder`)
      .bind(b.id, r.status, r.finalUrl, scoreOf(r.issues), JSON.stringify(r.issues), r.email, r.builder));
  }
  if (stmts.length) await db.batch(stmts);
  return { read: results.length, kept: weak, note: `checked ${results.length}, ${weak} with problems` };
}

export async function hgsWebhook(db: D1Database) {
  return (await db.prepare(`SELECT value FROM import_state WHERE key = 'hgs_webhook_url'`).first<{ value: string }>().catch(() => null))?.value ?? null;
}

export async function hgsPost(db: D1Database, event: string, data: Record<string, unknown>) {
  const url = await hgsWebhook(db);
  if (!url) return false;
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event, source: 'hgs-prospects', sent_at: new Date().toISOString(), ...data }) });
    return r.ok;
  } catch { return false; }
}
