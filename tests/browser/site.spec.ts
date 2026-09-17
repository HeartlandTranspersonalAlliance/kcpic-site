import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const origin = 'http://127.0.0.1:4325';
const prefix = '/kcpic-site/';
const facebook = 'https://www.facebook.com/groups/kcpsychedelic';
const routes = [
  ['', /Kansas City.*Integration Circle/s],
  ['about/', /Who we are/],
  ['meetings/', /Upcoming Meetings/],
  ['community-resources/', /Community Resources/],
  ['contact/', /Contact Us/],
  ['404.html', /back to the circle/i],
] as const;

// Guard every test, including navigation and open-menu states.
const test = base.extend<{ browserHealth: void }>({
  browserHealth: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('requestfailed', (request) => {
        if (new URL(request.url()).origin === origin)
          errors.push(`Failed request: ${request.url()}`);
      });
      page.on('response', (response) => {
        if (
          new URL(response.url()).origin === origin &&
          response.status() >= 400 &&
          !response.url().endsWith('/404.html')
        )
          errors.push(`${response.status()} ${response.url()}`);
      });
      // No test sends email, visits Facebook, or calls an external service.
      await page.route('**/*', (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort(),
      );
      await use();
      expect(
        errors,
        'No browser errors or failed first-party requests',
      ).toEqual([]);
    },
    { auto: true },
  ],
});

for (const [route, heading] of routes) {
  test(`${route || 'home'}: content, layout, links and accessibility`, async ({
    page,
  }, testInfo) => {
    await page.goto(prefix + route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page.getByRole('main')).toBeVisible();
    // Load lazy images before checking assets and overflow.
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() =>
        page
          .locator('img')
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const links = await page
      .locator('a[href]')
      .evaluateAll((anchors) =>
        anchors.map((anchor) => (anchor as HTMLAnchorElement).href),
      );
    for (const href of new Set(links)) {
      const url = new URL(href);
      if (url.origin !== origin) continue;
      expect(url.pathname, 'Internal links retain the Pages base').toMatch(
        /^\/kcpic-site\//,
      );
      const response = await page.request.get(url.href);
      expect(response.ok(), `Broken internal link: ${href}`).toBe(true);
      if (url.hash) {
        // Static site: fetch target and inspect fragment via the browser's HTML parser.
        const html = await response.text();
        expect(
          await page.evaluate(
            ({ html, id }) =>
              new DOMParser()
                .parseFromString(html, 'text/html')
                .getElementById(id) !== null,
            { html, id: decodeURIComponent(url.hash.slice(1)) },
          ),
          `Missing fragment: ${href}`,
        ).toBe(true);
      }
    }
    const accessibility = await new AxeBuilder({ page })
      .withRules(['label-content-name-mismatch'])
      .analyze();
    const full = await new AxeBuilder({ page }).analyze();
    await testInfo.attach('axe-results', {
      body: JSON.stringify({ full, accessibility }),
      contentType: 'application/json',
    });
    expect([...full.violations, ...accessibility.violations]).toEqual([]);
  });
}

test('visitor finds a meeting, reads agreements, and contacts the circle', async ({
  page,
}) => {
  await page.goto(prefix);
  await page.getByRole('link', { name: 'Explore our meetings' }).click();
  await expect(page).toHaveURL(/\/meetings\/$/);
  await expect(
    page.getByRole('link', { name: 'View meetings on Facebook' }),
  ).toHaveAttribute('href', facebook);
  await page
    .getByRole('link', { name: 'Read our community agreements' })
    .click();
  await expect(page).toHaveURL(/\/about\/#community-agreements$/);
  await expect(page.locator('#community-agreements')).toBeInViewport();
  // Use the visible header navigation, including the native keyboard-operated mobile menu.
  const summary = page.locator('header summary');
  if (await summary.isVisible()) {
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('navigation', { name: 'Mobile navigation' }),
    ).toBeVisible();
    await summary.press('Enter');
    await expect(
      page.getByRole('navigation', { name: 'Mobile navigation' }),
    ).toBeHidden();
    await summary.press('Enter');
  }
  const navigation = page.getByRole('navigation', {
    name: (await summary.isVisible()) ? 'Mobile navigation' : 'Main navigation',
    exact: true,
  });
  await navigation.getByRole('link', { name: 'Contact', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Contact Us' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Email the circle/ }),
  ).toHaveAttribute('href', 'mailto:info@kcpic.org');
  await expect(
    page.getByRole('link', { name: /KCPIC on Facebook/ }).first(),
  ).toHaveAttribute('href', facebook);
  await page
    .getByRole('link', {
      name: 'Kansas City Psychedelic Integration Circle home',
    })
    .click();
  await expect(page).toHaveURL(origin + prefix);
});

test('skip link and open mobile navigation are usable', async ({
  page,
}, testInfo) => {
  await page.goto(prefix);
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  const summary = page.locator('header summary');
  if (await summary.isVisible()) {
    await summary.focus();
    await page.keyboard.press('Space');
    await expect(
      page.getByRole('navigation', { name: 'Mobile navigation' }),
    ).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(
      page
        .getByRole('navigation', { name: 'Mobile navigation' })
        .getByRole('link', { name: 'About', exact: true }),
    ).toBeFocused();
    const results = await new AxeBuilder({ page }).analyze();
    await testInfo.attach('axe-open-menu', {
      body: JSON.stringify(results),
      contentType: 'application/json',
    });
    expect(results.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
