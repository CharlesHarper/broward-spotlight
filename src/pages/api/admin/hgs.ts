import type { APIRoute } from 'astro';
import { env, str, token } from '../../../lib/util';
import { CITY_NAMES, categoryLabel } from '../../../lib/shared';
import { ensureHgs, hgsPost, topPitch, ISSUES } from '../../../lib/hgs';

const SAMPLE = { email: 'sample.prospect@example.com', first_name: 'Sam', business_name: 'Sample Plumbing Co', city: 'Davie', category: 'Home services', phone: '9545550100',
  website: 'sampleplumbing.example', preview_url: 'https://browardspotlight.com/p/sample', problem: 'there\'s no tap-to-call button, so people on their phone have to copy your number by hand',
  problems: 'No tap-to-call, No quote or booking button', has_website: 'yes', views: 1, tags: ['hgs-preview'] };

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  const db = e.DB;
  await ensureHgs(db);
  const f = await request.formData();
  const back = (msg: string, view = 'new') => redirect(`/admin/hgs?view=${view}&msg=${encodeURIComponent(msg)}`, 303);
  const action = str(f.get('action'));
  if (action === 'hook') {
    const url = str(f.get('url'), 400);
    if (url && !/^https:\/\/[a-z0-9.-]*(leadconnectorhq|gohighlevel|msgsndr)\.com\//i.test(url)) return back('That doesn\'t look like a HighLevel webhook URL.');
    if (url) await db.prepare(`INSERT INTO import_state (key, value) VALUES ('hgs_webhook_url', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(url).run();
    else await db.prepare(`DELETE FROM import_state WHERE key = 'hgs_webhook_url'`).run();
    // A sample with every field, so HighLevel's trigger can map them. The workflow ignores event "hgs_sample".
    if (url) await hgsPost(db, 'hgs_sample', SAMPLE);
    return back(url ? 'HighLevel connected. A sample was sent so the workflow can map the fields.' : 'HighLevel disconnected.');
  }
  if (action === 'sample') { const ok = await hgsPost(db, 'hgs_sample', SAMPLE); return back(ok ? 'Sample sent to HighLevel.' : 'Couldn\'t reach HighLevel. Check the webhook URL.'); }
  const ids = f.getAll('id').map((x) => Number(x)).filter(Boolean).slice(0, 50);
  if (!ids.length) return back('Pick at least one business.');
  const go = str(f.get('go'));
  if (go === 'skip') {
    await db.batch(ids.map((id) => db.prepare(`UPDATE hgs_prospects SET skip = 1 WHERE business_id = ?`).bind(id)));
    return back(`Skipped ${ids.length}.`);
  }
  const site = e.SITE_URL.replace(/\/$/, '');
  let sent = 0, built = 0, noEmail = 0;
  for (const id of ids) {
    const r = await db.prepare(`SELECT h.*, b.name, b.city_slug, b.category, b.subtype, b.phone, b.website, b.contact_email FROM hgs_prospects h JOIN businesses b ON b.id = h.business_id WHERE h.business_id = ?`).bind(id).first<any>();
    if (!r) continue;
    const t = r.token ?? token(10);
    const first = str(f.get(`first_${id}`), 40) || r.first_name || null;
    const email = r.email ?? r.contact_email ?? null;
    await db.prepare(`UPDATE hgs_prospects SET token = ?, first_name = ?, picked_at = COALESCE(picked_at, datetime('now')) WHERE business_id = ?`).bind(t, first, id).run();
    built++;
    if (go !== 'send') continue;
    if (!email) { noEmail++; continue; }
    const issues: string[] = JSON.parse(r.issues ?? '[]');
    const ok = await hgsPost(db, 'hgs_preview', {
      email, first_name: first ?? '', business_name: r.name, city: r.city_slug ? CITY_NAMES[r.city_slug] : 'Broward', category: categoryLabel(r.category),
      phone: r.phone ?? '', website: r.website ?? '', preview_url: `${site}/p/${t}`, problem: topPitch(issues),
      problems: issues.map((i) => ISSUES[i]?.label ?? i).join(', '), has_website: r.site_status === 'none' ? 'no' : 'yes',
      tags: ['hgs-preview', 'broward-prospect'],
    });
    if (ok) { sent++; await db.prepare(`UPDATE hgs_prospects SET sent_at = datetime('now') WHERE business_id = ?`).bind(id).run(); }
  }
  if (go !== 'send') return back(`Built ${built} preview${built === 1 ? '' : 's'}. Links are under "Previews built".`, 'ready');
  const extra = [noEmail ? `${noEmail} had no email (preview built; send it yourself)` : '', sent < built - noEmail ? 'some didn\'t go out: check the HighLevel connection' : ''].filter(Boolean).join('; ');
  return back(`Sent ${sent} preview${sent === 1 ? '' : 's'}.${extra ? ` ${extra}.` : ''}`, 'sent');
};
