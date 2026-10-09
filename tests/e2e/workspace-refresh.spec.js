import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_PASSWORD, STAFF_ORDER_CODE, USERS, WEB_ORIGIN } from './fixtures.js';

async function login(page, role) {
  await page.goto('/dang-nhap');
  await page.getByLabel('Email', { exact: true }).fill(USERS[role].email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(FIXTURE_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(`${WEB_ORIGIN}/${role}`);
}

for (const role of ['admin', 'staff']) {
  test(`${role} dashboard stays readable and contained on desktop and mobile`, async ({ page }) => {
    await login(page, role);
    await expect(page.locator('.operations-metric > strong').first()).toBeVisible();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({ viewport: globalThis.innerWidth, content: globalThis.document.documentElement.scrollWidth }));
      expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([]);
    }
  });

  test(`${role} notification badge follows read changes without exposing another account`, async ({ page }) => {
    await login(page, role);
    const navigation = page.getByRole('navigation', { name: role === 'admin' ? 'Điều hướng quản trị' : 'Điều hướng vận hành' });
    const badge = navigation.getByRole('link', { name: 'Thông báo', exact: true }).locator('b');
    await expect(badge).toHaveText('2');
    await navigation.getByRole('link', { name: 'Thông báo', exact: true }).click();
    await expect(page.getByText(`P11 ${role} Workspace Notice 1`, { exact: true })).toBeVisible();
    await expect(page.getByText('P11 Private Other Customer Notice', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).first().click();
    await expect(badge).toHaveText('1');
    await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc', exact: true }).click();
    await expect(badge).toHaveCount(0);
    await page.getByLabel('Chỉ hiện chưa đọc').check();
    await expect(page.getByText('Bạn đã đọc tất cả thông báo.', { exact: true })).toBeVisible();
    const response = await page.request.get(`${WEB_ORIGIN}/api/v1/notifications/unread-count`);
    expect((await response.json()).data.count).toBe(0);
  });

  test(`${role} searches and opens an operational order inside its own workspace`, async ({ page }) => {
    await login(page, role);
    await page.getByLabel('Tìm đơn hàng, khách hàng', { exact: true }).fill(STAFF_ORDER_CODE);
    await page.getByRole('button', { name: 'Tìm đơn hàng', exact: true }).click();
    await expect(page).toHaveURL(`${WEB_ORIGIN}/${role}/orders?q=${STAFF_ORDER_CODE}`);
    await expect(page.locator('.workspace-order-row')).toHaveCount(1);
    await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
    await expect(page.locator('.commerce-staff-detail')).toContainText(STAFF_ORDER_CODE);
    await expect(page.getByRole('button', { name: 'In phiếu đơn hàng', exact: true })).toBeVisible();
    await expect(page.locator('.catalog-header')).toHaveCount(0);
    await page.getByRole('button', { name: 'Đóng chi tiết đơn hàng', exact: true }).click();
    await expect(page.locator('.commerce-staff-detail')).toHaveCount(0);
  });

  test(`${role} blocks public pages and opens account pages within its workspace`, async ({ page }) => {
    await login(page, role);
    for (const path of ['/', '/san-pham', '/cau-chuyen', '/gio-hang', '/tai-khoan/ho-so', '/tra-cuu-don-hang']) {
      await page.goto(path);
      await expect(page).toHaveURL(`${WEB_ORIGIN}/loi/403`);
      await expect(page.getByRole('heading', { name: 'Bạn chưa được cấp quyền' })).toBeVisible();
      await expect(page.locator('.catalog-header')).toHaveCount(0);
      await page.getByRole('link', { name: 'Về không gian làm việc', exact: true }).click();
      await expect(page).toHaveURL(`${WEB_ORIGIN}/${role}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Mở menu tài khoản', exact: true }).click();
    await page.getByRole('link', { name: 'Hồ sơ', exact: true }).click();
    await expect(page).toHaveURL(`${WEB_ORIGIN}/${role}/account/profile`);
    await expect(page.getByLabel('Họ và tên', { exact: true })).toHaveValue(USERS[role].name);
    await page.getByRole('button', { name: 'Mở menu tài khoản', exact: true }).click();
    await page.getByRole('link', { name: 'Đổi mật khẩu', exact: true }).click();
    await expect(page).toHaveURL(`${WEB_ORIGIN}/${role}/account/password`);
    await expect(page.getByRole('heading', { name: 'Đổi mật khẩu', exact: true })).toBeVisible();
    await page.getByRole('navigation', { name: role === 'admin' ? 'Điều hướng quản trị' : 'Điều hướng vận hành' }).getByRole('link', { name: /^Thông báo/u }).click();
    await expect(page).toHaveURL(`${WEB_ORIGIN}/${role}/notifications`);
    await expect(page.getByRole('heading', { name: 'Thông báo', exact: true })).toBeVisible();
  });

  test(`${role} logout recovers from a stale CSRF cookie and ends the server session`, async ({ page, context }) => {
    await login(page, role);
    await context.clearCookies({ name: 'tl_csrf' });
    await page.getByRole('button', { name: 'Mở menu tài khoản', exact: true }).click();
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await expect(page).toHaveURL(`${WEB_ORIGIN}/dang-nhap`);
    await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();
    expect((await page.request.get(`${WEB_ORIGIN}/api/v1/auth/me`)).status()).toBe(401);
    await page.goto(`/${role}`);
    await expect(page).toHaveURL(`${WEB_ORIGIN}/dang-nhap`);
  });
}

test('customer can still browse the store and cannot enter workspaces', async ({ page }) => {
  await page.goto('/dang-nhap');
  await page.getByLabel('Email', { exact: true }).fill(USERS.customer.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(FIXTURE_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(`${WEB_ORIGIN}/tai-khoan`);
  await page.goto('/san-pham');
  await expect(page.locator('.catalog-header')).toBeVisible();
  await page.goto('/admin');
  await expect(page).toHaveURL(`${WEB_ORIGIN}/loi/403`);
});
