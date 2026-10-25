import { expect, test, type Page } from '@playwright/test';

const locations = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]!).href);
function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', e => problems.push(e.message));
  page.on('requestfailed', r => problems.push(`${r.failure()?.errorText} ${r.url()}`));
  page.on('response', r => {
    if (r.status() >= 400 && !(r.status() === 404 && r.request().isNavigationRequest() && new URL(r.url()).pathname === '/missing-page/')) problems.push(`${r.status()} ${r.url()}`);
  });
  return problems;
}

test('all sitemap pages and the 404 render locally without leaks or resource errors', async ({ page, request, baseURL }) => {
  test.setTimeout(120_000);
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  const routes = new Set(locations(await sitemap.text()));
  expect(routes.has(new URL('/', baseURL).href)).toBe(true);
  expect(routes.has(new URL('/en/', baseURL).href)).toBe(true);
  // A wrong production origin must fail here, never silently test an old online deployment.
  for (const route of routes) expect(new URL(route).origin).toBe(new URL(baseURL!).origin);
  routes.add(new URL('/missing-page/', baseURL).href);
  const problems = watch(page);
  for (const route of routes) {
    const response = await page.goto(route, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(route.endsWith('/missing-page/') ? 404 : 200);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('[data-visibility="pending"], [data-visibility="private"], [data-preview-bar]')).toHaveCount(0);
    expect(problems).toEqual([]);
  }
});

test('the blog stays inside its initial asset budgets and CJK font covers its heading', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const kb = await page.evaluate(() => {
    const sum = { font: 0, image: 0, css: 0, js: 0 };
    for (const entry of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
      const ext = new URL(entry.name).pathname.split('.').pop();
      if (ext === 'woff2') sum.font += entry.encodedBodySize;
      else if (['avif', 'webp', 'jpg', 'png'].includes(ext ?? '')) sum.image += entry.encodedBodySize;
      else if (ext === 'css') sum.css += entry.decodedBodySize;
      else if (ext === 'js') sum.js += entry.decodedBodySize;
    }
    return Object.fromEntries(Object.entries(sum).map(([key, bytes]) => [key, Math.round(bytes / 1024)]));
  });
  await testInfo.attach('first-load-kb', { body: JSON.stringify(kb), contentType: 'application/json' });
  expect(kb.font).toBeLessThanOrEqual(400);
  expect(kb.css).toBeLessThanOrEqual(80);
  expect(kb.js).toBeLessThanOrEqual(60);
  expect(await page.evaluate(() => document.fonts.check('600 64px "Noto Serif SC Variable"', '博客'))).toBe(true);
  const unloaded = await page.evaluate(() => [...document.fonts].filter(f => f.family.includes('Noto Serif SC')).map(f => f.status));
  expect(unloaded).toEqual(['loaded']);
});

test('OS theme follows changes until an explicit choice persists across blog navigation', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  await page.locator('[data-theme-toggle]:visible').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
  await page.goto('/category/research/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
});

test('blog brand, language switch and mobile navigation stay in the independent site', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.locator('header .brand')).toHaveAttribute('href', '/');
  await page.locator('header .lang').click();
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.locator('header .brand')).toHaveAttribute('href', '/en/');
  if (isMobile) await page.locator('.menu-btn').click();
  const nav = page.locator(isMobile ? '#site-menu' : 'header .nav');
  await expect(nav.locator('a[rel="external"]')).toHaveAttribute('href', 'https://arietids.net/en/');
  await nav.locator('a[href="/en/category/research/"]').click();
  await expect(page).toHaveURL(/\/en\/category\/research\/$/);
  expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
});

test('motion preference persists and pauses decorative loops', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) await page.locator('.menu-btn').click();
  await page.locator('[data-motion-toggle]:visible').first().click();
  if (isMobile) await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.goto('/category/study/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  expect(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations === Infinity).length)).toBe(0);
});
