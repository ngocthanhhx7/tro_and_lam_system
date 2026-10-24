import { expect, test } from './browser-fixtures.js';
import { readFile } from 'node:fs/promises';

const articles = JSON.parse(await readFile(new URL('../../fondend/src/pages/news/providedNewsArticles.json', import.meta.url), 'utf8'));

test('news additions preserve filtering, pagination, source links and mobile article layout', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/tin-tuc');
  await expect(page.locator('#news-results .news-card')).toHaveCount(6);
  await page.getByRole('button', { name: /Xem thêm bài viết/ }).click();
  await expect(page.locator('#news-results .news-card')).toHaveCount(12);
  await page.getByRole('searchbox', { name: 'Tìm bài viết', exact: true }).fill('Ikebana');
  await expect(page.locator('#news-results .news-card')).toHaveCount(1);
  await expect(page.locator('#news-results')).toContainText('Khi gốm Chu Đậu gặp nghệ thuật');
  await page.getByRole('button', { name: 'Xóa từ khóa tìm kiếm' }).click();
  await expect(page.locator('#news-results .news-card')).toHaveCount(12);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const article of articles) {
    await page.goto(`/tin-tuc/${article.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(article.title);
    await expect(page.locator('.news-source-note')).toContainText('Nguồn tham khảo');
    await expect(page.locator('.news-source-note a').first()).toHaveAttribute('href', article.sources[0].url);
    await page.locator('.news-article__image img').evaluate(image => image.decode());
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
    await expect(page.locator('.news-article__body > section').first()).toContainText(article.sections[0].paragraphs[0]);
  }
});

test('account keyboard focus cancels a pending mouse-leave close timer', async ({ page }) => {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { data: { id: 'menu-timer-fixture', role: 'customer', name: 'Menu fixture', email: 'menu@example.test' } } });
    return route.fulfill({ json: { data: { items: [], count: 0 }, meta: { pagination: { page: 1, total: 0, totalPages: 1 } } } });
  });
  await page.goto('/tin-tuc');
  const menu = page.locator('.header-account-menu');
  await expect(menu).toBeVisible();
  // Deliver mouse leave before focus in the same task to deterministically
  // exercise the pending 180ms hover-close timer, even on slow CI machines.
  await menu.evaluate(element => {
    element.open = false;
    element.dispatchEvent(new globalThis.PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: globalThis.document.body }));
    element.querySelector('summary').focus();
    element.querySelector('summary').click();
  });
  await expect(menu).toHaveJSProperty('open', true);
  await page.waitForTimeout(250); // Observe beyond the actual 180ms close deadline.
  await expect(menu).toHaveJSProperty('open', true);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveJSProperty('open', false);
  await expect(menu.locator('summary')).toBeFocused();
});
