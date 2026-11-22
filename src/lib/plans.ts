// Paid plans. Checkout runs on HighLevel payment links; HighLevel tells the site when someone pays or cancels.
export const PLANS = {
  featured: { label: 'Featured listing', cents: 7900, monthly: true, blurb: 'Top of your city and category pages, labeled Featured. Billed monthly, cancel any time.' },
  spotlight: { label: 'Spotlight article', cents: 24900, monthly: false, blurb: 'A researched feature story about your business, labeled Sponsored. One-time payment.' },
  ad: { label: 'Display ad', cents: 9900, monthly: true, blurb: 'A banner on the pages you pick, labeled Advertisement. Billed monthly, cancel any time.' },
} as const;
export type PlanKey = keyof typeof PLANS;
export const isPlan = (k: string): k is PlanKey => k in PLANS;
export const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** The HighLevel payment link for a plan, set in wrangler.jsonc once the links exist. */
export function payLink(e: Env, plan: PlanKey): string | null {
  const v = plan === 'featured' ? e.GHL_LINK_FEATURED : plan === 'spotlight' ? e.GHL_LINK_SPOTLIGHT : e.GHL_LINK_AD;
  return v && /^https:\/\//.test(v) ? v : null;
}
export const addDays = (from: Date, days: number) => new Date(from.getTime() + days * 864e5).toISOString().slice(0, 10);
