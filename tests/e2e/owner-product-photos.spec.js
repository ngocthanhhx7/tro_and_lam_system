import { test, expect } from '@playwright/test';
import { ownerAboutProducts } from '../../fondend/src/constants/ownerProductPhotos.js';
import { ownerProductImageManifest } from '../../fondend/src/services/catalog/ownerProductImageManifest.js';

test('owner photos replace both home slideshows and about gallery without clipping or overflow', async ({ page }) => {
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const shows = page.locator('.product-line-slideshow');
    await expect(shows).toHaveCount(2);
    await expect(shows.nth(0).locator('.product-line-slideshow__slide')).toHaveCount(4);
    await expect(shows.nth(1).locator('.product-line-slideshow__slide')).toHaveCount(6);
    for (const show of await shows.all()) {
      await show.scrollIntoViewIfNeeded();
      const image = show.locator('[aria-hidden="false"] img');
      await expect(image).toHaveAttribute('srcset', /\/assets\/responsive\/v1\//u);
      await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
      const ratio = await show.evaluate(el => el.clientWidth / el.clientHeight);
      expect(Math.abs(ratio - 1600 / 1341)).toBeLessThan(0.02);
      await expect(show.locator('button')).toHaveCount(0);
    }
    await page.goto('/ve-chung-toi');
    const gallery = page.locator('.about-product-marquee');
    await gallery.scrollIntoViewIfNeeded();
    await expect(gallery.locator('.about-product-marquee__group').first().locator('img')).toHaveCount(10);
    const first = gallery.locator('img').first();
    await expect(first).toHaveAttribute('srcset', /\/assets\/responsive\/v1\//u);
    await expect.poll(() => first.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    const size = await first.evaluate(el => ({ rendered: el.getBoundingClientRect().width, url: el.currentSrc }));
    expect(size.rendered).toBeLessThanOrEqual(317);
    expect(size.url).toMatch(/\/(?:320|640)\.webp$/u);
    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth + 1)).toBe(true);
  }
  const source = ownerAboutProducts[0].src;
  for (const variant of ownerProductImageManifest[source].variants.filter(row => row.url !== source)) {
    await page.route(`**${variant.url}`, route => route.abort());
  }
  await page.goto('/ve-chung-toi');
  const first = page.locator('.about-product-marquee img').first();
  await page.locator('.about-product-marquee').scrollIntoViewIfNeeded();
  await expect(first).toHaveAttribute('src', source);
  await expect.poll(() => first.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(first).not.toHaveAttribute('srcset');
});
