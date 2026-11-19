// Broward Spotlight weekly importer.
// Pulls Florida DBPR food service licenses and inspections for District 2 (Broward, Palm Beach, Martin),
// keeps Broward rows, and upserts them into the shared D1 database.

import { csvRows } from './csv';
import { importCountySlice } from './county';
import { enrichFromOsm, enrichFromWebsites, sendClaimInvites } from './enrich';
import { normalizeCity, titleCase, slugify, dispositionTone, dbprRank, CITY_NAMES } from '../../src/lib/shared';

interface Env {
  DB: D1Database;
  DBPR_BASE: string;            // https://www2.myfloridalicense.com/sto/file_download/extracts
  DBPR_DISTRICT: string;        // "2"
  BROWARD_COUNTY_CODE: string;  // county code on the license file
  IMPORT_KEY?: string;
  BTR_URL: string;               // Broward County Local Business Tax feature service query URL
  OVERPASS_URL: string;
  SITE_URL: string;
  GHL_WEBHOOK_URL?: string;
  INVITES_PER_DAY?: string;
}

const BATCH = 80;
const UA = 'BrowardSpotlightImporter/1.0 (+https://browardspotlight.com/how-it-works)';

/** DBPR dates come as MM/DD/YYYY (sometimes with a time). Returns YYYY-MM-DD or null. */
export function isoDate(s: string | undefined): string | null {
  const v = (s ?? '').trim();
  let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
const int = (s: string | undefined) => { const n = parseInt((s ?? '').trim(), 10); return Number.isFinite(n) ? n : null; };
const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
/** The license file writes numbers with a letter prefix (SEA1600567); inspections without (1600567). Compare digits. */
const lic = (type: string | undefined, s: string | undefined) => {
  const digits = clean(s).toUpperCase().replace(/^[A-Z]+/, '');
  return digits ? `${clean(type) || '0'}-${digits}` : '';
};

async function fetchCsv(url: string) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/csv,*/*' } });
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status} for ${url}`);
  return res.body;
}

async function flush(db: D1Database, stmts: D1PreparedStatement[]) {
  if (stmts.length) await db.batch(stmts.splice(0, stmts.length));
}

export async function importLicenses(env: Env, runStart: string) {
  const db = env.DB;
  const url = `${env.DBPR_BASE}/hrfood${env.DBPR_DISTRICT}.csv`;
  const existing = new Map<string, string>(); // license -> slug
  const slugs = new Set<string>();
  {
    const { results } = await db.prepare(`SELECT slug, dbpr_license FROM businesses`).all<{ slug: string; dbpr_license: string | null }>();
    for (const r of results) { slugs.add(r.slug); if (r.dbpr_license) existing.set(r.dbpr_license, r.slug); }
  }
  const stmt = db.prepare(`INSERT INTO businesses (slug, name, category, subtype, address, city, city_slug, zip, record_phone, license_holder, source,
      dbpr_license, dbpr_rank, license_status, license_expires, seats, status, record_seen_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'dbpr', ?11, ?12, ?13, ?14, ?15, 'active', ?16)
    ON CONFLICT(dbpr_license) DO UPDATE SET name = excluded.name, address = excluded.address, city = excluded.city, city_slug = excluded.city_slug,
      zip = excluded.zip, record_phone = excluded.record_phone, license_holder = excluded.license_holder, dbpr_rank = excluded.dbpr_rank,
      license_status = excluded.license_status, license_expires = excluded.license_expires, seats = excluded.seats, record_seen_at = excluded.record_seen_at,
      status = CASE WHEN businesses.status = 'inactive' THEN 'active' ELSE businesses.status END,
      updated_at = datetime('now')`);
  const pending: D1PreparedStatement[] = [];
  const ranks = new Map<string, number>();
  let read = 0, kept = 0, sample = '';
  let cols = { type: 1, name: 14, addr: 16, city: 19, zip: 21, county: 22, phone: 12, holder: 2, rank: 3, license: 26, status: 27, expires: 29, seats: 31 };
  for await (const row of csvRows(await fetchCsv(url))) {
    if (read === 0 && row.some((c) => /license number/i.test(c))) {
      // Header row present: map by name.
      const idx = (re: RegExp, fb: number) => { const i = row.findIndex((c) => re.test(c)); return i >= 0 ? i : fb; };
      cols = {
        type: idx(/license type/i, cols.type), name: idx(/^business name|location name|dba/i, cols.name), addr: idx(/location (street )?address( line)? ?1/i, cols.addr),
        city: idx(/location city/i, cols.city), zip: idx(/location zip/i, cols.zip), county: idx(/location county/i, cols.county),
        phone: idx(/primary telephone/i, cols.phone), holder: idx(/licensee name/i, cols.holder), rank: idx(/rank code/i, cols.rank),
        license: idx(/license number/i, cols.license), status: idx(/primary status/i, cols.status), expires: idx(/expir/i, cols.expires),
        seats: idx(/seats|units/i, cols.seats),
      };
      read++;
      continue;
    }
    read++;
    const license = lic(row[cols.type], row[cols.license]);
    if (!license) continue;
    const city = normalizeCity(row[cols.city]);
    const isBroward = clean(row[cols.county]) === env.BROWARD_COUNTY_CODE || (city && CITY_NAMES[city.slug]);
    if (!isBroward || !city) continue;
    const rankCode = clean(row[cols.rank]).toUpperCase();
    ranks.set(rankCode, (ranks.get(rankCode) ?? 0) + 1);
    const r = dbprRank(rankCode);
    const name = titleCase(clean(row[cols.name]) || clean(row[cols.holder]));
    let slug = existing.get(license);
    if (!slug) {
      const base = slugify(`${name} ${city.name}`) || `business-${license}`;
      slug = slugs.has(base) ? `${base}-${license.slice(-4)}` : base;
      for (let i = 2; slugs.has(slug); i++) slug = `${base}-${license.slice(-4)}-${i}`;
      slugs.add(slug);
      existing.set(license, slug);
    }
    if (!sample) sample = `first row: license=${license} name=${name} city=${city.name} county=${clean(row[cols.county])} rank=${rankCode}`;
    pending.push(stmt.bind(slug, name, r.category, r.subtype, titleCase(clean(row[cols.addr])) || null, city.name, city.slug,
      clean(row[cols.zip]).slice(0, 5) || null, clean(row[cols.phone]) || null, titleCase(clean(row[cols.holder])) || null,
      license, rankCode || null, clean(row[cols.status]) || null, isoDate(row[cols.expires]), int(row[cols.seats]), runStart));
    kept++;
    if (pending.length >= BATCH) await flush(db, pending);
  }
  await flush(db, pending);
  // Licenses that dropped off the active file are marked inactive, never deleted. Guard against a bad download.
  if (kept > 500) {
    await db.prepare(`UPDATE businesses SET status = 'inactive', updated_at = datetime('now')
      WHERE source = 'dbpr' AND status = 'active' AND (record_seen_at IS NULL OR record_seen_at < ?)`).bind(runStart).run();
  }
  const rankNote = [...ranks.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k || '(blank)'}:${n}`).join(' ');
  return { read, kept, note: `${sample}; rank codes ${rankNote}` };
}

export async function importInspections(env: Env, runStart: string) {
  const db = env.DB;
  const url = `${env.DBPR_BASE}/${env.DBPR_DISTRICT}fdinspi.csv`;
  const known = new Map<string, number>();
  const slugs = new Set<string>();
  {
    const { results } = await db.prepare(`SELECT id, slug, dbpr_license FROM businesses`).all<{ id: number; slug: string; dbpr_license: string | null }>();
    for (const r of results) { slugs.add(r.slug); if (r.dbpr_license) known.set(r.dbpr_license, r.id); }
  }
  const insBiz = db.prepare(`INSERT INTO businesses (slug, name, category, subtype, address, city, city_slug, zip, source, dbpr_license, status)
    VALUES (?1, ?2, 'restaurants', 'Food service establishment', ?3, ?4, ?5, ?6, 'dbpr', ?7, 'inactive') ON CONFLICT(dbpr_license) DO NOTHING`);
  const insInsp = db.prepare(`INSERT INTO inspections (visit_id, license_number, business_id, inspection_number, date, type, disposition, tone,
      total_violations, high_priority, intermediate, basic)
    VALUES (?1, ?2, (SELECT id FROM businesses WHERE dbpr_license = ?2), ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
    ON CONFLICT(visit_id) DO UPDATE SET business_id = excluded.business_id, date = excluded.date, type = excluded.type, disposition = excluded.disposition,
      tone = excluded.tone, total_violations = excluded.total_violations, high_priority = excluded.high_priority,
      intermediate = excluded.intermediate, basic = excluded.basic`);
  const pending: D1PreparedStatement[] = [];
  const dispositions = new Map<string, number>();
  let read = 0, kept = 0, created = 0, sample = '';
  for await (const row of csvRows(await fetchCsv(url))) {
    read++;
    if (read === 1 && row.some((c) => /license number|county name/i.test(c))) continue; // header
    const county = clean(row[2]).toUpperCase();
    if (!county.includes('BROWARD')) continue;
    const license = lic(row[3], row[4]);
    const date = isoDate(row[14]);
    if (!license || !date) continue;
    if (!known.has(license)) {
      const city = normalizeCity(row[7]);
      const name = titleCase(clean(row[5]));
      const base = slugify(`${name} ${city?.name ?? ''}`) || `business-${license}`;
      let slug = slugs.has(base) ? `${base}-${license.slice(-4)}` : base;
      for (let i = 2; slugs.has(slug); i++) slug = `${base}-${license.slice(-4)}-${i}`;
      slugs.add(slug);
      pending.push(insBiz.bind(slug, name, titleCase(clean(row[6])) || null, city?.name ?? null, city?.slug ?? null, clean(row[8]).slice(0, 5) || null, license));
      known.set(license, -1);
      created++;
    }
    const visitId = clean(row[81]) || `${clean(row[9])}-${clean(row[10])}`;
    const disp = clean(row[13]);
    dispositions.set(disp, (dispositions.get(disp) ?? 0) + 1);
    if (!sample) sample = `first row: license=${license} date=${date} type=${clean(row[12])} disposition=${disp} visit=${visitId}`;
    pending.push(insInsp.bind(visitId, license, clean(row[9]) || null, date, clean(row[12]) || null, disp || null, dispositionTone(disp),
      int(row[17]), int(row[18]), int(row[19]), int(row[20])));
    kept++;
    if (pending.length >= BATCH) await flush(db, pending);
  }
  await flush(db, pending);
  // Roll the latest inspection onto each listing for fast list pages.
  await db.prepare(`UPDATE businesses SET
      last_inspection_date = (SELECT i.date FROM inspections i WHERE i.business_id = businesses.id ORDER BY i.date DESC, i.id DESC LIMIT 1),
      last_inspection_disposition = (SELECT i.disposition FROM inspections i WHERE i.business_id = businesses.id ORDER BY i.date DESC, i.id DESC LIMIT 1),
      last_inspection_tone = (SELECT i.tone FROM inspections i WHERE i.business_id = businesses.id ORDER BY i.date DESC, i.id DESC LIMIT 1)
    WHERE source = 'dbpr'`).run();
  const dispNote = [...dispositions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k}:${n}`).join(' | ');
  return { read, kept, note: `${sample}; ${created} listings created from inspections only; dispositions ${dispNote}` };
}

async function logRun(db: D1Database, kind: string, started: string, fn: () => Promise<{ read: number; kept: number; note: string }>) {
  const { meta } = await db.prepare(`INSERT INTO import_runs (kind, started_at) VALUES (?, ?)`).bind(kind, started).run();
  const id = meta.last_row_id;
  try {
    const r = await fn();
    await db.prepare(`UPDATE import_runs SET finished_at = datetime('now'), rows_read = ?, rows_kept = ?, note = ? WHERE id = ?`).bind(r.read, r.kept, r.note.slice(0, 2000), id).run();
    return r;
  } catch (err) {
    await db.prepare(`UPDATE import_runs SET finished_at = datetime('now'), note = ? WHERE id = ?`).bind(`FAILED: ${(err as Error).message}`.slice(0, 2000), id).run();
    throw err;
  }
}

export async function runAll(env: Env) {
  const started = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lic = await logRun(env.DB, 'dbpr-licenses', started, () => importLicenses(env, started));
  const insp = await logRun(env.DB, 'dbpr-inspections', started, () => importInspections(env, started));
  return { lic, insp };
}

const WEEKLY_DBPR = '17 11 * * 2';

async function countySlice(env: Env) {
  const started = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const peek = await env.DB.prepare(`SELECT value FROM import_state WHERE key = 'btr_done_at'`).first<{ value: string }>();
  if (peek && Date.now() - Date.parse(peek.value) < 30 * 864e5) return { skipped: true };
  return logRun(env.DB, 'county-business-tax', started, () => importCountySlice(env));
}

/** Every 20 minutes: county records until the pass is done, then enrichment and claim invitations. */
async function routine(env: Env) {
  const county = await countySlice(env);
  if (!(county as { skipped?: boolean }).skipped) return county;
  const started = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const osmAt = await env.DB.prepare(`SELECT value FROM import_state WHERE key = 'osm_done_at'`).first<{ value: string }>();
  if (!osmAt || Date.now() - Date.parse(osmAt.value) > 30 * 864e5) {
    const r = await logRun(env.DB, 'openstreetmap', started, () => enrichFromOsm(env));
    await env.DB.prepare(`INSERT INTO import_state (key, value) VALUES ('osm_done_at', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = datetime('now')`).bind(new Date().toISOString()).run();
    return r;
  }
  const sites = await logRun(env.DB, 'website-reader', started, () => enrichFromWebsites(env));
  const inv = await sendClaimInvites(env);
  if (inv.kept) await env.DB.prepare(`INSERT INTO import_runs (kind, started_at, finished_at, rows_read, rows_kept, note) VALUES ('claim-invites', ?, datetime('now'), ?, ?, ?)`).bind(started, inv.read, inv.kept, inv.note).run();
  return { sites, inv };
}

export default {
  async scheduled(c: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (c.cron === WEEKLY_DBPR) return ctx.waitUntil(runAll(env));
    // First run after deploy: load state records once right away instead of waiting for Tuesday.
    const done = await env.DB.prepare(`SELECT 1 FROM import_runs WHERE kind = 'dbpr-inspections' AND finished_at IS NOT NULL AND note NOT LIKE 'FAILED%' LIMIT 1`).first();
    const running = await env.DB.prepare(`SELECT 1 FROM import_runs WHERE finished_at IS NULL AND started_at > datetime('now', '-30 minutes') LIMIT 1`).first();
    if (running) return;
    ctx.waitUntil(done ? routine(env) : runAll(env));
  },
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);
    if (req.method === 'POST' && (url.pathname === '/run' || url.pathname === '/run-county')) {
      if (!env.IMPORT_KEY || req.headers.get('x-import-key') !== env.IMPORT_KEY) return new Response('Forbidden', { status: 403 });
      const job = url.pathname === '/run' ? () => runAll(env) : () => routine(env);
      if (url.searchParams.get('wait')) return Response.json(await job());
      ctx.waitUntil(job());
      return new Response('Import started. Check /admin for results in a few minutes.');
    }
    return new Response('Broward Spotlight importer. State records every Tuesday; county business tax records in slices every 20 minutes until a full pass is done, then monthly.');
  },
};
