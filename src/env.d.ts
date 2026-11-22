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
  /** HighLevel payment links (public URLs). A plan's Buy button appears once its link is set. */
  GHL_LINK_FEATURED?: string;
  GHL_LINK_SPOTLIGHT?: string;
  GHL_LINK_AD?: string;
  PAYMENTS_LIVE?: string;
}
declare namespace App {
  interface Locals extends Runtime {}
}
