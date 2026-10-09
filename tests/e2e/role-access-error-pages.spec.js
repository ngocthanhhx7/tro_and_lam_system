import { expect, test } from '@playwright/test';
import { FIXTURE_PASSWORD, USERS, WEB_ORIGIN } from './fixtures.js';

const ERROR_STATUSES = [400, 401, 403, 404, 405, 408, 409, 413, 422, 429, 500, 502, 503, 504];

async function login(page, user) {
  await page.goto('/dang-nhap');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(FIXTURE_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(`${WEB_ORIGIN}${user.role === 'customer' ? '/tai-khoan' : `/${user.role}`}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function apiStatus(page, path) {
  return page.evaluate(async (apiPath) => {
    const response = await fetch(apiPath, { credentials: 'include' });
    return response.status;
  }, path);
}

async function expectForbiddenRoute(page, path) {
  await page.goto(path);
  await expect(page).toHaveURL(`${WEB_ORIGIN}/loi/403`);
  await expect(page.getByRole('heading', { name: 'Bạn chưa được cấp quyền', exact: true })).toBeVisible();
}

test('admin navigation maps to registered routes and preserves nested screens', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, USERS.admin);

  const navigation = page.getByRole('navigation', { name: 'Điều hướng quản trị', exact: true });
  const destinations = [
    ['/admin', 'Tổng quan', 'Tổng quan'],
    ['/admin/orders', 'Đơn hàng', 'Đơn hàng'],
    ['/admin/products', 'Sản phẩm', 'Sản phẩm'],
    ['/admin/categories', 'Danh mục', 'Danh mục'],
    ['/admin/content', 'Nội dung', 'Nội dung'],
    ['/admin/nfc', 'NFC', 'NFC'],
    ['/admin/users', 'Khách hàng & tài khoản', 'Khách hàng & tài khoản'],
    ['/admin/appeals', 'Kháng nghị', 'Kháng nghị'],
    ['/admin/reviews', 'Đánh giá', 'Đánh giá'],
    ['/admin/refunds', 'Hoàn tiền', 'Hoàn tiền'],
    ['/admin/vouchers', 'Voucher', 'Voucher'],
    ['/admin/employees', 'Nhân viên', 'Nhân viên'],
    ['/admin/reports', 'Báo cáo', 'Báo cáo'],
    ['/admin/notifications', 'Thông báo', 'Thông báo'],
    ['/admin/logs', 'Nhật ký', 'Nhật ký'],
    ['/admin/settings', 'Cài đặt', 'Cài đặt'],
  ];

  for (const [path, label, activeLabel] of destinations) {
    const link = navigation.getByRole('link', { name: label, exact: true });
    await expect(link).toHaveAttribute('href', path);
    await page.goto(path);
    await expect(page).toHaveURL(`${WEB_ORIGIN}${path}`);
    await expect(navigation.getByRole('link', { name: activeLabel, exact: true })).toHaveClass(/is-active/u);
  }

  const nestedDestinations = [
    ['/admin/products/new', 'Sản phẩm'],
    ['/admin/products/64f000000000000000000001/edit', 'Sản phẩm'],
    ['/admin/users/64f000000000000000000001', 'Khách hàng & tài khoản'],
    ['/admin/appeals/64f000000000000000000001', 'Kháng nghị'],
  ];
  for (const [path, activeLabel] of nestedDestinations) {
    await page.goto(path);
    await expect(page).toHaveURL(`${WEB_ORIGIN}${path}`);
    await expect(page.getByRole('heading', { name: 'Không tìm thấy trang', exact: true })).toHaveCount(0);
    await expect(navigation.getByRole('link', { name: activeLabel, exact: true })).toHaveClass(/is-active/u);
  }

  await expect(navigation.getByRole('link')).toHaveCount(destinations.length);
  await expect(navigation.getByRole('link', { name: /Vận hành|Hỗ trợ/u })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin');
  const menuButton = page.locator('.admin-layout__menu-toggle');
  await expect(menuButton).toHaveAttribute('aria-label', 'Mở điều hướng');
  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(menuButton).toHaveAttribute('aria-label', 'Đóng điều hướng');
  await expect(navigation.getByRole('link', { name: 'Sản phẩm', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await expect(menuButton).toBeFocused();
  await menuButton.click();
  await navigation.getByRole('link', { name: 'Sản phẩm', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products$/u);
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
});

test('customer, staff and admin stay inside their own workspace routes and APIs', async ({ browser }) => {
  const contexts = await Promise.all([
    browser.newContext({ baseURL: WEB_ORIGIN }),
    browser.newContext({ baseURL: WEB_ORIGIN }),
    browser.newContext({ baseURL: WEB_ORIGIN }),
  ]);

  try {
    const [customerPage, staffPage, adminPage] = await Promise.all(contexts.map((context) => context.newPage()));

    await login(customerPage, USERS.customer);
    expect(await apiStatus(customerPage, '/api/v1/staff/dashboard')).toBe(403);
    expect(await apiStatus(customerPage, '/api/v1/admin/users')).toBe(403);
    await expectForbiddenRoute(customerPage, '/staff/orders');
    await expectForbiddenRoute(customerPage, '/admin/users');
    await expectForbiddenRoute(customerPage, '/admin/unknown-page');

    await login(staffPage, USERS.staff);
    expect(await apiStatus(staffPage, '/api/v1/staff/dashboard')).toBe(200);
    expect(await apiStatus(staffPage, '/api/v1/admin/users')).toBe(403);
    await expectForbiddenRoute(staffPage, '/admin/users');
    await expectForbiddenRoute(staffPage, '/admin/unknown-page');
    await staffPage.goto('/staff');
    await expect(staffPage.getByRole('heading', { name: 'Bảng công việc', exact: true })).toBeVisible();
    const staffNavigation = staffPage.getByRole('navigation', { name: 'Điều hướng vận hành' });
    await expect(staffNavigation.getByRole('link', { name: 'Hỗ trợ khách hàng' })).toHaveCount(1);
    await expect(staffNavigation.getByRole('link', { name: 'Đơn hàng' })).toHaveCount(1);
    await staffPage.goto('/staff/unknown-page');
    await expect(staffPage.getByRole('heading', { name: 'Không tìm thấy trang', exact: true })).toBeVisible();

    await login(adminPage, USERS.admin);
    expect(await apiStatus(adminPage, '/api/v1/staff/dashboard')).toBe(403);
    expect(await apiStatus(adminPage, '/api/v1/admin/users')).toBe(200);
    await expectForbiddenRoute(adminPage, '/staff/orders');
    await expectForbiddenRoute(adminPage, '/staff/unknown-page');
    await adminPage.goto('/admin/unknown-page');
    await expect(adminPage.getByRole('heading', { name: 'Không tìm thấy trang', exact: true })).toBeVisible();
    await expect(adminPage.locator('.admin-layout')).toHaveCount(1);
    await expect(adminPage.getByRole('group', { name: 'Phiên làm việc' })).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('HTTP error routes show the requested status, a focused heading and a recovery link', async ({ page }) => {
  for (const status of ERROR_STATUSES) {
    await page.goto(`/loi/${status}`);
    await expect(page.locator('.http-error-card__code')).toHaveText(String(status));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    const primaryLink = page.locator('.http-error-card__primary');
    await expect(primaryLink).toBeVisible();
    await expect(primaryLink).toHaveAttribute('href', status === 401 ? '/dang-nhap' : '/');
  }

  await page.goto('/404');
  await expect(page.locator('.http-error-card__code')).toHaveText('404');
  await page.goto('/a-path-that-does-not-exist');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang', exact: true })).toBeVisible();
});
