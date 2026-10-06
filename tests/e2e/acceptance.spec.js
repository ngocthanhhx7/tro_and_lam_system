import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { Inventory } from '../../backend/src/models/commerce/inventory.model.js';
import { InventoryMovement } from '../../backend/src/models/commerce/inventory-movement.model.js';
import { StockReservation } from '../../backend/src/models/commerce/stock-reservation.model.js';
import { AuditLog } from '../../backend/src/models/operations/audit-log.model.js';
import { OutboxEvent } from '../../backend/src/models/operations/outbox-event.model.js';
import {
  DRAFT_PRODUCT,
  FIXTURE_PASSWORD,
  PUBLISHED_PRODUCT,
  STAFF_ORDER_CODE,
  USERS,
  assertDedicatedLocalMongoUri,
} from './fixtures.js';

async function browserApi(page, path, init = {}) {
  return page.evaluate(async ({ apiPath, requestInit }) => {
    const method = String(requestInit.method || 'GET').toUpperCase();
    const headers = new Headers(requestInit.headers || {});
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (mutating && !headers.has('X-CSRF-Token')) {
      const csrfResponse = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
      const csrfBody = await csrfResponse.json();
      headers.set('X-CSRF-Token', csrfBody.data.csrfToken);
    }
    const response = await fetch(apiPath, { credentials: 'include', ...requestInit, headers });
    return { status: response.status, body: await response.json() };
  }, { apiPath: path, requestInit: init });
}

async function login(page, user) {
  await page.goto('/dang-nhap');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(FIXTURE_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const destination = user.role === 'customer' ? 'Hồ sơ của tôi' : 'Bảng công việc';
  await expect(page.getByRole('heading', { name: destination, exact: true })).toBeVisible();
}

async function inspectP11Database(read) {
  const { uri, databaseName } = assertDedicatedLocalMongoUri(process.env.P11_E2E_MONGODB_URI);
  const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
  try {
    if (connection.name !== databaseName) throw new Error('P11 read audit connected to an unexpected test database.');
    return await read({
      Inventory: connection.model('P11InventoryRead', Inventory.schema),
      InventoryMovement: connection.model('P11InventoryMovementRead', InventoryMovement.schema),
      StockReservation: connection.model('P11StockReservationRead', StockReservation.schema),
      AuditLog: connection.model('P11AuditLogRead', AuditLog.schema),
      OutboxEvent: connection.model('P11OutboxEventRead', OutboxEvent.schema),
    });
  } finally {
    await connection.close();
  }
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

test('public catalog filters are reflected in the URL and pagination restores after reload', async ({ page }) => {
  await page.goto('/san-pham');
  const filters = page.locator('.catalog-filters');
  await page.getByLabel('Tìm theo tên hoặc nội dung').fill('P11');
  await filters.getByLabel('Dòng sản phẩm').selectOption('lifestyle');
  await filters.getByLabel('Hình thức bán').selectOption('buy');
  await filters.getByLabel('Tình trạng đặt mua').selectOption('true');
  await page.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();

  const filteredUrl = new URL(page.url());
  expect(Object.fromEntries(filteredUrl.searchParams)).toMatchObject({
    q: 'P11', line: 'lifestyle', saleMode: 'buy', available: 'true',
  });
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.getByRole('link', { name: PUBLISHED_PRODUCT.name, exact: true })).toBeVisible();
  await expect(page.getByLabel('Tìm theo tên hoặc nội dung')).toHaveValue('P11');

  await page.reload();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(filters.getByLabel('Dòng sản phẩm')).toHaveValue('lifestyle');
  await expect(filters.getByLabel('Hình thức bán')).toHaveValue('buy');
  await expect(filters.getByLabel('Tình trạng đặt mua')).toHaveValue('true');

  await page.getByRole('button', { name: 'Xóa lọc', exact: true }).click();
  await expect(page).toHaveURL(/\/san-pham$/u);
  await expect(page.getByText('13 sản phẩm', { exact: true })).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(12);
  const pagination = page.getByRole('navigation', { name: 'Phân trang danh mục' });
  await expect(pagination.getByText('Trang 1 / 2', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(page).toHaveURL(/\/san-pham\?page=2$/u);
  await expect(pagination.getByText('Trang 2 / 2', { exact: true })).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.reload();
  await expect(page).toHaveURL(/\/san-pham\?page=2$/u);
  await expect(pagination.getByText('Trang 2 / 2', { exact: true })).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(1);

  await page.getByRole('button', { name: 'Trang trước', exact: true }).click();
  await expect(page).toHaveURL(/\/san-pham\?page=1$/u);
  await expect(page.locator('.product-card')).toHaveCount(12);
});

test('guest cart updates, survives reload, removes items, stays isolated and merges into one customer cart', async ({ page, browser }) => {
  await page.goto(`/san-pham/${PUBLISHED_PRODUCT.slug}`);
  await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã cập nhật giỏ hàng');
  await page.goto('/gio-hang');

  const cartItems = page.locator('.cart-item');
  await expect(cartItems).toHaveCount(1);
  await expect(cartItems.first().locator('.cart-quantity span')).toHaveText('1');
  await page.reload();
  await expect(cartItems).toHaveCount(1);
  await expect(cartItems.first().locator('.cart-quantity span')).toHaveText('1');

  await cartItems.first().locator('.cart-quantity button').last().click();
  await expect(cartItems.first().locator('.cart-quantity span')).toHaveText('2');
  const guestACartAfterUpdate = await browserApi(page, '/api/v1/cart');
  expect(guestACartAfterUpdate.status).toBe(200);
  expect(guestACartAfterUpdate.body.data.items).toHaveLength(1);
  expect(guestACartAfterUpdate.body.data.items[0].quantity).toBe(2);

  const guestBContext = await browser.newContext();
  try {
    const guestBPage = await guestBContext.newPage();
    await guestBPage.goto('/gio-hang');
    await expect(guestBPage.locator('.cart-empty')).toBeVisible();
    const emptyGuestBCart = await browserApi(guestBPage, '/api/v1/cart');
    expect(emptyGuestBCart.status).toBe(200);
    expect(emptyGuestBCart.body.data.items).toHaveLength(0);

    await guestBPage.goto(`/san-pham/${PUBLISHED_PRODUCT.slug}`);
    await guestBPage.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click();
    await expect(guestBPage.getByRole('status')).toContainText('Đã cập nhật giỏ hàng');
    const guestBCart = await browserApi(guestBPage, '/api/v1/cart');
    expect(guestBCart.status).toBe(200);
    expect(guestBCart.body.data.items).toHaveLength(1);
    expect(guestBCart.body.data.items[0].quantity).toBe(1);

    await page.reload();
    await expect(cartItems.first().locator('.cart-quantity span')).toHaveText('2');
    await cartItems.first().locator('.cart-remove').click();
    await expect(page.locator('.cart-empty')).toBeVisible();
    expect((await browserApi(page, '/api/v1/cart')).body.data.items).toHaveLength(0);
    expect((await browserApi(guestBPage, '/api/v1/cart')).body.data.items[0].quantity).toBe(1);

    await page.goto(`/san-pham/${PUBLISHED_PRODUCT.slug}`);
    await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Đã cập nhật giỏ hàng');
    await login(page, USERS.customer);
    await page.goto('/gio-hang');
    await expect(page.locator('.cart-item')).toHaveCount(1);
    await expect(page.locator('.cart-item .cart-quantity span')).toHaveText('1');
    const customerCartAfterMerge = await browserApi(page, '/api/v1/cart');
    expect(customerCartAfterMerge.status).toBe(200);
    expect(customerCartAfterMerge.body.data.items).toHaveLength(1);
    expect(customerCartAfterMerge.body.data.items[0].quantity).toBe(1);
    await page.reload();
    await expect(page.locator('.cart-item .cart-quantity span')).toHaveText('1');
    expect((await browserApi(guestBPage, '/api/v1/cart')).body.data.items[0].quantity).toBe(1);
  } finally {
    await guestBContext.close();
  }
});

test('customer manages addresses with manual fallback and is denied staff/admin APIs', async ({ page }) => {
  await login(page, USERS.customer);
  await expect(page.getByRole('heading', { name: 'Hồ sơ của tôi', exact: true })).toBeVisible();

  const ownIdentity = await browserApi(page, '/api/v1/auth/me');
  expect(ownIdentity.status).toBe(200);
  expect(ownIdentity.body.data.role).toBe('customer');

  const staffDashboard = await browserApi(page, '/api/v1/staff/dashboard');
  expect(staffDashboard.status).toBe(403);
  const adminUsers = await browserApi(page, '/api/v1/admin/users');
  expect(adminUsers.status).toBe(403);
  await addressBookFlow(page);
});

async function addressBookFlow(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(_success, error) {
          queueMicrotask(() => error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }));
        },
      },
    });
  });
  let reverseGeocodeRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/locations/reverse')) reverseGeocodeRequests += 1;
  });
  await page.goto('/tai-khoan/dia-chi');
  await expect(page.getByRole('heading', { name: 'Địa chỉ nhận hàng', exact: true })).toBeVisible();
  await expect(page.getByText('Chưa có địa chỉ nào')).toBeVisible();
  await page.getByRole('button', { name: 'Dùng vị trí hiện tại', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Bạn đã từ chối quyền vị trí' })).toBeVisible();
  expect(reverseGeocodeRequests).toBe(0);

  await page.getByLabel('Tên gợi nhớ', { exact: true }).fill('Nhà riêng');
  await page.getByLabel('Người nhận *', { exact: true }).fill('Khách kiểm thử');
  await page.getByLabel('Số điện thoại *', { exact: true }).fill('0900000015');
  await page.getByLabel('Số nhà, đường *', { exact: true }).fill('15 Đường Thủ công');
  await page.getByLabel('Địa chỉ đầy đủ để giao hàng *', { exact: true }).fill('15 Đường Thủ công, Hải Dương');
  await page.getByRole('button', { name: 'Lưu địa chỉ', exact: true }).click();
  const addressCards = page.locator('.address-saved');
  await expect(addressCards).toHaveCount(1);
  await expect(addressCards.first().getByText('Mặc định', { exact: true })).toBeVisible();

  await addressCards.first().getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.getByLabel('Số điện thoại *', { exact: true }).fill('0900000016');
  await page.getByRole('button', { name: 'Lưu địa chỉ', exact: true }).click();
  await expect(addressCards.first()).toContainText('0900000016');

  await page.getByLabel('Tên gợi nhớ', { exact: true }).fill('Nhà phụ');
  await page.getByLabel('Người nhận *', { exact: true }).fill('Người nhận phụ');
  await page.getByLabel('Số điện thoại *', { exact: true }).fill('0900000017');
  await page.getByLabel('Số nhà, đường *', { exact: true }).fill('17 Đường Thử nghiệm');
  await page.getByLabel('Địa chỉ đầy đủ để giao hàng *', { exact: true }).fill('17 Đường Thử nghiệm, Việt Nam');
  await page.getByLabel('Đặt làm địa chỉ mặc định', { exact: true }).check();
  await page.getByRole('button', { name: 'Lưu địa chỉ', exact: true }).click();
  await expect(addressCards).toHaveCount(2);
  const secondaryCard = addressCards.filter({ has: page.getByRole('heading', { name: 'Nhà phụ', exact: true }) });
  await expect(secondaryCard.getByText('Mặc định', { exact: true })).toBeVisible();
  await expect(addressCards.getByText('Mặc định', { exact: true })).toHaveCount(1);

  const otherOwnerAttempt = await browserApi(page, `/api/v1/account/addresses/${process.env.P11_E2E_OTHER_ADDRESS_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ line1: 'Địa chỉ bị sửa trái phép', expectedVersion: 0 }),
  });
  expect(otherOwnerAttempt.status).toBe(404);
  expect(JSON.stringify(otherOwnerAttempt.body)).not.toContain('Other P11 Recipient');

  await secondaryCard.getByRole('button', { name: 'Xóa', exact: true }).click();
  await secondaryCard.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
  await expect(addressCards).toHaveCount(1);
  await expect(addressCards.first().getByText('Mặc định', { exact: true })).toBeVisible();

  await addressCards.first().getByRole('button', { name: 'Xóa', exact: true }).click();
  await addressCards.first().getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
  await expect(page.getByText('Chưa có địa chỉ nào')).toBeVisible();
  expect((await browserApi(page, '/api/v1/account/addresses')).body.data).toHaveLength(0);
}

test('staff manages dashboard and fulfillment while remaining denied admin APIs', async ({ page }) => {
  await login(page, USERS.staff);
  await expect(page.locator('.catalog-header')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Bảng công việc', exact: true })).toBeVisible();
  await expect(page.getByText('Chưa cấu hình ngưỡng tồn kho; chưa thể đếm sản phẩm sắp hết hàng.')).toBeVisible();

  const dashboard = await browserApi(page, '/api/v1/staff/dashboard');
  expect(dashboard.status).toBe(200);
  expect(dashboard.body.data.ticketQueues).toBeTruthy();
  const adminStatistics = await browserApi(page, '/api/v1/admin/statistics?from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-31T23%3A59%3A59.999Z');
  expect(adminStatistics.status).toBe(403);
  const catalogAdmin = await browserApi(page, '/api/v1/admin/products');
  expect(catalogAdmin.status).toBe(403);
  await staffShipmentFlow(page);
});

async function staffShipmentFlow(page) {
  await page.goto('/staff/orders');
  await expect(page.getByRole('heading', { name: 'Đơn hàng', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Hàng đợi' }).selectOption('');

  await page.getByRole('button', { name: new RegExp(STAFF_ORDER_CODE, 'u') }).click();
  await expect(page.getByRole('heading', { name: 'Đang chuẩn bị', exact: true })).toBeVisible();
  await page.getByLabel('Đơn vị vận chuyển', { exact: true }).fill('P11 Carrier Fixture');
  await page.getByLabel('Mã vận đơn', { exact: true }).fill('P11-TRACK-001');
  await page.getByRole('button', { name: 'Lưu trạng thái', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đang giao', exact: true })).toBeVisible();

  const operationalOrder = await browserApi(page, `/api/v1/staff/orders/${process.env.P11_E2E_FIXTURE_STAFF_ORDER_ID}`);
  expect(operationalOrder.status).toBe(200);
  expect(operationalOrder.body.data.status).toBe('shipped');
  expect(operationalOrder.body.data.shipping).toMatchObject({ carrier: 'P11 Carrier Fixture', trackingNumber: 'P11-TRACK-001' });

  const orderId = process.env.P11_E2E_FIXTURE_STAFF_ORDER_ID;
  const persisted = await inspectP11Database(async (models) => {
    const orderObjectId = new mongoose.Types.ObjectId(orderId);
    const productObjectId = new mongoose.Types.ObjectId(process.env.P11_E2E_FIXTURE_PRODUCT_ID);
    const inventory = await models.Inventory.findOne({ productId: productObjectId }).lean().exec();
    const reservation = await models.StockReservation.findOne({ orderId: orderObjectId }).lean().exec();
    const movement = await models.InventoryMovement.findOne({ orderId: orderObjectId, kind: 'ship' }).lean().exec();
    const outbox = await models.OutboxEvent.findOne({ aggregateId: orderId, type: 'order.status_changed' }).lean().exec();
    const auditRecord = await models.AuditLog.findOne({ targetId: orderId, action: 'order.transition' }).lean().exec();
    return { inventory, reservation, movement, outbox, auditRecord };
  });
  expect(persisted.inventory).toMatchObject({ onHand: 4, reserved: 2 });
  expect(persisted.reservation.status).toBe('committed');
  expect(persisted.movement).toMatchObject({ kind: 'ship', onHandDelta: -1, reservedDelta: -1 });
  expect(persisted.outbox).toMatchObject({ type: 'order.status_changed', aggregateId: orderId });
  expect(persisted.auditRecord).toMatchObject({ action: 'order.transition', outcome: 'success', actorRole: 'staff' });
  expect(persisted.auditRecord.changesRedacted).toMatchObject({ fromStatus: 'processing', toStatus: 'shipped' });
  expect(persisted.auditRecord.requestId).toMatch(/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/iu);
}

test('guest cannot read private order data without order proof', async ({ page }) => {
  const privateOrderResponse = page.waitForResponse((response) => response.url().includes(`/api/v1/orders/${process.env.P11_E2E_FIXTURE_GUEST_ORDER_ID}`));
  await page.goto(`/don-hang/${process.env.P11_E2E_FIXTURE_GUEST_ORDER_ID}`);
  const privateOrder = await privateOrderResponse;
  expect(privateOrder.status()).toBe(404);
  expect(JSON.stringify(await privateOrder.json())).not.toContain('guest.private.p11@example.test');
  await expect(page.getByRole('heading', { name: 'Không thể mở đơn hàng', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tra cứu đơn bằng email', exact: true })).toBeVisible();
  const renderedText = await page.locator('body').innerText();
  expect(renderedText).not.toContain('P11 Guest Private Name');
  expect(renderedText).not.toContain('guest.private.p11@example.test');
  expect(renderedText).not.toContain('0900000014');
  expect(renderedText).not.toContain('14 Đường Riêng tư');
});

test('PayOS return query flags never mark the order paid without server confirmation', async ({ page }) => {
  await login(page, USERS.customer);
  const orderId = process.env.P11_E2E_FIXTURE_PAYMENT_ORDER_ID;
  const paymentStatusResponse = page.waitForResponse((response) => response.url().includes(`/api/v1/orders/${orderId}/payment`));
  await page.goto(`/payment/return?orderId=${orderId}&status=PAID&amount=1&code=00&signature=forged`);
  await expect(page.getByRole('heading', { name: 'Đang đối soát với PayOS', exact: true })).toBeVisible();
  const statusResponse = await paymentStatusResponse;
  expect(statusResponse.status()).toBe(200);
  expect((await statusResponse.json()).data.paymentStatus).toBe('pending');
  await expect(page.getByRole('heading', { name: 'Đã xác nhận thanh toán', exact: true })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('PayOS đang hoàn tất thông báo');
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
  await expect(page.locator('.catalog-header')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tổng quan', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Đối soát trong kỳ', exact: true })).toBeVisible();
  const catalogAdmin = await browserApi(page, '/api/v1/admin/products');
  expect(catalogAdmin.status).toBe(200);
});
