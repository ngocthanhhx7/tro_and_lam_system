import argon2 from 'argon2';
import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { CatalogCategory } from '../../backend/src/models/catalog/category.model.js';
import { CatalogProduct } from '../../backend/src/models/catalog/product.model.js';
import { Inventory } from '../../backend/src/models/commerce/inventory.model.js';
import { User } from '../../backend/src/models/identity/user.model.js';
import {
  assertDedicatedLocalMongoUri,
  FIXTURE_PASSWORD,
  WEB_ORIGIN,
} from './fixtures.js';

const P03_BROWSER_CUSTOMER = Object.freeze({
  name: 'P03 Synthetic Browser Customer',
  email: 'p03.browser.customer@example.test',
  role: 'customer',
});

const P03_BROWSER_PRODUCT = Object.freeze({
  slug: 'p03-fixture-browser-geolocation',
  sku: 'P03-BROWSER-E2E',
  name: 'P03 Browser Geolocation Fixture',
  priceVnd: 48_000,
  images: [
    { url: '/assets/products/concepts/lifestyle/hu-tra-01-front.jpg', alt: 'P03 test fixture image one', sortOrder: 0 },
    { url: '/assets/products/concepts/lifestyle/hu-tra-02-detail.jpg', alt: 'P03 test fixture image two', sortOrder: 1 },
    { url: '/assets/products/concepts/lifestyle/hu-tra-03-context.jpg', alt: 'P03 test fixture image three', sortOrder: 2 },
  ],
});

// Fixed coordinates exercise Chromium's browser API; reverse-geocoder responses are never fabricated.
const BROWSER_FIXTURE_POSITION = Object.freeze({
  latitude: 12.3456,
  longitude: 67.8901,
  accuracy: 35,
});

async function login(page) {
  await page.goto('/dang-nhap');
  await page.getByLabel('Email', { exact: true }).fill(P03_BROWSER_CUSTOMER.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(FIXTURE_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tài khoản của tôi', level: 1, exact: true })).toBeVisible();
}

test.beforeAll(async () => {
  const { uri, databaseName } = assertDedicatedLocalMongoUri(process.env.P11_E2E_MONGODB_URI);
  const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
  try {
    if (connection.name !== databaseName) throw new Error('P03 fixture seed connected to an unexpected E2E database.');
    const Category = connection.model('P03BrowserCategorySeed', CatalogCategory.schema);
    const Product = connection.model('P03BrowserProductSeed', CatalogProduct.schema);
    const Stock = connection.model('P03BrowserInventorySeed', Inventory.schema);
    const Customer = connection.model('P03BrowserCustomerSeed', User.schema);
    const passwordHash = await argon2.hash(FIXTURE_PASSWORD);
    await Customer.create({
      ...P03_BROWSER_CUSTOMER,
      emailNormalized: P03_BROWSER_CUSTOMER.email,
      passwordHash,
      status: 'active',
      emailVerifiedAt: new Date(),
      authVersion: 0,
      version: 0,
    });
    const category = await Category.create({
      slug: 'p03-fixture-geolocation-category',
      name: 'P03 Browser Test Category',
      description: 'Synthetic category for isolated P03 browser acceptance.',
      sortOrder: 0,
      status: 'published',
      version: 0,
    });
    const product = await Product.create({
      ...P03_BROWSER_PRODUCT,
      line: 'lifestyle',
      categoryId: category._id,
      description: 'Synthetic product for isolated P03 browser acceptance.',
      material: 'Fixture only',
      saleMode: 'buy',
      status: 'published',
      featured: false,
      version: 0,
    });
    await Stock.create({ productId: product._id, onHand: 50, reserved: 0, version: 0 });
  } finally {
    await connection.close();
  }
});

async function fillManualAddress(page, label) {
  await page.getByLabel('Tên gợi nhớ', { exact: true }).fill(label);
  await page.getByLabel('Người nhận *', { exact: true }).fill('P03 Browser Fixture');
  await page.getByLabel('Số điện thoại *', { exact: true }).fill('0900000033');
  await page.getByLabel('Số nhà, đường *', { exact: true }).fill('33 Đường Kiểm thử');
  await page.getByLabel('Địa chỉ đầy đủ để giao hàng *', { exact: true }).fill('33 Đường Kiểm thử, Việt Nam');
}

async function saveManualAddress(page, label) {
  await fillManualAddress(page, label);
  const createResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/account/addresses'
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Lưu địa chỉ', exact: true }).click();
  const createResponse = await createResponsePromise;
  const createBody = await createResponse.json();
  expect(createResponse.status(), JSON.stringify(createBody)).toBe(201);
  expect(createBody.data).toMatchObject({
    label,
    recipientName: 'P03 Browser Fixture',
    phone: '0900000033',
    line1: '33 Đường Kiểm thử',
    formattedAddress: '33 Đường Kiểm thử, Việt Nam',
  });
  expect(createBody.data.location).toBeUndefined();
  await expect(page.getByText('Đã lưu địa chỉ.', { exact: true }).first()).toBeVisible();

  const listResponse = await page.evaluate(async () => {
    const response = await fetch('/api/v1/account/addresses', { credentials: 'include' });
    return { status: response.status, body: await response.json() };
  });
  expect(listResponse.status).toBe(200);
  const persisted = listResponse.body.data.find((address) => address.id === createBody.data.id);
  expect(persisted).toMatchObject({
    id: createBody.data.id,
    label,
    recipientName: 'P03 Browser Fixture',
    phone: '0900000033',
    line1: '33 Đường Kiểm thử',
    formattedAddress: '33 Đường Kiểm thử, Việt Nam',
  });
  expect(typeof persisted.isDefault).toBe('boolean');
  expect(persisted.location).toBeUndefined();
  return persisted;
}

test('browser geolocation success reaches the real unconfigured geocoder, then manual address remains checkoutable', async ({ page }) => {
  await page.context().grantPermissions(['geolocation'], { origin: WEB_ORIGIN });
  await page.context().setGeolocation(BROWSER_FIXTURE_POSITION);
  await login(page);
  await page.goto('/tai-khoan/dia-chi');

  const reverseResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/locations/reverse'
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Dùng vị trí hiện tại', exact: true }).click();
  const reverseResponse = await reverseResponsePromise;
  const reverseBody = await reverseResponse.json();
  expect(reverseResponse.status(), JSON.stringify(reverseBody)).toBe(503);
  expect(reverseBody.error?.code).toBe('GEO_UNAVAILABLE');
  expect(reverseResponse.request().postDataJSON()).toEqual({
    lat: BROWSER_FIXTURE_POSITION.latitude,
    lng: BROWSER_FIXTURE_POSITION.longitude,
  });
  await expect(page.getByRole('status').filter({ hasText: 'Gợi ý địa chỉ đang tạm ngừng' })).toContainText('Nhập địa chỉ thủ công vẫn dùng được.');

  const keepLocation = page.getByLabel('Lưu tọa độ gần đúng cùng địa chỉ này. Tọa độ không bắt buộc để đặt hàng.', { exact: true });
  await expect(keepLocation).not.toBeChecked();
  const address = await saveManualAddress(page, 'P03 geolocation fallback');

  await page.goto('/san-pham');
  await page.getByRole('link', { name: P03_BROWSER_PRODUCT.name, exact: true }).click();
  const cartWritePromise = page.waitForResponse((response) => new URL(response.url()).pathname.startsWith('/api/v1/cart/items/')
    && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Thêm vào giỏ', exact: true }).click();
  const cartWrite = await cartWritePromise;
  expect(cartWrite.status()).toBe(200);
  await expect(page.getByRole('link', { name: 'Xem giỏ hàng', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Xem giỏ hàng', exact: true }).click();
  await page.getByRole('link', { name: 'Tiến hành đặt hàng', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thông tin nhận hàng', exact: true })).toBeVisible();
  await expect(page.locator('#checkout-address')).toHaveValue(address.id);
  await expect(page.locator('.commerce-address-card')).toContainText('P03 Browser Fixture');
  await expect(page.locator('.commerce-address-card')).toContainText('33 Đường Kiểm thử, Việt Nam');
});

test('browser timeout test: a geolocation API timeout leaves manual address entry and save available', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(_success, onError) {
          globalThis.queueMicrotask(() => onError({
            code: 3,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          }));
        },
      },
    });
  });

  let reverseGeocodeRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/locations/reverse') reverseGeocodeRequests += 1;
  });

  await login(page);
  await page.goto('/tai-khoan/dia-chi');
  await page.getByRole('button', { name: 'Dùng vị trí hiện tại', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Thiết bị chưa trả vị trí kịp thời' })).toContainText('nhập địa chỉ thủ công');
  expect(reverseGeocodeRequests).toBe(0);

  const address = await saveManualAddress(page, 'P03 browser timeout fallback');
  expect(address.line1).toBe('33 Đường Kiểm thử');
});
