/// <reference types="astro/client" />
type Runtime = import('@astrojs/cloudflare').Runtime<Env>;
interface Env {
  DB: D1Database;
  SITE_URL: string;
  SITE_NAME: string;
  ADMIN_PASSWORD?: string;
  GHL_WEBHOOK_URL?: string;
  GOOGLE_MAPS_KEY?: string;
}
declare namespace App {
  interface Locals extends Runtime {}
}
