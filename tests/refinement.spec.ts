import { expect, test } from '@playwright/test';

test('day enhancements remain active on a high-density wide-gamut screen', async ({ browser, isMobile }) => {
  test.skip(isMobile, 'explicit desktop DPR and gamut context');
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'color-gamut', value: 'p3' }, { name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.goto(test.info().project.use.baseURL!);
  const values = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return ['--hairline', '--line', '--line-strong', '--accent', '--accent-fill', '--mark-core'].map(name => style.getPropertyValue(name).replace(/\s/g, ''));
  });
  expect(parseFloat(values[0]!)).toBe(0.5);
  expect(values[1]).toMatch(/\/(?:0)?\.16\)/);
  expect(values[2]).toMatch(/\/(?:0)?\.27\)/);
  expect(values[3]).toContain('.135');
  expect(values[4]).toContain('.15');
  expect(values[5]).toContain('.165');
  await context.close();
});

for (const preference of ['system', 'site'] as const) {
  test(`controls stop spatial transitions with ${preference} reduced motion`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop exposes both controls; mobile menu is tested separately');
    await page.emulateMedia({ reducedMotion: preference === 'system' ? 'reduce' : 'no-preference' });
    await page.goto('/');
    if (preference === 'site') await page.evaluate(() => {
      document.documentElement.dataset.motion = 'off';
      dispatchEvent(new Event('motionchange'));
    });
    for (const selector of ['[data-theme-toggle]:visible', '[data-motion-toggle]:visible']) {
      const button = page.locator(selector).first();
      await button.hover();
      await page.mouse.down();
      expect(await button.evaluate(el => getComputedStyle(el).scale)).toBe('none');
      // Release outside so testing the press does not turn the preference back on.
      await page.mouse.move(1, 1);
      await page.mouse.up();
      const spatial = await button.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a instanceof CSSTransition && ['scale', 'rotate', 'translate'].includes(a.transitionProperty) && a.playState === 'running').length);
      expect(spatial).toBe(0);
    }
  });
}
