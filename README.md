# Kansas City Psychedelic Integration Circle

Astro + Tailwind static site. Content migrated from kc-psychedelic.com; see [migration notes](docs/content-migration.md).

## Develop

Use Node 24, then `npm ci`, `npm run dev`. Open http://localhost:4321/kcpic-site/.

`npm run check` validates Astro and TypeScript. `npm run build` builds to dist; `npm test` validates generated routes, internal assets/links, canonical metadata, and source content. `npm run preview -- --host 127.0.0.1` serves the production build.

## Edit

- Original prose and resource links: src/data/content.ts
- Contact details, navigation and base-aware links: src/data/site.ts
- Page composition: src/pages; design tokens and styles: src/styles/global.css
- Original images: src/assets, optimized at build time. Fonts are self-hosted through Fontsource.
- Meetings intentionally link to Facebook for the current schedule.

## Deploy

The jj repository is colocated with Git. Open a PR into `main`; the **Website release gate** validates site-affecting changes before merging. Production pushes deploy only the tested artifact after that gate passes. Known documentation-only changes skip website work unless an earlier site change is still awaiting deployment.

See [CI and release guide](docs/ci.md) for local commands, change-detection rules, required GitHub protection settings, verification, and rollback. Run `npm run validate` before a PR (install Playwright Chromium first as documented).

Current URL: https://heartlandtranspersonalalliance.github.io/kcpic-site/

## Future kcpic.org migration (not enabled)

1. Set SITE_URL=https://kcpic.org and BASE_PATH=/ for the deployment build (or change their defaults in astro.config.mjs).
2. Run `SITE_URL=https://kcpic.org BASE_PATH=/ npm run build` and `SITE_URL=https://kcpic.org BASE_PATH=/ npm test`.
3. Configure the custom domain in GitHub Pages and its GitHub-prescribed DNS records in Cloudflare; complete domain verification and HTTPS provisioning. Add public/CNAME containing kcpic.org at that time.
4. Deploy and verify canonical URLs, sitemap, assets, and direct navigation. The source site's redirects require separate configuration at the old hosting provider.

Do not add CNAME or change DNS before the actual migration. No forms, analytics, CMS, or runtime backend are required.
