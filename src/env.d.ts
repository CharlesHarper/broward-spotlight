/// <reference types="astro/client" />
type Runtime = import('@astrojs/cloudflare').Runtime<Env>;
interface Env {
  DB: D1Database;
  SITE_URL: string;
  SITE_NAME: string;
  ADMIN_PASSWORD?: string;
  GHL_WEBHOOK_URL?: string;
  GOOGLE_MAPS_KEY?: string;
  /** Cloudflare R2 bucket for owner photos. Until it is bound, photos are kept in the database. */
  PHOTOS?: R2Bucket;
  /** Stripe secret (or restricted) key and webhook signing secret. Checkout turns on when both are set. */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}
declare namespace App {
  interface Locals extends Runtime {}
}
