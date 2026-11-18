# Broward Spotlight

A public-record business directory for Broward County: state inspection results, license records,
owner-verified listings, customer reviews, and labeled paid placement.

**Stack:** Astro 5 on Cloudflare Workers, Cloudflare D1 (database `broward-spotlight`, already created and
loaded with tables), a second Worker that imports public records, and HighLevel for every email.

**Where listings come from, automatically:**
- **Broward County Local Business Tax records** (~114,000 businesses, every industry): name, trade name, business
  type, city, ZIP, start date, map point. Imported in slices every 20 minutes until a full pass is done, then refreshed monthly.
- **Florida DBPR food service records** (restaurants, food trucks, caterers): licenses and every inspection, weekly.
- Owners, your admin page, and "Add your business" fill in the rest.

**Privacy rules built into the import:** owner names and mailing addresses are never imported; businesses registered
under a person's own name with no trade name are skipped; vacation-rental homes, apartments and vending machines are
skipped; street addresses for service businesses (contractors, cleaners, consultants) are hidden until the owner claims
the listing, because many of those are run from home. Bare county-only listings are kept out of Google (noindex) until
they have a review, a description or a verified owner, so the site isn't judged on 100,000 thin pages.

## What's in here

| Path | What it does |
| --- | --- |
| `src/pages/` | Every page: home, city, category, search, listing, inspection report, advertise, add a business, claim, owner page, admin |
| `src/pages/api/` | Form handlers: reviews, claims, corrections, new businesses, advertising inquiries, owner edits, admin actions |
| `migrations/0001_init.sql` | Database tables, full-text search, and the 31 Broward cities |
| `importer/` | Weekly DBPR import Worker (food service licenses + inspections, District 2, Broward rows only) |
| `sample-data/` | Fictional test files in the DBPR layout. Never deploy these. |

## Deploy (about 20 minutes, one time)

You need a Cloudflare account on the Workers Paid plan ($5/month) and Node 20+.

```bash
npm install
npx wrangler login

# 1-2. Done already: database broward-spotlight (b0960906-88f6-4a53-84ca-241d5b556ebf) exists with all tables,
#      and both wrangler.jsonc files point at it.

# 3. Secrets for the website
npx wrangler secret put ADMIN_PASSWORD      # your admin password (username is "admin")
npx wrangler secret put GHL_WEBHOOK_URL     # HighLevel inbound webhook URL (see below)

# 4. Deploy the website
npm run deploy

# 5. Deploy the importer and run the first import
cd importer
npx wrangler secret put IMPORT_KEY          # any long random string
npx wrangler deploy
curl -X POST -H "x-import-key: YOUR_IMPORT_KEY" https://broward-spotlight-importer.<your-subdomain>.workers.dev/run
curl -X POST -H "x-import-key: YOUR_IMPORT_KEY" https://broward-spotlight-importer.<your-subdomain>.workers.dev/run-county
```

The county pass then continues on its own every 20 minutes until all ~114,000 records are in (about 5 hours).

Then in the Cloudflare dashboard: Workers & Pages → broward-spotlight → Settings → Domains → add
`browardspotlight.com` (the domain must be on Cloudflare DNS). Recommended: put `/admin*` behind
Cloudflare Access too.

After the first import, open `/admin` → Queue → **Data imports**. The note lists the rank codes and
inspection results it saw. If the listing count looks wrong, check `BROWARD_COUNTY_CODE` in
`importer/wrangler.jsonc`.

## HighLevel setup

Create one workflow with an **Inbound Webhook** trigger and paste its URL into `GHL_WEBHOOK_URL`.
Every payload has `event`, `email` (when there is one), `name`, `business_name` and `tags`.
Branch on `event`:

| event | Send |
| --- | --- |
| `review_submitted` | Email the reviewer `verify_url` ("Confirm your review") |
| `claim_submitted` | Internal notification to you: call the business to verify |
| `owner_link` | Email the owner `owner_url` ("You're verified: manage your listing") |
| `new_review_for_owner` | Email the owner: new review, reply at `owner_url` |
| `new_review_unclaimed` | Optional: outreach to the business with `claim_url` |
| `business_submitted` | Internal notification |
| `advertise_inquiry` | Create an opportunity in your Spotlight pipeline + notify you |
| `correction_reported` | Internal notification |

**Owner outreach:** Admin → "Export unclaimed (CSV for GHL)" downloads every unclaimed listing with its
claim link. Import it into GHL and run your claim-your-listing campaign. Use only real business email
addresses and include your physical address and an unsubscribe link (CAN-SPAM).

## Running your admin

- **Queue:** publish reviews (every genuine one, good or bad), approve claims after you verify by phone,
  publish new businesses, handle leads.
- **Featured & ads:** add a Featured placement by the listing's address (`/business/<slug>`), with a city,
  category or both, and start and end dates. It shows up labeled and drops off on its end date.
- **Find & edit:** edit any listing, add "Around the web" mentions (link + your own one-line summary).
- **City intros:** two or three original sentences per city make each city page unique.

## Known limits (v1)

- County records give name, type and location, not phone numbers or websites. Those come from owners when they claim.
  Next importer: DBPR professional licenses (contractors, salons, barbers) to add license status to those listings.
- Inspection history starts with the current state fiscal year (from July 1) and grows weekly. Older years
  are in large statewide spreadsheets and need a one-time backfill script.
- Sunbiz, Google Maps, news and Reddit are linked out from each listing, not copied in, to respect those
  sites' terms.
- Terms and Privacy pages are starters. Have a Florida attorney review them before launch.

## Local development

```bash
npm install
npm run db:migrate:local
echo "ADMIN_PASSWORD=localtest" > .dev.vars
# serve fictional sample data and import it
(cd sample-data && python3 -m http.server 8099 &)
(cd importer && echo "IMPORT_KEY=localkey" > .dev.vars && npx wrangler dev --port 8790 --persist-to ../.wrangler/state --var DBPR_BASE:http://localhost:8099 &)
curl -X POST -H "x-import-key: localkey" "localhost:8790/run?wait=1"
npm run build && npx wrangler dev --port 8788 --persist-to .wrangler/state
```
