import type { APIRoute } from 'astro';
import { env, str, token, ghl, normUrl, isEmail, stopInviteReminders } from '../../../lib/util';
import { CATEGORIES, CITY_NAMES, slugify } from '../../../lib/shared';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  const db = e.DB;
  const f = await request.formData();
  const action = str(f.get('action'), 40);
  const id = Number(str(f.get('id'))) || 0;
  const back = (msg: string, tab = '') => redirect(`/admin?${tab ? `tab=${tab}&` : ''}msg=${encodeURIComponent(msg)}`, 303);
  const site = (p: string) => new URL(p, e.SITE_URL).toString();

  async function sendOwnerLink(businessId: number, email: string, name?: string) {
    const t = token(24);
    const b = await db.prepare(`UPDATE businesses SET claimed = 1, owner_token = ?, owner_email = ?, updated_at = datetime('now') WHERE id = ? RETURNING name, slug`)
      .bind(t, email, businessId).first<{ name: string; slug: string }>();
    if (b) await ghl(e, 'owner_link', { email, name, business_name: b.name, owner_url: site(`/owner/${t}`), business_url: site(`/business/${b.slug}`), tags: ['spotlight-owner'] });
    // If we invited a different address for this business, stop its reminders too.
    const inv = await db.prepare(`SELECT contact_email FROM businesses WHERE id = ?`).bind(businessId).first<{ contact_email: string | null }>();
    if (inv?.contact_email && inv.contact_email.toLowerCase() !== email.toLowerCase()) await stopInviteReminders(e, businessId);
    return t;
  }

  switch (action) {
    case 'review_approve': {
      const r = await db.prepare(`UPDATE reviews SET status = 'approved' WHERE id = ? RETURNING business_id, rating`).bind(id).first<{ business_id: number; rating: number }>();
      if (r) {
        const b = await db.prepare(`SELECT name, slug, owner_email, owner_token FROM businesses WHERE id = ?`).bind(r.business_id).first<any>();
        if (b?.owner_email) await ghl(e, 'new_review_for_owner', { email: b.owner_email, business_name: b.name, rating: r.rating, owner_url: b.owner_token ? site(`/owner/${b.owner_token}`) : null, tags: ['spotlight-owner'] });
        else if (b) await ghl(e, 'new_review_unclaimed', { business_name: b.name, business_url: site(`/business/${b.slug}`), claim_url: site(`/claim/${b.slug}`), rating: r.rating });
      }
      return back('Review published.');
    }
    case 'review_reject':
      await db.prepare(`UPDATE reviews SET status = 'rejected' WHERE id = ?`).bind(id).run();
      return back('Review rejected.');
    case 'claim_approve': {
      const c = await db.prepare(`UPDATE claims SET status = 'approved' WHERE id = ? RETURNING business_id, email, name`).bind(id).first<{ business_id: number; email: string; name: string }>();
      if (c) {
        await sendOwnerLink(c.business_id, c.email, c.name);
        await db.prepare(`UPDATE claims SET status = 'rejected' WHERE business_id = ? AND status = 'pending'`).bind(c.business_id).run();
      }
      return back(e.GHL_WEBHOOK_URL ? 'Claim approved. Owner link sent through HighLevel.' : 'Claim approved. Set GHL_WEBHOOK_URL to email owner links automatically; for now copy it from the listing edit page.');
    }
    case 'claim_reject':
      await db.prepare(`UPDATE claims SET status = 'rejected' WHERE id = ?`).bind(id).run();
      return back('Claim rejected.');
    case 'business_approve': {
      const b = await db.prepare(`UPDATE businesses SET status = 'active', updated_at = datetime('now') WHERE id = ? RETURNING owner_email`).bind(id).first<{ owner_email: string | null }>();
      if (b?.owner_email) await sendOwnerLink(id, b.owner_email);
      return back('Listing published.');
    }
    case 'business_reject':
      await db.prepare(`UPDATE businesses SET status = 'hidden' WHERE id = ?`).bind(id).run();
      return back('Listing hidden.');
    case 'photo_remove': {
      const p = await db.prepare(`UPDATE photos SET status = 'removed' WHERE id = ? RETURNING business_id`).bind(id).first<{ business_id: number }>();
      if (p) await db.prepare(`DELETE FROM photo_data WHERE photo_id = ?`).bind(id).run();
      return redirect(`/admin/business?id=${p?.business_id ?? ''}`, 303);
    }
    case 'lead_done':
      await db.prepare(`UPDATE leads SET status = 'done' WHERE id = ?`).bind(id).run();
      return back('Marked handled.');
    case 'owner_link': {
      const b = await db.prepare(`SELECT owner_email FROM businesses WHERE id = ?`).bind(id).first<{ owner_email: string | null }>();
      if (!b?.owner_email) return redirect(`/admin/business?id=${id}`, 303);
      await sendOwnerLink(id, b.owner_email);
      return redirect(`/admin/business?id=${id}`, 303);
    }
    case 'business_save': {
      const name = str(f.get('name'), 120);
      const category = CATEGORIES.some((c) => c.slug === str(f.get('category'))) ? str(f.get('category')) : 'other';
      const citySlug = CITY_NAMES[str(f.get('city_slug'))] ? str(f.get('city_slug')) : null;
      const vals = {
        name, category, subtype: str(f.get('subtype'), 60) || null, address: str(f.get('address'), 160) || null,
        city: citySlug ? CITY_NAMES[citySlug] : null, city_slug: citySlug, zip: str(f.get('zip'), 10) || null,
        phone: str(f.get('phone'), 40) || null, website: normUrl(str(f.get('website'), 300)), facebook: normUrl(str(f.get('facebook'), 300)),
        instagram: normUrl(str(f.get('instagram'), 300)), hours: str(f.get('hours'), 500) || null, description: str(f.get('description'), 2000) || null,
        status: ['active', 'pending', 'hidden'].includes(str(f.get('status'))) ? str(f.get('status')) : 'active',
      };
      if (!name) return new Response('Name is required', { status: 400 });
      if (id) {
        const ownerEmail = str(f.get('owner_email'), 200);
        await db.prepare(`UPDATE businesses SET name=?, category=?, subtype=?, address=?, city=?, city_slug=?, zip=?, phone=?, website=?, facebook=?, instagram=?, hours=?, description=?, status=?, owner_email=?, updated_at=datetime('now') WHERE id=?`)
          .bind(vals.name, vals.category, vals.subtype, vals.address, vals.city, vals.city_slug, vals.zip, vals.phone, vals.website, vals.facebook, vals.instagram, vals.hours, vals.description, vals.status, isEmail(ownerEmail) ? ownerEmail : null, id).run();
        return redirect(`/admin/business?id=${id}`, 303);
      }
      const base = slugify(`${name} ${vals.city ?? ''}`);
      let slug = base;
      for (let i = 2; await db.prepare(`SELECT 1 FROM businesses WHERE slug = ?`).bind(slug).first(); i++) slug = `${base}-${i}`;
      const r = await db.prepare(`INSERT INTO businesses (slug, name, category, subtype, address, city, city_slug, zip, phone, website, facebook, instagram, hours, description, status, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin') RETURNING id`)
        .bind(slug, vals.name, vals.category, vals.subtype, vals.address, vals.city, vals.city_slug, vals.zip, vals.phone, vals.website, vals.facebook, vals.instagram, vals.hours, vals.description, vals.status).first<{ id: number }>();
      return redirect(`/admin/business?id=${r!.id}`, 303);
    }
    case 'mention_add': {
      const bid = Number(str(f.get('business_id')));
      const url = normUrl(str(f.get('url'), 500));
      if (!bid || !url) return new Response('Link is required', { status: 400 });
      const pub = str(f.get('published_on'));
      await db.prepare(`INSERT INTO mentions (business_id, title, url, source, summary, published_on) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(bid, str(f.get('title'), 200), url, str(f.get('source'), 80), str(f.get('summary'), 400) || null, DATE.test(pub) ? pub : null).run();
      return redirect(`/admin/business?id=${bid}`, 303);
    }
    case 'mention_delete': {
      await db.prepare(`DELETE FROM mentions WHERE id = ?`).bind(id).run();
      return redirect(`/admin/business?id=${Number(str(f.get('business_id')))}`, 303);
    }
    case 'placement_add': {
      const b = await db.prepare(`SELECT id FROM businesses WHERE slug = ?`).bind(str(f.get('slug'), 120)).first<{ id: number }>();
      const s = str(f.get('starts_on')), en = str(f.get('ends_on'));
      if (!b || !DATE.test(s) || !DATE.test(en)) return new Response('Check the business slug and dates.', { status: 400 });
      const city = str(f.get('city_slug'), 60), cat = str(f.get('category'), 40);
      await db.prepare(`INSERT INTO placements (business_id, city_slug, category, starts_on, ends_on, note) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(b.id, CITY_NAMES[city] ? city : null, CATEGORIES.some((c) => c.slug === cat) ? cat : null, s, en, str(f.get('note'), 200) || null).run();
      return back('Featured placement added.', 'money');
    }
    case 'placement_end':
      await db.prepare(`UPDATE placements SET ends_on = date('now', '-1 day') WHERE id = ?`).bind(id).run();
      return back('Placement ended.', 'money');
    case 'ad_add': {
      const s = str(f.get('starts_on')), en = str(f.get('ends_on'));
      const img = normUrl(str(f.get('image_url'), 500)), link = normUrl(str(f.get('link_url'), 500));
      const slot = ['home', 'city', 'category'].includes(str(f.get('slot'))) ? str(f.get('slot')) : 'home';
      if (!img || !link || !DATE.test(s) || !DATE.test(en)) return new Response('Check the image link, click link and dates.', { status: 400 });
      await db.prepare(`INSERT INTO ads (advertiser, slot, scope_slug, image_url, link_url, alt, starts_on, ends_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(str(f.get('advertiser'), 120), slot, str(f.get('scope_slug'), 60) || null, img, link, str(f.get('alt'), 200), s, en).run();
      return back('Ad added.', 'money');
    }
    case 'ad_end':
      await db.prepare(`UPDATE ads SET ends_on = date('now', '-1 day') WHERE id = ?`).bind(id).run();
      return back('Ad ended.', 'money');
    case 'city_save':
      await db.prepare(`UPDATE cities SET intro = ? WHERE slug = ?`).bind(str(f.get('intro'), 800) || null, str(f.get('slug'), 60)).run();
      return back('City intro saved.', 'cities');
  }
  return new Response('Unknown action', { status: 400 });
};
