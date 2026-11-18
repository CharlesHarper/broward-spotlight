import type { APIRoute } from 'astro';

// Unclaimed active listings with their claim links, ready to import into HighLevel for owner outreach.
// Only public business details are included; the private state-record phone is left out on purpose.
export const GET: APIRoute = async ({ locals, url }) => {
  const e = locals.runtime.env;
  const city = url.searchParams.get('city');
  const stmt = city
    ? e.DB.prepare(`SELECT name, category, address, city, zip, phone, website, slug FROM businesses WHERE status = 'active' AND claimed = 0 AND city_slug = ? ORDER BY name`).bind(city)
    : e.DB.prepare(`SELECT name, category, address, city, zip, phone, website, slug FROM businesses WHERE status = 'active' AND claimed = 0 ORDER BY city, name`);
  const { results } = await stmt.all<Record<string, string | null>>();
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['Business Name', 'Category', 'Address', 'City', 'Postal Code', 'Phone', 'Website', 'Listing URL', 'Claim URL'];
  const rows = results.map((r) =>
    [r.name, r.category, r.address, r.city, r.zip, r.phone, r.website, `${e.SITE_URL}/business/${r.slug}`, `${e.SITE_URL}/claim/${r.slug}`].map(esc).join(','),
  );
  return new Response([head.join(','), ...rows].join('\n'), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="spotlight-unclaimed${city ? '-' + city : ''}.csv"` },
  });
};
