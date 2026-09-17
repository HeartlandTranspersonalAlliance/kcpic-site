import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  site:
    process.env.SITE_URL || 'https://heartlandtranspersonalalliance.github.io',
  base: process.env.BASE_PATH || '/kcpic-site',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
});
