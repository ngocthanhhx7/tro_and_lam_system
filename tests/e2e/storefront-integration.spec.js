import { test, expect } from './browser-fixtures.js';
import { FIXTURE_PASSWORD, USERS } from './fixtures.js';

test('merged news navigation preserves the approved header and hover dropdowns', async ({ page }) => {
  await page.goto('/dang-nhap');
  await page.getByLabel('Email', { exact: true }).fill(USERS.customer.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(FIXTURE_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/$/u);
  await page.goto('/tin-tuc');
  await expect(page.locator('.catalog-header')).toHaveCSS('background-color', 'rgb(9, 36, 45)');
  await expect(page.locator('.brand-ribbon__phrase').first()).toContainText('ĐẤT VIỆT TRONG TỪNG NÉT GỐM');
  const products = page.locator('.nav-products');
  await products.hover();
  await expect(products.locator('details')).toHaveJSProperty('open', true);
  await expect(products.getByRole('link', { name: 'Dòng gốm đời sống', exact: true })).toBeVisible();
  const account = page.locator('.header-account-menu');
  await account.hover();
  await expect(account).toHaveJSProperty('open', true);
  for (const name of ['Thông báo', 'Hồ sơ', 'Đơn hàng']) {
    await expect(account.getByRole('link', { name, exact: name !== 'Thông báo' })).toBeVisible();
  }
  await expect(account.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
  const cart = page.locator('.header-cart-menu');
  await cart.hover();
  await expect(cart).toHaveJSProperty('open', true);
  await expect(cart.getByRole('link', { name: 'Xem giỏ hàng', exact: true })).toBeVisible();
});

test('news search, article pages and the new NFC stories remain reachable after merge', async ({ page }) => {
  await page.goto('/tin-tuc');
  await page.getByLabel('Tìm bài viết', { exact: true }).fill('a80');
  await expect(page).toHaveURL(/q=a80/u);
  const article = page.locator('#news-results a').filter({ hasText: /A80/u }).first();
  await article.click();
  await expect(page).toHaveURL(/\/tin-tuc\/gom-chu-dau-tai-trien-lam-a80$/u);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A80');
  await expect(page.locator('.catalog-header')).toBeVisible();
  for (const id of ['binh_giot_ngoc', 'binh_thien_nga', 'binh_hoa_lam_ty_ba', 'binh_phu_quy', 'binh_truong_phuc']) {
    await page.goto(`/nfc/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
});
