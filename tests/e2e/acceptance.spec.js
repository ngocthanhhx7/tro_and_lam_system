import { expect, test } from '@playwright/test';
import { DRAFT_PRODUCT, FIXTURE_PASSWORD, PUBLISHED_PRODUCT, USERS } from './fixtures.js';

async function browserApi(page, path, init = {}) {
  return page.evaluate(async ({ apiPath, requestInit }) => {
    const response = await fetch(apiPath, { credentials: 'include', ...requestInit });
    return { status: response.status, body: await response.json() };
  }, { apiPath: path, requestInit: init });
}

async function login(page, user) {
  await page.goto('/dang-nhap');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(FIXTURE_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

test('public catalog hides drafts and guest cart reaches the truthful R06-unconfigured checkout state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/san-pham');
  await expect(page.getByRole('heading', { name: 'Sản phẩm', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: PUBLISHED_PRODUCT.name, exact: true })).toBeVisible();

  const publicList = await browserApi(page, '/api/v1/products?limit=12&sort=newest');
  expect(publicList.status).toBe(200);
  expect(publicList.body.data.some((product) => product.slug === DRAFT_PRODUCT.slug)).toBe(false);

  const draftLookup = await browserApi(page, '/api/v1/products/' + DRAFT_PRODUCT.slug);
  expect(draftLookup.status).toBe(404);
  expect(JSON.stringify(draftLookup.body)).not.toContain(DRAFT_PRODUCT.name);

  await page.getByRole('link', { name: PUBLISHED_PRODUCT.name, exact: true }).click();
  await expect(page.getByRole('heading', { name: PUBLISHED_PRODUCT.name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click();
  await expect(page.getByText('Đã cập nhật giỏ hàng từ danh mục hiện tại.')).toBeVisible();
  await page.getByRole('link', { name: 'Xem giỏ hàng', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Giỏ hàng', exact: true })).toBeVisible();
  await expect(page.getByText(PUBLISHED_PRODUCT.name, { exact: true })).toBeVisible();

  const cart = await browserApi(page, '/api/v1/cart');
  expect(cart.status).toBe(200);
  expect(cart.body.data.items).toHaveLength(1);
  expect(String(cart.body.data.items[0].productId)).toBe(process.env.P11_E2E_FIXTURE_PRODUCT_ID);

  await page.getByRole('link', { name: 'Tiếp tục thanh toán', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thông tin nhận hàng', exact: true })).toBeVisible();
  await page.getByLabel('Người nhận', { exact: true }).fill('P11 Checkout Fixture');
  await page.getByLabel('Email nhận xác nhận', { exact: true }).fill('checkout.p11@example.test');
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0900000011');
  await page.getByLabel('Địa chỉ', { exact: true }).fill('123 Đường Thử nghiệm');
  await page.getByLabel('Địa chỉ đầy đủ', { exact: true }).fill('123 Đường Thử nghiệm, Việt Nam');
  const quoteResponse = page.waitForResponse((response) => response.url().includes('/api/v1/checkout/quote'));
  await page.getByRole('button', { name: 'Tính phí và kiểm tra tồn', exact: true }).click();
  const quote = await quoteResponse;
  const quoteBody = await quote.json();
  expect(quote.status(), JSON.stringify(quoteBody)).toBe(503);
  expect(quoteBody.error.code).toBe('DATABASE_UNAVAILABLE');
  await expect(page.getByRole('alert')).toContainText('Chưa cấu hình vùng giao hàng, phí và giới hạn checkout');
  await expect(page.getByRole('button', { name: 'Xác nhận đặt hàng', exact: true })).toBeDisabled();

  const layout = await page.evaluate(() => ({
    viewportWidth: globalThis.innerWidth,
    documentWidth: globalThis.document.documentElement.scrollWidth,
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
});

test('customer session reads itself and is denied staff/admin APIs', async ({ page }) => {
  await login(page, USERS.customer);
  await expect(page.getByRole('heading', { name: 'Hồ sơ của tôi', exact: true })).toBeVisible();

  const ownIdentity = await browserApi(page, '/api/v1/auth/me');
  expect(ownIdentity.status).toBe(200);
  expect(ownIdentity.body.data.role).toBe('customer');

  const staffDashboard = await browserApi(page, '/api/v1/staff/dashboard');
  expect(staffDashboard.status).toBe(403);
  const adminUsers = await browserApi(page, '/api/v1/admin/users');
  expect(adminUsers.status).toBe(403);
});

test('staff session reaches operations dashboard and is denied admin APIs', async ({ page }) => {
  await login(page, USERS.staff);
  await expect(page.getByRole('heading', { name: 'Bảng công việc', exact: true })).toBeVisible();
  await expect(page.getByText('Chưa cấu hình ngưỡng tồn kho; chưa thể đếm sản phẩm sắp hết hàng.')).toBeVisible();

  const dashboard = await browserApi(page, '/api/v1/staff/dashboard');
  expect(dashboard.status).toBe(200);
  expect(dashboard.body.data.ticketQueues).toBeTruthy();
  const adminStatistics = await browserApi(page, '/api/v1/admin/statistics?from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-31T23%3A59%3A59.999Z');
  expect(adminStatistics.status).toBe(403);
  const catalogAdmin = await browserApi(page, '/api/v1/admin/products');
  expect(catalogAdmin.status).toBe(403);
});

test('admin session can read admin statistics and catalog while anonymous callers remain denied', async ({ page }) => {
  await page.goto('/');
  const anonymous = await browserApi(page, '/api/v1/staff/dashboard');
  expect(anonymous.status).toBe(401);

  await login(page, USERS.admin);
  await expect(page.getByRole('heading', { name: 'Bảng công việc', exact: true })).toBeVisible();
  const ownIdentity = await browserApi(page, '/api/v1/auth/me');
  expect(ownIdentity.status).toBe(200);
  expect(ownIdentity.body.data.role).toBe('admin');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Tổng quan', exact: true })).toBeVisible();

  const adminStatistics = await browserApi(page, '/api/v1/admin/statistics?from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-31T23%3A59%3A59.999Z');
  expect(adminStatistics.status).toBe(200);
  const catalogAdmin = await browserApi(page, '/api/v1/admin/products');
  expect(catalogAdmin.status).toBe(200);
});
