import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://directory.browardspotlight.com',
  output: 'server',
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  security: { checkOrigin: true },
});
