import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { Inventory } from '../../backend/src/models/commerce/inventory.model.js';
import { InventoryMovement } from '../../backend/src/models/commerce/inventory-movement.model.js';
import { StockReservation } from '../../backend/src/models/commerce/stock-reservation.model.js';
import { AuditLog } from '../../backend/src/models/operations/audit-log.model.js';
import { Notification } from '../../backend/src/models/operations/notification.model.js';
import { OutboxEvent } from '../../backend/src/models/operations/outbox-event.model.js';
import { BusinessSetting } from '../../backend/src/models/operations/business-setting.model.js';
import { Order } from '../../backend/src/models/commerce/order.model.js';
import { createOutboxPayloadCipher } from '../../backend/src/services/operations/outbox-payload-cipher.js';
import { Review } from '../../backend/src/reviews/review.models.js';
import { AccountAppeal } from '../../backend/src/models/identity/account-appeal.model.js';
import { AuthChallenge } from '../../backend/src/models/identity/auth-challenge.model.js';
import { AuthSession } from '../../backend/src/models/identity/session.model.js';
import { User } from '../../backend/src/models/identity/user.model.js';
import { Ticket, TicketMessage } from '../../backend/src/support/support.models.js';
import {
  DRAFT_PRODUCT,
  FIXTURE_PASSWORD,
  GUEST_ORDER_CODE,
  GUEST_ORDER_EMAIL,
  PUBLISHED_PRODUCT,
  REVIEW_ORDER_CODE,
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
    const options = { credentials: 'include', ...requestInit, headers };
    if (requestInit.body && typeof requestInit.body === 'object') {
      options.body = JSON.stringify(requestInit.body);
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(apiPath, options);
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
      Notification: connection.model('P11NotificationRead', Notification.schema),
      Ticket: connection.model('P11TicketRead', Ticket.schema),
      TicketMessage: connection.model('P11TicketMessageRead', TicketMessage.schema),
      Review: connection.model('P11ReviewRead', Review.schema),
      OutboxEvent: connection.model('P11OutboxEventRead', OutboxEvent.schema),
      BusinessSetting: connection.model('P11BusinessSettingRead', BusinessSetting.schema),
      Order: connection.model('P11OrderRead', Order.schema),
      AccountAppeal: connection.model('P11AccountAppealRead', AccountAppeal.schema),
      AuthChallenge: connection.model('P11AuthChallengeRead', AuthChallenge.schema),
      AuthSession: connection.model('P11AuthSessionRead', AuthSession.schema),
      User: connection.model('P11UserRead', User.schema),
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
  await page.getByLabel('Tỉnh / thành phố', { exact: true }).fill('Hải Dương');
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
    const auditRecord = await models.AuditLog.findOne({
      action: 'order.transition',
      'changesRedacted.fromStatus': 'processing',
      'changesRedacted.toStatus': 'shipped',
    }).lean().exec();
    return { inventory, reservation, movement, outbox, auditRecord };
  });
  expect(persisted.inventory).toMatchObject({ onHand: 4, reserved: 2 });
  expect(persisted.reservation.status).toBe('committed');
  expect(persisted.movement).toMatchObject({ kind: 'ship', onHandDelta: -1, reservedDelta: -1 });
  expect(persisted.outbox).toMatchObject({ type: 'order.status_changed', aggregateId: orderId });
  expect(persisted.auditRecord).toMatchObject({ action: 'order.transition', outcome: 'success', actorRole: 'staff' });
  expect(persisted.auditRecord.targetId).toBe(orderId);
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

test('guest order email lookup keeps credentials generic and reveals the order only after a valid code', async ({ page }) => {
  await page.goto('/tra-cuu-don-hang');
  await page.getByLabel('Mã đơn hàng', { exact: true }).fill('TL-P11-NOT-AN-ORDER');
  await page.getByLabel('Email đặt hàng', { exact: true }).fill('missing.p11@example.test');
  const missingChallengeResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/order-access/challenges')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Gửi mã xác minh', exact: true }).click();
  const missingChallengeResponse = await missingChallengeResponsePromise;
  const missingChallengeBody = await missingChallengeResponse.json();
  expect(missingChallengeResponse.status(), JSON.stringify(missingChallengeBody)).toBe(202);
  expect(missingChallengeBody.data.accepted).toBe(true);
  expect(missingChallengeBody.data.challengeId).toEqual(expect.any(String));
  await expect(page.getByRole('status')).toContainText('Nếu mã đơn và email trùng khớp');
  await page.getByRole('button', { name: 'Dùng mã đơn hoặc email khác', exact: true }).click();

  await page.getByLabel('Mã đơn hàng', { exact: true }).fill(GUEST_ORDER_CODE);
  await page.getByLabel('Email đặt hàng', { exact: true }).fill(GUEST_ORDER_EMAIL);
  const validChallengeResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/order-access/challenges')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Gửi mã xác minh', exact: true }).click();
  const validChallengeResponse = await validChallengeResponsePromise;
  const validChallengeBody = await validChallengeResponse.json();
  expect(validChallengeResponse.status()).toBe(missingChallengeResponse.status());
  expect(Object.keys(validChallengeBody.data).sort()).toEqual(Object.keys(missingChallengeBody.data).sort());
  expect(validChallengeBody.data.accepted).toBe(true);
  await expect(page.getByRole('status')).toContainText('Nếu mã đơn và email trùng khớp');
  await expect(page.getByText('P11 Guest Private Name', { exact: true })).toHaveCount(0);
  await expect(page.getByText(GUEST_ORDER_EMAIL, { exact: true })).toHaveCount(0);
  await expect(page.getByText('14 Đường Riêng tư, Việt Nam', { exact: true })).toHaveCount(0);

  const mailDecrypt = createOutboxPayloadCipher({ key: process.env.P11_E2E_MAIL_ENCRYPTION_KEY }).decrypt;
  const mailedAccessCode = await inspectP11Database(async ({ OutboxEvent: OutboxEventRead }) => {
    const events = await OutboxEventRead.find({ type: 'operations.delivery', aggregateType: 'mail' }).lean().exec();
    const messages = events.flatMap((event) => event.payload.deliveries
      .filter((delivery) => delivery.encryptedMail)
      .map((delivery) => mailDecrypt(delivery.encryptedMail)));
    return messages.find((message) => message.template === 'order_access_code' && message.recipient === GUEST_ORDER_EMAIL)?.data.code;
  });
  expect(mailedAccessCode).toMatch(/^\d{6}$/u);

  const missingProof = await browserApi(page, '/api/v1/order-access/verify', {
    method: 'POST', body: { challengeId: 'p11-missing-order-challenge-00001', verificationCode: '000000' },
  });
  const wrongAccessCode = await browserApi(page, '/api/v1/order-access/verify', {
    method: 'POST',
    body: { challengeId: validChallengeBody.data.challengeId, verificationCode: mailedAccessCode === '000000' ? '000001' : '000000' },
  });
  const errorShape = (response) => ({
    status: response.status,
    code: response.body.error?.code,
    message: response.body.error?.message,
    details: response.body.error?.details,
  });
  expect(missingProof.status).toBe(403);
  expect(wrongAccessCode.status).toBe(403);
  expect(missingProof.body.error?.code).toBe('FORBIDDEN');
  expect(wrongAccessCode.body.error?.code).toBe('FORBIDDEN');
  expect(errorShape(wrongAccessCode)).toEqual(errorShape(missingProof));
  await expect(page.getByText('P11 Guest Private Name', { exact: true })).toHaveCount(0);

  await page.getByLabel('Mã xác minh gồm 6 chữ số', { exact: true }).fill(mailedAccessCode);
  const orderId = process.env.P11_E2E_FIXTURE_GUEST_ORDER_ID;
  const orderDetailResponsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/v1/orders/${orderId}`)
    && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Xác minh và xem đơn', exact: true }).click();
  const orderDetailResponse = await orderDetailResponsePromise;
  const orderDetailBody = await orderDetailResponse.json();
  expect(orderDetailResponse.status(), JSON.stringify(orderDetailBody)).toBe(200);
  expect(orderDetailBody.data.recipient.recipientName).toBe('P11 Guest Private Name');
  await expect(page.getByRole('heading', { name: GUEST_ORDER_CODE, exact: true })).toBeVisible();
  await expect(page.getByText('P11 Guest Private Name', { exact: true })).toBeVisible();
  await expect(page.getByText(GUEST_ORDER_EMAIL, { exact: true })).toBeVisible();
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

test('customer notifications stay owner-scoped and read changes persist without affecting another owner', async ({ page }) => {
  await login(page, USERS.customer);
  await page.goto('/tai-khoan/thong-bao');
  await expect(page.getByRole('heading', { name: 'Thông báo', exact: true })).toBeVisible();
  await expect(page.getByText('P11 Customer Order Notice One', { exact: true })).toBeVisible();
  await expect(page.getByText('P11 Customer Account Notice Two', { exact: true })).toBeVisible();
  await expect(page.getByText('P11 Private Other Customer Notice', { exact: true })).toHaveCount(0);

  const unread = await browserApi(page, '/api/v1/notifications/unread-count');
  expect(unread.status).toBe(200);
  expect(unread.body.data.count).toBe(2);
  const foreignMarkRead = await browserApi(page, `/api/v1/notifications/${process.env.P11_E2E_FIXTURE_OTHER_NOTIFICATION_ID}/read`, {
    method: 'PATCH', body: {},
  });
  expect(foreignMarkRead.status).toBe(404);
  expect(foreignMarkRead.body.error?.code).toBe('NOT_FOUND');

  const unreadRows = page.locator('.operations-notifications > li.is-unread');
  await expect(unreadRows).toHaveCount(2);
  await unreadRows.first().getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).click();
  await expect(unreadRows).toHaveCount(1);

  await page.getByLabel('Chỉ hiện chưa đọc', { exact: true }).check();
  await expect(page.locator('.operations-notifications > li')).toHaveCount(1);
  await expect(page.getByText('P11 Private Other Customer Notice', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc', exact: true }).click();
  await expect(page.getByText('Bạn đã đọc tất cả thông báo.', { exact: true })).toBeVisible();

  const unreadAfter = await browserApi(page, '/api/v1/notifications/unread-count');
  expect(unreadAfter.status).toBe(200);
  expect(unreadAfter.body.data.count).toBe(0);
  const persisted = await inspectP11Database(async ({ Notification: NotificationRead }) => {
    const ownIds = process.env.P11_E2E_FIXTURE_CUSTOMER_NOTIFICATION_IDS.split(',');
    const own = await NotificationRead.find({ _id: { $in: ownIds } }).lean().exec();
    const other = await NotificationRead.findById(process.env.P11_E2E_FIXTURE_OTHER_NOTIFICATION_ID).lean().exec();
    return { own, other };
  });
  expect(persisted.own).toHaveLength(2);
  expect(persisted.own.every((item) => item.readAt instanceof Date)).toBe(true);
  expect(persisted.other.readAt).toBeNull();
});

test('verified customer review remains private until an admin publishes it', async ({ page, browser }) => {
  const comment = 'P11 verified ceramic review acceptance';
  const reviewOrderId = process.env.P11_E2E_FIXTURE_REVIEW_ORDER_ID;
  const productId = process.env.P11_E2E_FIXTURE_PRODUCT_ID;

  await login(page, USERS.customer);
  await page.goto('/tai-khoan/danh-gia');
  await expect(page.getByRole('heading', { name: 'Đánh giá sản phẩm', exact: true })).toBeVisible();
  const eligibleReview = page.locator('.support-review-card');
  await expect(eligibleReview).toHaveCount(1);
  await expect(eligibleReview).toContainText(REVIEW_ORDER_CODE);
  await expect(eligibleReview).toContainText(PUBLISHED_PRODUCT.name);
  await eligibleReview.getByRole('combobox', { name: 'Đánh giá', exact: true }).selectOption('4');
  await eligibleReview.getByRole('textbox', { name: /Chia sẻ trải nghiệm/u }).fill(comment);
  const createReviewResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/account/reviews')
    && response.request().method() === 'POST');
  await eligibleReview.getByRole('button', { name: 'Gửi đánh giá', exact: true }).click();
  const createReviewResponse = await createReviewResponsePromise;
  const createReviewBody = await createReviewResponse.json();
  expect(createReviewResponse.status(), JSON.stringify(createReviewBody)).toBe(201);
  expect(createReviewBody.data).toMatchObject({ orderId: reviewOrderId, productId, rating: 4, status: 'pending' });
  const reviewId = createReviewBody.data.id;
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
  await expect(page.getByText('Đang chờ duyệt', { exact: true })).toBeVisible();

  const unpublishedReviews = await browserApi(page, `/api/v1/products/${productId}/reviews`);
  expect(unpublishedReviews.status).toBe(200);
  expect(unpublishedReviews.body.data).toHaveLength(0);

  const adminContext = await browser.newContext();
  try {
    const adminPage = await adminContext.newPage();
    await login(adminPage, USERS.admin);
    await adminPage.goto('/admin/reviews');
    const reviewCard = adminPage.locator('.support-moderation-card').filter({ hasText: comment });
    await expect(reviewCard).toHaveCount(1);
    await reviewCard.getByRole('textbox', { name: 'Lý do kiểm duyệt', exact: true }).fill('P11 acceptance moderation reason');
    const moderationResponsePromise = adminPage.waitForResponse((response) => response.url().endsWith(`/api/v1/admin/reviews/${reviewId}/moderation`)
      && response.request().method() === 'POST');
    await reviewCard.getByRole('button', { name: 'Công bố', exact: true }).click();
    const moderationResponse = await moderationResponsePromise;
    const moderationBody = await moderationResponse.json();
    expect(moderationResponse.status(), JSON.stringify(moderationBody)).toBe(200);
    expect(moderationBody.data).toMatchObject({ id: reviewId, status: 'published' });
    await adminPage.reload();
    await expect(adminPage.getByRole('heading', { name: 'Kiểm duyệt đánh giá', exact: true })).toBeVisible();
    await expect(adminPage.locator('.support-state[role="status"]')).toHaveCount(0);
    await adminPage.getByRole('combobox').selectOption('published');
    const publishedReviewCard = adminPage.locator('.support-moderation-card').filter({ hasText: comment });
    await expect(publishedReviewCard).toHaveCount(1);
    await expect(publishedReviewCard).toContainText('Đã công bố');

    const publishedReviews = await browserApi(adminPage, `/api/v1/products/${productId}/reviews`);
    expect(publishedReviews.status).toBe(200);
    expect(publishedReviews.body.data).toHaveLength(1);
    expect(publishedReviews.body.data[0]).toMatchObject({ id: reviewId, rating: 4, comment });
    await adminPage.goto(`/san-pham/${PUBLISHED_PRODUCT.slug}`);
    await expect(adminPage.getByText(comment, { exact: true })).toBeVisible();
  } finally {
    await adminContext.close();
  }

  const persisted = await inspectP11Database(async ({ Review: ReviewRead, AuditLog: AuditLogRead }) => ({
    review: await ReviewRead.findById(reviewId).lean().exec(),
    audit: await AuditLogRead.findOne({ targetType: 'review', action: 'review.moderated', 'changesRedacted.status': 'published' }).lean().exec(),
  }));
  expect(persisted.review).toMatchObject({ moderationStatus: 'published', moderationReason: 'P11 acceptance moderation reason' });
  expect(persisted.audit).toMatchObject({ action: 'review.moderated', outcome: 'success', changesRedacted: { status: 'published' } });
});

test('customer and staff support ticket round-trip keeps internal notes private', async ({ page, browser }) => {
  const subject = 'P11 support privacy acceptance';
  const initialMessage = 'P11 customer describes a delivery question.';
  const internalNote = 'P11 staff internal handling note';
  const staffReply = 'P11 public staff response';
  const customerReply = 'P11 customer follow-up';
  const orderId = process.env.P11_E2E_FIXTURE_STAFF_ORDER_ID;

  await login(page, USERS.customer);
  await page.goto('/tai-khoan/ho-tro');
  const createForm = page.locator('.support-stack > form.support-card');
  await expect(createForm).toHaveCount(1);
  await createForm.getByRole('combobox', { name: 'Chủ đề', exact: true }).selectOption('complaint');
  await createForm.getByRole('textbox', { name: 'Tiêu đề', exact: true }).fill(subject);
  await createForm.getByRole('textbox', { name: /Mã đơn hàng/u }).fill(orderId);
  await createForm.getByRole('textbox', { name: 'Nội dung', exact: true }).fill(initialMessage);
  const createTicketResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/tickets')
    && response.request().method() === 'POST');
  await createForm.getByRole('button', { name: 'Tạo yêu cầu', exact: true }).click();
  const createTicketResponse = await createTicketResponsePromise;
  const createTicketBody = await createTicketResponse.json();
  expect(createTicketResponse.status(), JSON.stringify(createTicketBody)).toBe(201);
  const ticketId = createTicketBody.data.ticket.id;
  expect(createTicketBody.data.ticket).toMatchObject({ kind: 'complaint', orderId, status: 'open' });
  await expect(page.getByRole('status')).toContainText(`Đã tạo yêu cầu ${createTicketBody.data.ticket.code}`);

  const customerInternalNoteAttempt = await browserApi(page, `/api/v1/tickets/${ticketId}/messages`, {
    method: 'POST', body: { body: 'P11 unauthorized internal note', attachmentIds: [], visibility: 'internal' },
  });
  expect(customerInternalNoteAttempt.status).toBe(403);
  expect(customerInternalNoteAttempt.body.error?.code).toBe('FORBIDDEN');

  const staffContext = await browser.newContext();
  let supportPhase = 'staff sign-in';
  try {
    const staffPage = await staffContext.newPage();
    await login(staffPage, USERS.staff);
    supportPhase = 'staff ticket rendering';
    await staffPage.goto(`/staff/support/${ticketId}`);
    await expect(staffPage.getByRole('heading', { name: subject, exact: true })).toBeVisible();
    await expect(staffPage.getByText(initialMessage, { exact: true })).toBeVisible();

    supportPhase = 'staff assignment';
    const assignmentResponsePromise = staffPage.waitForResponse((response) => response.url().endsWith(`/api/v1/staff/tickets/${ticketId}`)
      && response.request().method() === 'PATCH', { timeout: 8000 });
    await staffPage.getByRole('button', { name: 'Nhận xử lý', exact: true }).click();
    const assignmentResponse = await assignmentResponsePromise;
    expect(assignmentResponse.status()).toBe(200);
    await expect(staffPage.locator('.support-thread__header')).toContainText('Đã phân công');

    const staffForm = staffPage.locator('form.support-card.support-form');
    await expect(staffForm).toHaveCount(1);
    supportPhase = 'staff internal note';
    await staffForm.getByRole('combobox', { name: 'Loại tin nhắn', exact: true }).selectOption('internal');
    await staffForm.getByRole('textbox', { name: 'Nội dung', exact: true }).fill(internalNote);
    const internalMessageResponsePromise = staffPage.waitForResponse((response) => response.url().endsWith(`/api/v1/tickets/${ticketId}/messages`)
      && response.request().method() === 'POST', { timeout: 8000 });
    await staffForm.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    const internalMessageResponse = await internalMessageResponsePromise;
    expect(internalMessageResponse.status()).toBe(201);
    await expect(staffPage.getByText(internalNote, { exact: true })).toBeVisible();
    await expect(staffPage.getByRole('region', { name: 'Trao đổi hỗ trợ' }).getByText('Ghi chú nội bộ', { exact: true })).toBeVisible();

    supportPhase = 'staff public response';
    await staffForm.getByRole('combobox', { name: 'Loại tin nhắn', exact: true }).selectOption('customer');
    await staffForm.getByRole('textbox', { name: 'Nội dung', exact: true }).fill(staffReply);
    const staffReplyResponsePromise = staffPage.waitForResponse((response) => response.url().endsWith(`/api/v1/tickets/${ticketId}/messages`)
      && response.request().method() === 'POST', { timeout: 8000 });
    await staffForm.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    const staffReplyResponse = await staffReplyResponsePromise;
    expect(staffReplyResponse.status()).toBe(201);
    await expect(staffPage.getByText(staffReply, { exact: true })).toBeVisible();

    supportPhase = 'customer visibility check';
    await page.goto(`/tai-khoan/ho-tro/${ticketId}`);
    await expect(page.getByRole('heading', { name: subject, exact: true })).toBeVisible();
    await expect(page.getByText(initialMessage, { exact: true })).toBeVisible();
    await expect(page.getByText(staffReply, { exact: true })).toBeVisible();
    await expect(page.getByText(internalNote, { exact: true })).toHaveCount(0);

    supportPhase = 'customer response';
    await page.getByRole('textbox', { name: 'Phản hồi', exact: true }).fill(customerReply);
    const customerReplyResponsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/v1/tickets/${ticketId}/messages`)
      && response.request().method() === 'POST', { timeout: 8000 });
    await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click();
    const customerReplyResponse = await customerReplyResponsePromise;
    expect(customerReplyResponse.status()).toBe(201);
    await expect(page.getByText(customerReply, { exact: true })).toBeVisible();

    supportPhase = 'staff reload';
    await staffPage.reload();
    await expect(staffPage.getByText(customerReply, { exact: true })).toBeVisible();
    await expect(staffPage.getByText(internalNote, { exact: true })).toBeVisible();
  } catch (error) {
    throw new Error(`P11 support browser flow failed during ${supportPhase}: ${error.message}`, { cause: error });
  } finally {
    await staffContext.close();
  }

  const persisted = await inspectP11Database(async ({ Ticket: TicketRead, TicketMessage: TicketMessageRead }) => ({
    ticket: await TicketRead.findById(ticketId).lean().exec(),
    messages: await TicketMessageRead.find({ ticketId }).sort({ createdAt: 1, _id: 1 }).lean().exec(),
  }));
  expect(persisted.ticket.status).toBe('in_progress');
  expect(persisted.ticket.assignedTo).toBeTruthy();
  expect(persisted.messages.map((message) => [message.authorRole, message.visibility, message.body])).toEqual([
    ['customer', 'customer', initialMessage],
    ['staff', 'internal', internalNote],
    ['staff', 'customer', staffReply],
    ['customer', 'customer', customerReply],
  ]);
});

test('test-only configured zone produces a COD quote and persists the same shipping fee', async ({ page }) => {
  await inspectP11Database(async ({ BusinessSetting }) => {
    await BusinessSetting.findOneAndUpdate({ key: 'business' }, {
      $set: {
        values: {
          shippingZones: [{ id: 'p11-test-hai-duong', provinceNames: ['Hải Dương'], feeVnd: 28000 }],
          codEnabled: true,
          checkoutLimits: { maxPendingCodOrders: 3 },
        },
        version: 1,
      },
      $setOnInsert: { key: 'business' },
    }, { upsert: true, returnDocument: 'after' }).exec();
  });

  await page.goto('/san-pham');
  await page.getByRole('link', { name: PUBLISHED_PRODUCT.name, exact: true }).click();
  await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click();
  await page.getByRole('link', { name: 'Xem giỏ hàng', exact: true }).click();
  await page.getByRole('link', { name: 'Tiếp tục thanh toán', exact: true }).click();
  await page.getByLabel('Người nhận', { exact: true }).fill('P11 Shipping Fixture');
  await page.getByLabel('Email nhận xác nhận', { exact: true }).fill('shipping.p11@example.test');
  await page.getByLabel('Số điện thoại', { exact: true }).fill('0900000015');
  await page.getByLabel('Địa chỉ', { exact: true }).fill('15 Đường Thử nghiệm');
  await page.getByLabel('Tỉnh / thành phố', { exact: true }).fill('Hải Dương');
  await page.getByLabel('Địa chỉ đầy đủ', { exact: true }).fill('15 Đường Thử nghiệm, Hải Dương');

  const quoteResponsePromise = page.waitForResponse((response) => response.url().includes('/api/v1/checkout/quote'));
  await page.getByRole('button', { name: 'Tính phí và kiểm tra tồn', exact: true }).click();
  const quoteResponse = await quoteResponsePromise;
  const quoteBody = await quoteResponse.json();
  expect(quoteResponse.status(), JSON.stringify(quoteBody)).toBe(200);
  expect(quoteBody.data.shippingFeeVnd).toBe(28000);
  expect(quoteBody.data.totalVnd).toBe(quoteBody.data.subtotalVnd + 28000);

  await page.getByRole('checkbox').check();
  const orderResponsePromise = page.waitForResponse((response) => response.url().includes('/api/v1/orders')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Xác nhận đặt hàng', exact: true }).click();
  const orderResponse = await orderResponsePromise;
  const orderBody = await orderResponse.json();
  expect(orderResponse.status(), JSON.stringify(orderBody)).toBe(201);
  expect(orderBody.data.order.totalVnd).toBe(quoteBody.data.totalVnd);
  await expect(page.getByRole('heading', { name: 'Cảm ơn bạn đã đặt hàng', exact: true })).toBeVisible();

  const orderId = orderBody.data.order.id;
  const createRequest = orderResponse.request();
  const idempotencyKey = createRequest.headers()['idempotency-key'];
  expect(idempotencyKey).toMatch(/^[a-f\d]{64}$/u);
  const createBody = createRequest.postDataJSON();
  const replay = await browserApi(page, '/api/v1/orders', {
    method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: createBody,
  });
  expect(replay.status, JSON.stringify(replay.body)).toBe(200);
  expect(replay.body.data.order.id).toBe(orderId);
  expect(replay.body.data.order.code).toBe(orderBody.data.order.code);

  const conflict = await browserApi(page, '/api/v1/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: { ...createBody, note: 'P11 changed retry payload' },
  });
  expect(conflict.status, JSON.stringify(conflict.body)).toBe(409);
  expect(conflict.body.error?.code).toBe('IDEMPOTENCY_CONFLICT');

  const guestOrderResponsePromise = page.waitForResponse((response) => response.url().includes(`/api/v1/orders/${orderId}`)
    && response.request().method() === 'GET');
  await page.getByRole('link', { name: 'Xem chi tiết đơn', exact: true }).click();
  const guestOrderResponse = await guestOrderResponsePromise;
  const guestOrderBody = await guestOrderResponse.json();
  expect(guestOrderResponse.status(), JSON.stringify(guestOrderBody)).toBe(200);
  expect(guestOrderBody.data.recipient.recipientName).toBe('P11 Shipping Fixture');
  await expect(page.getByText(orderBody.data.order.code, { exact: true })).toBeVisible();
  await expect(page.getByText('P11 Shipping Fixture', { exact: true })).toBeVisible();

  const persisted = await inspectP11Database(({ Order: OrderRead }) => OrderRead.findById(orderId).lean().exec());
  expect(persisted).toMatchObject({
    paymentMethod: 'cod',
    shippingFeeVnd: 28000,
    totalVnd: quoteBody.data.totalVnd,
  });
});

test('customer registration verifies through encrypted outbox and returns to login before a session starts', async ({ page }) => {
  const email = 'signup.p11@example.test';
  const password = 'P11 synthetic signup password 42!';
  await page.goto('/dang-ky');
  await page.getByLabel('Họ và tên', { exact: true }).fill('P11 Verified Customer');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu · ít nhất 12 ký tự', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill(password);

  const registrationResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/register')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  const registrationResponse = await registrationResponsePromise;
  const registrationBody = await registrationResponse.json();
  expect(registrationResponse.status(), JSON.stringify(registrationBody)).toBe(202);
  expect(registrationBody.data.verificationRequired).toBe(true);
  await expect(page.getByRole('status')).toContainText('đã xếp hướng dẫn xác minh');

  const decryptMail = createOutboxPayloadCipher({ key: process.env.P11_E2E_MAIL_ENCRYPTION_KEY }).decrypt;
  const verificationMail = await inspectP11Database(async ({ OutboxEvent: OutboxEventRead }) => {
    const events = await OutboxEventRead.find({ type: 'operations.delivery', aggregateType: 'mail' }).lean().exec();
    return events.flatMap((event) => event.payload.deliveries
      .filter((delivery) => delivery.encryptedMail)
      .map((delivery) => decryptMail(delivery.encryptedMail)))
      .find((message) => message.template === 'verify_email' && message.recipient === email);
  });
  expect(verificationMail).toEqual(expect.objectContaining({
    template: 'verify_email',
    recipient: email,
    data: expect.objectContaining({ actionUrl: expect.any(String) }),
  }));
  const verificationUrl = new URL(verificationMail.data.actionUrl);
  expect(verificationUrl.origin).toBe('http://127.0.0.1:5190');
  expect(verificationUrl.pathname).toBe('/xac-minh-email');
  const fragmentToken = new URLSearchParams(verificationUrl.hash.slice(1)).get('token');
  const verifyResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/verify-email')
    && response.request().method() === 'POST');
  expect(fragmentToken).toMatch(/^[A-Za-z0-9_-]{32,}$/u);
  await page.goto(`${verificationUrl.pathname}${verificationUrl.hash}`);
  const verifyResponse = await verifyResponsePromise;
  const verifyBody = await verifyResponse.json();
  expect(verifyResponse.status(), JSON.stringify(verifyBody)).toBe(200);
  expect(verifyBody.data.verified).toBe(true);
  await expect(page.locator('.identity-feedback--success')).toContainText('Email đã được xác minh');
  await expect(page).toHaveURL(/\/dang-nhap\?verified=1$/u, { timeout: 8000 });
  await expect(page.getByText('Email đã được xác minh. Đăng nhập để tiếp tục.')).toBeVisible();
  expect((await page.context().cookies()).some((cookie) => cookie.name === 'tl_session')).toBe(false);

  const persisted = await inspectP11Database(async ({ AuthChallenge: AuthChallengeRead, User: UserRead }) => {
    const user = await UserRead.findOne({ emailNormalized: email }).lean().exec();
    const challenge = await AuthChallengeRead.findOne({ userId: user?._id, purpose: 'verify_email' }).lean().exec();
    return { user, challenge };
  });
  expect(persisted.user.emailVerifiedAt).toBeInstanceOf(Date);
  expect(persisted.challenge.consumedAt).toBeInstanceOf(Date);

  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  const loginResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/login')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const loginResponse = await loginResponsePromise;
  const loginBody = await loginResponse.json();
  expect(loginResponse.status(), JSON.stringify(loginBody)).toBe(200);
  expect(loginBody.data.user).toMatchObject({ email, role: 'customer' });
  await expect(page.getByRole('heading', { name: 'Hồ sơ của tôi', exact: true })).toBeVisible();
});

test('admin block, customer appeal and admin approval revoke old access and allow a fresh customer login', async ({ page, browser }) => {
  const blockReason = 'P11 browser acceptance temporary block';
  const appealMessage = 'P11 customer requests an account review.';
  const decisionNote = 'P11 acceptance confirms the customer may regain account access.';
  const adminContext = await browser.newContext();
  try {
    const adminPage = await adminContext.newPage();
    await login(adminPage, USERS.admin);
    await adminPage.goto('/admin/users');
    await adminPage.getByLabel('Tìm tên hoặc email', { exact: true }).fill(USERS.customer.email);
    await adminPage.getByRole('button', { name: 'Lọc', exact: true }).click();
    const customerRow = adminPage.locator('tbody tr').filter({ has: adminPage.getByText(USERS.customer.email, { exact: true }) });
    await expect(customerRow).toHaveCount(1);
    await customerRow.getByRole('link', { name: 'Mở tài khoản', exact: true }).click();
    await expect(adminPage.getByRole('heading', { name: USERS.customer.name, exact: true })).toBeVisible();
    const userId = new URL(adminPage.url()).pathname.split('/').at(-1);
    const statusForm = adminPage.locator('form.identity-admin__panel').filter({ has: adminPage.getByRole('heading', { name: 'Trạng thái', exact: true }) });
    await statusForm.getByLabel('Lý do bắt buộc', { exact: true }).fill(blockReason);
    await statusForm.getByLabel('Tôi xác nhận thay đổi này sẽ thu hồi mọi phiên hiện tại.', { exact: true }).check();
    const blockResponsePromise = adminPage.waitForResponse((response) => response.url().endsWith(`/api/v1/admin/users/${userId}/status`)
      && response.request().method() === 'POST');
    await statusForm.getByRole('button', { name: 'Cập nhật trạng thái', exact: true }).click();
    const blockResponse = await blockResponsePromise;
    const blockBody = await blockResponse.json();
    expect(blockResponse.status(), JSON.stringify(blockBody)).toBe(200);
    expect(blockBody.data).toMatchObject({ id: userId, status: 'blocked' });
    await expect(adminPage.getByRole('status')).toContainText('Trạng thái đã cập nhật');

    await page.goto('/dang-nhap');
    await page.getByLabel('Email', { exact: true }).fill(USERS.customer.email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(FIXTURE_PASSWORD);
    const blockedLoginResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/login')
      && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    const blockedLoginResponse = await blockedLoginResponsePromise;
    expect(blockedLoginResponse.status()).toBe(403);
    expect((await blockedLoginResponse.json()).error?.code).toBe('ACCOUNT_BLOCKED');
    await expect(page.getByRole('heading', { name: 'Tài khoản đang bị khóa', exact: true })).toBeVisible();
    await expect(page.getByText(blockReason, { exact: true })).toBeVisible();

    await page.getByLabel('Nội dung kháng nghị', { exact: true }).fill(appealMessage);
    const appealResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/account/appeals')
      && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Gửi kháng nghị', exact: true }).click();
    const appealResponse = await appealResponsePromise;
    const appealBody = await appealResponse.json();
    expect(appealResponse.status(), JSON.stringify(appealBody)).toBe(201);
    expect(appealBody.data).toMatchObject({ status: 'pending' });
    const appealId = appealBody.data.id;
    await expect(page.getByRole('heading', { name: 'Kháng nghị đang chờ', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Kháng nghị đang chờ', exact: true })).toBeVisible();
    await expect(page.getByText(appealMessage, { exact: true })).toBeVisible();

    await adminPage.goto('/admin/appeals');
    const appealRow = adminPage.locator('tbody tr').filter({ hasText: appealMessage });
    await expect(appealRow).toHaveCount(1);
    await appealRow.getByRole('link', { name: 'Xem và xử lý', exact: true }).click();
    await expect(adminPage.getByRole('heading', { name: USERS.customer.name, exact: true })).toBeVisible();
    await expect(adminPage.getByText(appealMessage, { exact: true })).toBeVisible();
    await adminPage.getByLabel('Lý do gửi tới người dùng', { exact: true }).fill(decisionNote);
    await adminPage.getByLabel('Tôi xác nhận đây là quyết định thủ công và cần được ghi vào lịch sử.', { exact: true }).check();
    const decisionResponsePromise = adminPage.waitForResponse((response) => response.url().endsWith(`/api/v1/admin/appeals/${appealId}/decision`)
      && response.request().method() === 'POST');
    await adminPage.getByRole('button', { name: 'Chấp thuận kháng nghị', exact: true }).click();
    const decisionResponse = await decisionResponsePromise;
    const decisionBody = await decisionResponse.json();
    expect(decisionResponse.status(), JSON.stringify(decisionBody)).toBe(200);
    expect(decisionBody.data).toMatchObject({ id: appealId, status: 'approved', userStatus: 'active', reviewNote: decisionNote });
    await expect(adminPage.getByRole('status')).toContainText('tài khoản đã mở');

    const persisted = await inspectP11Database(async ({ AccountAppeal: AccountAppealRead, AuditLog: AuditLogRead, User: UserRead }) => ({
      user: await UserRead.findById(userId).lean().exec(),
      appeal: await AccountAppealRead.findById(appealId).lean().exec(),
      audit: await AuditLogRead.findOne({ action: 'identity.appeal.decision', 'changesRedacted.decision': 'approved' }).lean().exec(),
    }));
    expect(persisted.user).toMatchObject({ status: 'active', authVersion: 2 });
    expect(persisted.appeal).toMatchObject({ status: 'approved', reviewNote: decisionNote });
    expect(persisted.audit).toMatchObject({ outcome: 'success', changesRedacted: { decision: 'approved', userStatus: 'active' } });
    expect(persisted.audit.targetId).toBe(appealId);

    await page.goto('/dang-nhap');
    await page.getByLabel('Email', { exact: true }).fill(USERS.customer.email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(FIXTURE_PASSWORD);
    const freshLoginResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/login')
      && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    const freshLoginResponse = await freshLoginResponsePromise;
    const freshLoginBody = await freshLoginResponse.json();
    expect(freshLoginResponse.status(), JSON.stringify(freshLoginBody)).toBe(200);
    expect(freshLoginBody.data.user).toMatchObject({ email: USERS.customer.email, role: 'customer', status: 'active' });
    await expect(page.getByRole('heading', { name: 'Hồ sơ của tôi', exact: true })).toBeVisible();
  } finally {
    await adminContext.close();
  }
});

test('customer resets a password through encrypted outbox, consuming the link and revoking old sessions', async ({ page }) => {
  const email = USERS.customer.email;
  const oldPassword = FIXTURE_PASSWORD;
  const newPassword = 'P11 replacement password 57!';

  await login(page, USERS.customer);
  await page.goto('/quen-mat-khau');
  await page.getByLabel('Email', { exact: true }).fill(email);
  const resetRequestResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/forgot-password')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Gửi hướng dẫn', exact: true }).click();
  const resetRequestResponse = await resetRequestResponsePromise;
  const resetRequestBody = await resetRequestResponse.json();
  expect(resetRequestResponse.status(), JSON.stringify(resetRequestBody)).toBe(202);
  expect(resetRequestBody.data.accepted).toBe(true);
  await expect(page.getByRole('status')).toContainText('hướng dẫn đặt lại đã được xếp gửi');

  const decryptMail = createOutboxPayloadCipher({ key: process.env.P11_E2E_MAIL_ENCRYPTION_KEY }).decrypt;
  const resetMail = await inspectP11Database(async ({ OutboxEvent: OutboxEventRead }) => {
    const events = await OutboxEventRead.find({ type: 'operations.delivery', aggregateType: 'mail' }).lean().exec();
    return events.flatMap((event) => event.payload.deliveries
      .filter((delivery) => delivery.encryptedMail)
      .map((delivery) => decryptMail(delivery.encryptedMail)))
      .find((message) => message.template === 'reset_password' && message.recipient === email);
  });
  expect(resetMail).toEqual(expect.objectContaining({
    template: 'reset_password',
    recipient: email,
    data: expect.objectContaining({ actionUrl: expect.any(String) }),
  }));
  const resetUrl = new URL(resetMail.data.actionUrl);
  expect(resetUrl.origin).toBe('http://127.0.0.1:5190');
  expect(resetUrl.pathname).toBe('/dat-lai-mat-khau');
  const fragmentToken = new URLSearchParams(resetUrl.hash.slice(1)).get('token');
  expect(fragmentToken).toMatch(/^[A-Za-z0-9_-]{32,}$/u);

  const resetResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/reset-password')
    && response.request().method() === 'POST');
  await page.goto(`${resetUrl.pathname}${resetUrl.hash}`);
  await page.getByLabel('Mật khẩu mới · ít nhất 12 ký tự', { exact: true }).fill(newPassword);
  await page.getByLabel('Nhập lại mật khẩu mới', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Cập nhật mật khẩu', exact: true }).click();
  const resetResponse = await resetResponsePromise;
  const resetBody = await resetResponse.json();
  expect(resetResponse.status(), JSON.stringify(resetBody)).toBe(200);
  expect(resetBody.data.reset).toBe(true);
  await expect(page.getByRole('status')).toContainText('Mật khẩu đã được cập nhật');

  const persisted = await inspectP11Database(async ({ AuthChallenge: AuthChallengeRead, AuthSession: AuthSessionRead, User: UserRead }) => {
    const user = await UserRead.findOne({ emailNormalized: email }).lean().exec();
    const challenge = await AuthChallengeRead.findOne({ userId: user?._id, purpose: 'reset_password' }).lean().exec();
    const sessions = await AuthSessionRead.find({ userId: user?._id }).lean().exec();
    return { user, challenge, sessions };
  });
  expect(persisted.challenge.consumedAt).toBeInstanceOf(Date);
  expect(persisted.sessions.length).toBeGreaterThan(0);
  expect(persisted.sessions.every((session) => session.revokedAt instanceof Date)).toBe(true);

  await page.goto('/dang-nhap');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(oldPassword);
  const oldLoginResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/login')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const oldLoginResponse = await oldLoginResponsePromise;
  expect(oldLoginResponse.status()).toBe(401);
  expect((await oldLoginResponse.json()).error?.code).toBe('AUTH_REQUIRED');

  await page.getByLabel('Mật khẩu', { exact: true }).fill(newPassword);
  const newLoginResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/login')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const newLoginResponse = await newLoginResponsePromise;
  const newLoginBody = await newLoginResponse.json();
  expect(newLoginResponse.status(), JSON.stringify(newLoginBody)).toBe(200);
  expect(newLoginBody.data.user).toMatchObject({ email, role: 'customer' });
  await expect(page.getByRole('heading', { name: 'Hồ sơ của tôi', exact: true })).toBeVisible();
});
