# Website validation and release

## Local workflow

Use Node 24 (`.nvmrc`) and npm with the committed `package-lock.json`:

```sh
npm ci
npx --no-install playwright install chromium
npm run validate
```

On Linux, browser installation may need `npx --no-install playwright install --with-deps chromium`.
`npm run format` fixes formatting. `npm run format:check`, `npm run lint`,
`npm run check`, and `npm run test:ci` can run before a build. `npm test` validates
`dist`, so run `npm run build` first. `npm run test:browser` starts and stops a
separate Astro production preview on port 4325; it never reuses a development
server. Astro 7's `--ignore-lock` allows a developer's separate preview to remain
running. Tests use the current GitHub Pages base `/kcpic-site/`; update the test
configuration and assertions during a custom-domain migration.

The initial formatting baseline reformats existing files without intentionally
changing content or styling. ESLint covers JavaScript, TypeScript and Astro;
Astro checks types. Existing generated-output tests remain in place.

## One workflow, one required gate

`.github/workflows/deploy.yml` replaces the old deployment workflow. It runs on
all PRs targeting `main`, all pushes to `main`, and merge-queue check requests.
There are no workflow-level path filters and no manual production-deploy shortcut.
Require the stable job **Website release gate**, not the conditionally skipped
**Validate website** job.

1. **Detect website changes** checks the release-policy tests without installing
   site dependencies, then reports an explicit `site_changed=true` or `false`.
2. **Validate website** installs via `npm ci` with npm download caching; checks
   formatting, lint, Astro/TypeScript, policy tests, production build and generated
   output; then tests the build using Playwright Chromium and axe. No test retries
   hide deterministic failures. Reports include accessibility results, and failures
   retain screenshots and traces for seven days.
3. **Website release gate** always evaluates dependency results. Documentation-only
   detection plus an intentionally skipped validation passes. A site change needs
   successful validation. Missing/malformed output, detection failure, cancellation,
   test failure or an unexpected skip fails the gate.
4. **Deploy validated website** runs only for a `main` push with a successful gate
   and explicit site change. It deploys the Pages artifact from that same workflow
   run, without rebuilding. PRs and merge-queue runs never publish a Pages artifact
   or access production permissions. No preview deployments are configured.

Only deployment receives `pages: write` and OIDC permission. Detection additionally
has read-only deployment-history access. Checkouts do not persist credentials;
there is no `pull_request_target`, secret-backed service, or privileged workflow
executing PR code. Actions are pinned to immutable commit SHAs (including the
nested upload action in the pinned Pages artifact action). Maintain those pins
alongside the lockfile. Browser artifacts contain only this public site's test
output; do not add real credentials or private form data to fixtures.

## What counts as documentation

Only these exact paths are excluded, because none is rendered or imported by the
site: `README.md`, `docs/content-migration.md`, `docs/validation.md`, `docs/ci.md`.
Everything else is site-affecting, including new documentation paths, all Markdown
and MDX outside that list, tests, scripts, dependencies, configs and CI files.
Do not add a blanket Markdown or docs-directory exclusion. Remove an exclusion
before importing that document into the website.

PR detection uses merge-base to PR head; merge queues use their base/head pair.
Push detection unions changes from push-before to head **and from the last
successful GitHub Pages deployment to head**. NUL-delimited Git name-status output
handles spaces, deletions and both sides of renames. Missing deployment history
or a non-ancestor deployment baseline triggers full validation. API/diff errors
fail detection and block the gate; they never become a documentation-only success.
History lookup is bounded; history older than that bound also triggers validation.

Validation concurrency cancels superseded validation jobs only. Deployment has a
separate serialized lock and is never cancelled by validation or documentation-only
runs. Inside that lock it checks that the artifact's commit is still `main` HEAD.
A superseded deployment job fails explicitly, so GitHub cannot record an
undeployed SHA as a successful deployment baseline. If a new push arrives after
this check, the older deployment finishes first and the newer one follows.
GitHub does not guarantee queue ordering; an older queued run cannot publish after
newer code because of the HEAD check. Rerun the newest `main` workflow, not an old
release. If validation is manually cancelled, rerun that latest workflow.

Example: A is deployed; B changes the site; C changes only README before B deploys.
C still detects A..C as site-affecting, validates C and deploys C. B may finish
first, be cancelled during validation, or fail the stale-release check; C contains
B's site changes in all cases. If B already deployed before C's detection, C may
skip because there is nothing left to publish.

## GitHub settings and rollout

Observed before this change: default/production branch `main`; Pages source
**GitHub Actions** (`build_type: workflow`); only the existing deployment workflow;
no repository webhooks; `github-pages` environment permits only branch `main`;
no branch protection or repository rulesets. No Cloudflare deployment is configured
in this repository; `kcpic.org` remains a future DNS/domain migration.

Configured and verified on 2026-09-17 (keep these settings when maintaining the repository):

- Settings → Branches → protection for `main`: require a pull request with **zero required approvals**; disable approval of the
  most recent push, code-owner approval, and stale-approval dismissal. The author
  or most recent pusher may merge their own PR after checks pass. Require
  conversation resolution, require **Website release gate**
  from the GitHub Actions app (app ID 15368), and require the branch to be up to date.
  Enforce for administrators, allow no PR bypass actors, and disallow force pushes
  and deletion. Do not require the conditional validation job.
- Settings → Actions → General: **Require actions to be pinned to a full-length commit SHA** is enabled. This also disallows the historical deployment workflow, whose actions used mutable version tags, from bypassing the new gate via a rerun. Do not disable this policy to rerun an old release; use the rollback PR procedure instead.
- Settings → Environments → `github-pages`: selected deployment branches only,
  `main` of type Branch; no tags. Settings → Pages → Source must remain GitHub
  Actions. Do not enable branch-based Pages builds or a second publishing workflow.
- Merge queue is not currently configured. If enabled later, retain the same
  required gate and the `merge_group` trigger; never deploy merge-group commits.
- No external automatic build/preview path was found in repository configuration
  or hooks. An account-level Cloudflare/other GitHub App integration cannot be
  ruled out from these repository APIs. In any such provider's project settings,
  disconnect this repository or disable **both** production automatic deployments
  and PR previews. Do not merely exclude `*.md`. If a provider is introduced later,
  it must consume the gated artifact or implement this exact pending-deployment
  comparison policy before enabling automatic builds.

Do not claim the new pipeline is active until this workflow is merged and a real
GitHub Actions run has passed. Branch protection controls merging; administrators
who can edit rules or workflows can still change that policy. No production push
or deployment is needed to review this implementation: use a PR.

## Verification and rollback

For each release, verify the gate and deployment belong to the same commit, inspect
its Pages deployment record, then visit the homepage, a direct nested route,
meetings CTA and contact link under `/kcpic-site/`. Look for missing fonts/images.
The deployed artifact is the exact `dist` tested in that run.

For rollback, create a PR reverting the faulty source commit(s), retain the CI
workflow and tests, and let the new rollback commit pass the same gate and deploy.
Do not rerun an old deployment or force-push `main`: stale commits are deliberately
blocked. If GitHub Pages itself is unavailable, wait for recovery, then rerun the
latest failed main workflow. Keep the last successful Pages deployment visible
until a replacement succeeds.

## Coverage and limits

Browser checks exercise every static page plus the custom 404 at mobile and
desktop widths, internal links and fragment targets, loaded images, horizontal
overflow, browser errors, first-party request failures, the meetings → agreements
→ contact journey, skip-link behavior, and keyboard opening/closing of the native
mobile menu. External destination URLs are asserted without visiting Facebook or
sending email. There are no forms or production records to create. New forms must
use intercepted/local test fixtures before being added to this suite.

Axe runs its default rules on all pages and the open menu, plus the experimental
brand-name rule on all pages. Violations fail CI; incomplete/manual-review results
are attached, not misrepresented as passes. Automated checks do not establish full
WCAG compliance, screen-reader usability, visual quality, all browser compatibility,
real-world performance, mail delivery, or third-party availability. Chromium tests
are representative, not a complete device/browser matrix. Human review remains
necessary for content, contrast flagged for manual review, and significant design
changes.

Policy tests cover documentation-only, rendered Markdown/MDX, dependency/config,
mixed changes, real Git renames/deletions and PR merge bases, pending site releases,
failed detection, failed/cancelled/skipped validation and stale-commit rejection.
Local simulation proves the decision logic, not GitHub's scheduler or Pages OIDC.

## Implementation verification (2026-09-17)

Locally verified with Node 24: reproducible `npm ci`, Prettier, ESLint, Astro
checks (zero diagnostics), four policy tests covering the case matrix above,
production build, existing output checks, and all 16 Playwright tests passed.
`actionlint` 1.7.12 passed workflow syntax, expressions and shell validation.
Local browser runs used installed Chrome 153 via `PLAYWRIGHT_EXECUTABLE_PATH`;
CI installs Playwright's pinned Chromium revision instead.

An intentionally incorrect Facebook meeting destination in built HTML made both
`npm test` and the mobile visitor-journey test fail with exit code 1. The HTML was
restored and the output/browser tests passed again. Failure screenshots and traces
were produced. The real deployment-history API correctly identified no pending
site changes at the current production SHA; an invalid-token simulation failed
detection without writing a documentation-only output.

GitHub branch protection was applied and read back: the required gate is tied to
GitHub Actions, strict/up-to-date checks and administrator enforcement are enabled,
and pull requests require no separate reviewer approval. The author or most recent
pusher may merge once the required checks pass. Pages remains Actions-based and its
environment only accepts `main`. Production remains unchanged during this task.
PR CI verifies the hosted runner path; actual deployment ordering, OIDC publishing,
and the production documentation-only/pending-release scenarios still need to be
observed after an authorized merge. Their policy decisions are locally tested.
