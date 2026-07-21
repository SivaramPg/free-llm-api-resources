import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://freellm.sivaram.dev',
  integrations: [sitemap()],
});
