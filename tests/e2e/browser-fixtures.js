import { test as base, expect } from '@playwright/test';

const prepared = new WeakSet();
function preparePage(page) {
  if (prepared.has(page)) return page;
  prepared.add(page);
  // The storefront is inert until the branded loader finishes. A visible input
  // alone is not ready for keyboard entry, and transient loading colors must not
  // be scanned as the settled page by axe.
  for (const method of ['goto', 'reload']) {
    const navigate = page[method].bind(page);
    page[method] = async (...args) => {
      const response = await navigate(...args);
      await page.locator('#startup-loader').waitFor({ state: 'detached' });
      return response;
    };
  }
  return page;
}

export const test = base.extend({
  browser: [async ({ browser }, use) => {
    const newContext = browser.newContext;
    browser.newContext = async (...args) => {
      const context = await newContext.apply(browser, args);
      context.on('page', preparePage);
      return context;
    };
    try { await use(browser); }
    finally { browser.newContext = newContext; }
  }, { scope: 'worker' }],
  page: async ({ page }, use) => { await use(preparePage(page)); },
});
export { expect };
