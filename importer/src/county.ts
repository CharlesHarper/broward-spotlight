// Broward County Local Business Tax records (every business with a county business tax receipt).
// Source: Broward County GIS (Records, Taxes & Treasury), public ArcGIS feature service.
// Runs in slices: each run reads PAGES pages of 1,000 records and saves its place, so a full pass
// of ~114,000 records takes a handful of runs. A new full pass starts every REFRESH_DAYS days.

import { normalizeCity, slugify, titleCase, btrCategory, cleanBizName, STOREFRONT_CATEGORIES, CITY_NAMES } from '../../src/lib/shared';

export interface CountyEnv {
  DB: D1Database;
  BTR_URL: string; // .../TaxDatabase2021/FeatureServer/12/query
}

const PAGE = 1000;
const PAGES = 8;
const REFRESH_DAYS = 30;
const BATCH = 90;
const FIELDS = 'OBJECTID,Year,Business_Name,DBA_Name,Owner_Name,Business_Address_Line_1,Business_Address_Line_2,Business_City,Business_Zip,Occupation_Desc_,Category_Name,Business_Start_Date,CITYNAME,Account__';
const FOOD = new Set(['restaurants', 'food-trucks']);

type Attr = Record<string, string | number | null>;
const s = (v: unknown) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();
const norm = (v: string) => v.toLowerCase().replace(/\b(llc|inc|corp|corporation|co|pa|llp|pllc|ltd|the|dba)\b/g, '').replace(/[^a-z0-9]/g, '');

async function getState(db: D1Database, key: string) {
  return (await db.prepare(`SELECT value FROM import_state WHERE key = ?`).bind(key).first<{ value: string }>())?.value ?? null;
}
function setState(db: D1Database, key: string, value: string) {
  return db.prepare(`INSERT INTO import_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(key, value);
}

export async function importCountySlice(env: CountyEnv) {
  const db = env.DB;
  const doneAt = await getState(db, 'btr_done_at');
  if (doneAt && Date.now() - Date.parse(doneAt) < REFRESH_DAYS * 864e5) return { read: 0, kept: 0, note: 'up to date', skipped: true };
  let offset = Number((await getState(db, 'btr_offset')) ?? 0);
  let passStart = await getState(db, 'btr_pass_started');
  if (!passStart || offset === 0) {
    passStart = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await setState(db, 'btr_pass_started', passStart).run();
  }

  // Lookups: existing slugs, existing county accounts, and state-record listings to merge with.
  const slugs = new Set<string>();
  const accounts = new Set<number>();
  const dbprByKey = new Map<string, number>();
  {
    const { results } = await db.prepare(`SELECT id, slug, name, zip, btr_account, dbpr_license FROM businesses`).all<{ id: number; slug: string; name: string; zip: string | null; btr_account: number | null; dbpr_license: string | null }>();
    for (const r of results) {
      slugs.add(r.slug);
      if (r.btr_account) accounts.add(r.btr_account);
      if (r.dbpr_license && !r.btr_account && r.zip) dbprByKey.set(`${norm(r.name)}|${r.zip.slice(0, 5)}`, r.id);
    }
  }

  const upsert = db.prepare(`INSERT INTO businesses (slug, name, category, subtype, address, city, city_slug, zip, source, btr_account, btr_category,
      started_on, lat, lng, hide_street, status, record_seen_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'county', ?9, ?10, ?11, ?12, ?13, ?14, 'active', ?15)
    ON CONFLICT(btr_account) DO UPDATE SET address = excluded.address, city = excluded.city, city_slug = excluded.city_slug, zip = excluded.zip,
      btr_category = excluded.btr_category, started_on = excluded.started_on, lat = excluded.lat, lng = excluded.lng, record_seen_at = excluded.record_seen_at,
      status = CASE WHEN businesses.status = 'inactive' THEN 'active' ELSE businesses.status END, updated_at = datetime('now')`);
  const attach = db.prepare(`UPDATE businesses SET btr_account = ?1, btr_category = ?2, started_on = ?3, lat = ?4, lng = ?5, updated_at = datetime('now') WHERE id = ?6 AND btr_account IS NULL`);

  const pending: D1PreparedStatement[] = [];
  let read = 0, kept = 0, merged = 0, skippedPeople = 0, skippedType = 0, finished = false;

  for (let p = 0; p < PAGES; p++) {
    const url = `${env.BTR_URL}?where=1%3D1&outFields=${FIELDS}&orderByFields=OBJECTID&resultOffset=${offset}&resultRecordCount=${PAGE}&returnGeometry=true&outSR=4326&f=json`;
    const res = await fetch(url, { headers: { 'user-agent': 'BrowardSpotlightImporter/1.0 (+https://browardspotlight.com/how-it-works)' } });
    if (!res.ok) throw new Error(`County data request failed: ${res.status}`);
    const data = (await res.json()) as { features?: { attributes: Attr; geometry?: { x: number; y: number } }[]; error?: { message: string } };
    if (data.error) throw new Error(`County data error: ${data.error.message}`);
    const feats = data.features ?? [];
    for (const f of feats) {
      read++;
      const a = f.attributes;
      const account = Number(a.Account__);
      if (!account) continue;
      const category = btrCategory(s(a.Category_Name), s(a.Occupation_Desc_));
      if (!category) { skippedType++; continue; }
      const legal = s(a.Business_Name), dba = s(a.DBA_Name), owner = s(a.Owner_Name);
      // Privacy: a business registered under a person's own name, with no trade name, is skipped.
      if (!dba && (!/[a-z]/i.test(legal) || (owner && norm(legal) === norm(owner)))) { skippedPeople++; continue; }
      const name = cleanBizName(dba || legal);
      if (!name) continue;
      const city = normalizeCity(s(a.CITYNAME) || s(a.Business_City));
      const zip = s(a.Business_Zip).slice(0, 5) || null;
      const started = a.Business_Start_Date ? new Date(Number(a.Business_Start_Date)).toISOString().slice(0, 10) : null;
      const lat = f.geometry?.y ?? null, lng = f.geometry?.x ?? null;

      // Merge into the matching state-record listing when there is one (same name and ZIP).
      const match = zip ? dbprByKey.get(`${norm(name)}|${zip}`) ?? dbprByKey.get(`${norm(legal)}|${zip}`) : undefined;
      if (match) {
        pending.push(attach.bind(account, s(a.Category_Name), started, lat, lng, match));
        dbprByKey.delete(`${norm(name)}|${zip}`);
        merged++;
      } else if (FOOD.has(category)) {
        // Food businesses come from state inspection records; don't create duplicates from tax records.
        skippedType++;
        continue;
      } else {
        const addr1 = s(a.Business_Address_Line_1), addr2 = s(a.Business_Address_Line_2);
        const address = titleCase([addr1, addr2].filter(Boolean).join(' ')) || null;
        const hide = !STOREFRONT_CATEGORIES.has(category) || /\b(APT|LOT|TRLR)\b/i.test(`${addr1} ${addr2}`) ? 1 : 0;
        let slug = '';
        if (!accounts.has(account)) {
          const base = slugify(`${name} ${city?.name ?? ''}`) || `business-${account}`;
          slug = slugs.has(base) ? `${base}-${account}` : base;
          for (let i = 2; slugs.has(slug); i++) slug = `${base}-${account}-${i}`;
          slugs.add(slug);
          accounts.add(account);
        } else slug = `__existing-${account}`; // slug ignored on update
        pending.push(upsert.bind(slug, name, category, titleCase(s(a.Occupation_Desc_)) || null, address, city?.name ?? null,
          city && CITY_NAMES[city.slug] ? city.slug : city?.slug ?? null, zip, account, s(a.Category_Name) || null, started, lat, lng, hide, passStart));
      }
      kept++;
      if (pending.length >= BATCH) await db.batch(pending.splice(0));
    }
    offset += feats.length;
    if (feats.length < PAGE) { finished = true; break; }
  }
  if (pending.length) await db.batch(pending.splice(0));

  if (finished) {
    // Businesses that no longer appear in the county records are marked inactive (never deleted).
    if (offset > 50000) {
      await db.prepare(`UPDATE businesses SET status = 'inactive', updated_at = datetime('now') WHERE source = 'county' AND status = 'active' AND record_seen_at < ?`).bind(passStart).run();
    }
    await db.batch([setState(db, 'btr_offset', '0'), setState(db, 'btr_done_at', new Date().toISOString()), setState(db, 'btr_last_total', String(offset))]);
  } else {
    await setState(db, 'btr_offset', String(offset)).run();
  }
  return { read, kept, note: `offset ${offset}${finished ? ' (pass complete)' : ''}; merged with state records ${merged}; skipped personal-name registrations ${skippedPeople}; skipped non-listing types or duplicate food ${skippedType}` };
}
