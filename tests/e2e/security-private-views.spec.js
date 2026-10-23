import { test, expect } from './browser-fixtures.js';
import mongoose from 'mongoose';
import { Order } from '../../backend/src/models/commerce/order.model.js';
import { OutboxEvent } from '../../backend/src/models/operations/outbox-event.model.js';
import { createOutboxPayloadCipher } from '../../backend/src/services/operations/outbox-payload-cipher.js';
import { assertDedicatedLocalMongoUri, FIXTURE_PASSWORD, USERS, GUEST_ORDER_CODE, GUEST_ORDER_EMAIL, PUBLISHED_PRODUCT } from './fixtures.js';

async function localDatabase(callback) {
  const { uri, databaseName } = assertDedicatedLocalMongoUri(process.env.P11_E2E_MONGODB_URI);
  const connection = await mongoose.createConnection(uri).asPromise();
  try {
    if (connection.name !== databaseName) throw new Error('Unexpected security fixture database');
    return await callback(connection);
  } finally { await connection.close(); }
}

async function api(page, path, { method = 'GET', body } = {}) {
  return page.evaluate(async ({ path, method, body }) => {
    const headers = { Accept: 'application/json' };
    if (method !== 'GET') {
      const csrf = await (await fetch('/api/v1/auth/csrf')).json();
      headers['X-CSRF-Token'] = csrf.data.csrfToken;
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`/api/v1${path}`, { method, headers, credentials: 'include', ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }, { path, method, body });
}

async function login(page, user) {
  await page.goto('/dang-nhap');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(FIXTURE_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/$/u);
}

async function verifyGuest(page, code, email) {
  await page.goto('/tra-cuu-don-hang');
  await page.getByText('Xác minh email để xem thông tin chi tiết', { exact: true }).click();
  await page.locator('#order-code').fill(code);
  await page.getByLabel('Email đặt hàng', { exact: true }).fill(email);
  const challenge = page.waitForResponse(response => response.url().endsWith('/order-access/challenges') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Gửi mã xác minh', exact: true }).click();
  expect((await challenge).status()).toBe(202);
  const decrypt = createOutboxPayloadCipher({ key: process.env.P11_E2E_MAIL_ENCRYPTION_KEY }).decrypt;
  const accessCode = await localDatabase(async connection => {
    const Mail = connection.model('SecurityMailRead', OutboxEvent.schema);
    const rows = await Mail.find({ type: 'operations.delivery', aggregateType: 'mail' }).sort({ createdAt: 1, _id: 1 }).lean();
    return rows.flatMap(event => event.payload.deliveries.filter(delivery => delivery.encryptedMail).map(delivery => decrypt(delivery.encryptedMail)))
      .reverse().find(message => message.template === 'order_access_code' && message.recipient === email)?.data.code;
  });
  expect(accessCode).toMatch(/^\d{6}$/u);
  await page.getByLabel('Mã xác minh gồm 6 chữ số', { exact: true }).fill(accessCode);
  await page.getByRole('button', { name: 'Xác minh và xem đơn', exact: true }).click();
  await expect(page).toHaveURL(/\/don-hang\/[a-f\d]{24}$/u);
}

test('cross-tab logout and account replacement remove the previous account cart without a page reload', async ({ page, context }) => {
  test.setTimeout(60_000);
  await login(page, USERS.securityCustomerA);
  const cart = await api(page, '/cart');
  expect((await api(page, `/cart/items/${process.env.P11_E2E_FIXTURE_PRODUCT_ID}`, { method: 'PUT', body: { quantity: 1, expectedVersion: cart.body.data.version } })).status).toBe(200);
  await page.goto('/gio-hang');
  await expect(page.locator('.cart-item')).toContainText(PUBLISHED_PRODUCT.name);
  const otherTab = await context.newPage();
  await otherTab.goto('/');
  await otherTab.locator('.header-account-menu summary').hover();
  await Promise.all([
    otherTab.waitForEvent('domcontentloaded'),
    otherTab.locator('.header-account-menu__dropdown').getByRole('button', { name: 'Đăng xuất', exact: true }).click(),
  ]);
  await otherTab.locator('#startup-loader').waitFor({ state: 'detached' });
  await expect(otherTab).toHaveURL(/\/$/u);
  await expect(page.locator('.cart-item')).toHaveCount(0);
  await login(otherTab, USERS.securityCustomerB);
  await expect(page.locator('.header-account-menu summary')).toHaveAttribute('aria-label', new RegExp(USERS.securityCustomerB.name, 'u'));
  expect((await api(page, '/cart')).body.data.items).toEqual([]);
  await expect(page.locator('.cart-item')).toHaveCount(0);
});

test('replacing guest proof in another tab clears the old private order and support thread', async ({ page, context }) => {
  test.setTimeout(60_000);
  const secondCode = 'TL-SECURITY-PROOF-B';
  const secondEmail = 'guest.security.b@example.test';
  const secondId = await localDatabase(async connection => {
    const Orders = connection.model('SecurityOrderFixture', Order.schema);
    const source = await Orders.findById(process.env.P11_E2E_FIXTURE_GUEST_ORDER_ID).lean();
    delete source._id;
    delete source.guestAccessTokenHash;
    source.code = secondCode;
    source.reservationId = new mongoose.Types.ObjectId();
    source.recipientSnapshot = { ...source.recipientSnapshot, recipientName: 'Synthetic recipient B', email: secondEmail };
    const created = await Orders.create(source);
    return String(created._id);
  });
  try {
    await verifyGuest(page, GUEST_ORDER_CODE, GUEST_ORDER_EMAIL);
    await expect(page.getByText('P11 Guest Private Name', { exact: true })).toBeVisible();
    const ticket = await api(page, '/tickets', { method: 'POST', body: { kind: 'support', subject: 'Synthetic private thread A', body: 'Security fixture message A', orderId: process.env.P11_E2E_FIXTURE_GUEST_ORDER_ID } });
    expect(ticket.status).toBe(201);
    const supportTab = await context.newPage();
    await supportTab.goto(`/ho-tro/${ticket.body.data.ticket.id}`);
    await expect(supportTab.getByText('Security fixture message A', { exact: true })).toBeVisible();
    const otherTab = await context.newPage();
    await verifyGuest(otherTab, secondCode, secondEmail);
    await expect(otherTab).toHaveURL(new RegExp(`/don-hang/${secondId}$`, 'u'));
    await expect(page.getByText('P11 Guest Private Name', { exact: true })).toHaveCount(0);
    await expect(supportTab.getByText('Security fixture message A', { exact: true })).toHaveCount(0);
    expect((await api(page, `/orders/${process.env.P11_E2E_FIXTURE_GUEST_ORDER_ID}`)).status).toBe(404);
    expect([403, 404]).toContain((await api(supportTab, `/tickets/${ticket.body.data.ticket.id}`)).status);
  } finally {
    await localDatabase(async connection => {
      const Orders = connection.model('SecurityOrderCleanup', Order.schema);
      await Orders.deleteOne({ _id: secondId, code: secondCode });
    });
  }
});
