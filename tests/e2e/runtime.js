import argon2 from 'argon2';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';
import { createServer as createViteServer } from 'vite';
import { createApp } from '../../backend/src/app.js';
import { connectDatabase, disconnectDatabase } from '../../backend/src/config/database.js';
import { createDomainComposition } from '../../backend/src/composition.js';
import { Address } from '../../backend/src/models/account/address.model.js';
import { CatalogCategory } from '../../backend/src/models/catalog/category.model.js';
import { CatalogProduct } from '../../backend/src/models/catalog/product.model.js';
import { Inventory } from '../../backend/src/models/commerce/inventory.model.js';
import { InventoryMovement } from '../../backend/src/models/commerce/inventory-movement.model.js';
import { Order } from '../../backend/src/models/commerce/order.model.js';
import { StockReservation } from '../../backend/src/models/commerce/stock-reservation.model.js';
import { User } from '../../backend/src/models/identity/user.model.js';
import { AuditLog } from '../../backend/src/models/operations/audit-log.model.js';
import { Notification } from '../../backend/src/models/operations/notification.model.js';
import { OutboxEvent } from '../../backend/src/models/operations/outbox-event.model.js';
import { Review } from '../../backend/src/reviews/review.models.js';
import { validateEnv } from '../../backend/src/validators/env.validator.js';
import {
  assertDedicatedLocalMongoUri,
  API_PORT,
  DRAFT_PRODUCT,
  FIXTURE_PASSWORD,
  GUEST_ORDER_EMAIL,
  PUBLISHED_PRODUCT,
  USERS,
  STAFF_ORDER_CODE,
  REVIEW_ORDER_CODE,
  PAYMENT_ORDER_CODE,
  GUEST_ORDER_CODE,
  WEB_ORIGIN,
  WEB_PORT,
} from './fixtures.js';

const unsafeEnvironmentKeys = [
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM',
  'PAYOS_ENABLED', 'PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY',
  'GEMINI_API_KEY',
];

function assertNoLiveProviderConfiguration() {
  const configured = unsafeEnvironmentKeys.filter((key) => Boolean(process.env[key]));
  if (configured.length) {
    throw new Error('Refusing to run P11 browser tests with provider configuration: ' + configured.join(', '));
  }
}

async function seedSyntheticFixture() {
  await Promise.all([
    Address.init(),
    CatalogCategory.init(),
    CatalogProduct.init(),
    Inventory.init(),
    InventoryMovement.init(),
    Order.init(),
    StockReservation.init(),
    User.init(),
    AuditLog.init(),
    Notification.init(),
    OutboxEvent.init(),
    Review.init(),
  ]);

  const passwordHash = await argon2.hash(FIXTURE_PASSWORD);
  const users = await User.insertMany(Object.values(USERS).map((user) => ({
    ...user,
    emailNormalized: user.email,
    passwordHash,
    status: 'active',
    emailVerifiedAt: new Date(),
    authVersion: 0,
    version: 0,
  })));
  const userByEmail = new Map(users.map((user) => [user.emailNormalized, user]));
  const customer = userByEmail.get(USERS.customer.email);
  const otherCustomer = userByEmail.get(USERS.otherCustomer.email);

  const category = await CatalogCategory.create({
    slug: 'p11-fixture-category',
    name: 'P11 Fixture Category',
    description: 'Synthetic category for isolated P11 browser tests.',
    sortOrder: 0,
    status: 'published',
    version: 0,
  });

  const paginationProducts = Array.from({ length: 12 }, (_, index) => {
    const sequence = String(index + 1).padStart(2, '0');
    return {
      slug: `p11-pagination-fixture-${sequence}`,
      sku: `P11-PAGE-${sequence}`,
      name: `P11 Pagination Fixture ${sequence}`,
      line: 'diplomacy',
      categoryId: category._id,
      description: 'Synthetic pagination fixture. Not a real offer.',
      material: 'Fixture only',
      images: [PUBLISHED_PRODUCT.images[0]],
      saleMode: 'quote',
      status: 'published',
      featured: false,
      version: 0,
    };
  });
  await CatalogProduct.create(paginationProducts);

  const [published, draft] = await CatalogProduct.create([
    {
      ...PUBLISHED_PRODUCT,
      line: 'lifestyle',
      categoryId: category._id,
      description: 'Synthetic test-only item. Not a real offer.',
      material: 'Fixture only',
      images: PUBLISHED_PRODUCT.images,
      saleMode: 'buy',
      status: 'published',
      featured: true,
      version: 0,
    },
    {
      ...DRAFT_PRODUCT,
      line: 'lifestyle',
      categoryId: category._id,
      description: 'This private fixture must not appear publicly.',
      material: 'Fixture only',
      images: [],
      saleMode: 'quote',
      status: 'draft',
      featured: false,
      version: 0,
    },
  ]);

  await Inventory.create({
    productId: published._id,
    onHand: 5,
    reserved: 3,
    version: 0,
  });

  const now = new Date();
  const fixtureOrders = [
    {
      code: STAFF_ORDER_CODE,
      userId: customer._id,
      status: 'processing',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      recipientName: 'P11 Staff Recipient',
      email: 'staff.order.p11@example.test',
      phone: '0900000012',
      address: '12 Đường Thử nghiệm',
      history: [
        { fromStatus: 'pending', toStatus: 'confirmed', createdAt: new Date(now.getTime() - 2_000) },
        { fromStatus: 'confirmed', toStatus: 'processing', createdAt: new Date(now.getTime() - 1_000) },
      ],
      version: 2,
    },
    {
      code: REVIEW_ORDER_CODE,
      userId: customer._id,
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      paidAmountVnd: PUBLISHED_PRODUCT.priceVnd,
      recipientName: 'P11 Review Recipient',
      email: USERS.customer.email,
      phone: '0900000016',
      address: '16 Đường Thử nghiệm',
      history: [
        { fromStatus: 'pending', toStatus: 'confirmed', createdAt: new Date(now.getTime() - 4_000) },
        { fromStatus: 'confirmed', toStatus: 'processing', createdAt: new Date(now.getTime() - 3_000) },
        { fromStatus: 'processing', toStatus: 'shipped', createdAt: new Date(now.getTime() - 2_000) },
        { fromStatus: 'shipped', toStatus: 'delivered', createdAt: new Date(now.getTime() - 1_000) },
      ],
      version: 4,
    },
    {
      code: PAYMENT_ORDER_CODE,
      userId: customer._id,
      status: 'pending',
      paymentMethod: 'payos',
      paymentStatus: 'pending',
      recipientName: 'P11 Payment Recipient',
      email: USERS.customer.email,
      phone: '0900000013',
      address: '13 Đường Thử nghiệm',
      history: [{ toStatus: 'pending', createdAt: now }],
      version: 0,
    },
    {
      code: GUEST_ORDER_CODE,
      status: 'pending',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      recipientName: 'P11 Guest Private Name',
      email: GUEST_ORDER_EMAIL,
      phone: '0900000014',
      address: '14 Đường Riêng tư',
      history: [{ toStatus: 'pending', createdAt: now }],
      version: 0,
    },
  ];
  const orderRecords = fixtureOrders.map((fixture) => {
    const orderId = new mongoose.Types.ObjectId();
    const reservationId = new mongoose.Types.ObjectId();
    return {
      order: {
        _id: orderId,
        code: fixture.code,
        ...(fixture.userId ? { userId: fixture.userId } : {}),
        recipientSnapshot: {
          recipientName: fixture.recipientName,
          email: fixture.email,
          phone: fixture.phone,
          line1: fixture.address,
          countryCode: 'VN',
          formattedAddress: `${fixture.address}, Việt Nam`,
        },
        itemsSnapshot: [{
          productId: published._id,
          sku: published.sku,
          name: published.name,
          quantity: 1,
          unitPriceVnd: PUBLISHED_PRODUCT.priceVnd,
        }],
        subtotalVnd: PUBLISHED_PRODUCT.priceVnd,
        shippingFeeVnd: 0,
        discountVnd: 0,
        totalVnd: PUBLISHED_PRODUCT.priceVnd,
        status: fixture.status,
        paymentMethod: fixture.paymentMethod,
        paymentStatus: fixture.paymentStatus,
        paidAmountVnd: fixture.paidAmountVnd || 0,
        refundedAmountVnd: 0,
        reservationId,
        statusHistory: fixture.history,
        version: fixture.version,
      },
      reservation: {
        orderId,
        items: [{ productId: published._id, quantity: 1 }],
        status: fixture.status === 'delivered' ? 'committed' : 'held',
        version: 0,
      },
    };
  });
  await Order.insertMany(orderRecords.map(({ order }) => order));
  await StockReservation.insertMany(orderRecords.map(({ reservation }) => reservation));

  await Address.create({
    userId: otherCustomer._id,
    label: 'P11 address owned by another customer',
    recipientName: 'Other P11 Recipient',
    phone: '0900000099',
    line1: '99 Đường Thử nghiệm',
    countryCode: 'VN',
    formattedAddress: '99 Đường Thử nghiệm, Việt Nam',
    isDefault: true,
    version: 0,
  });

  const notifications = await Notification.create([
    {
      userId: customer._id,
      eventKey: 'p11-notification-customer-one',
      category: 'order',
      title: 'P11 Customer Order Notice One',
      body: 'Synthetic customer notification for ownership and read-state tests.',
      href: '/tai-khoan/don-hang',
      readAt: null,
    },
    {
      userId: customer._id,
      eventKey: 'p11-notification-customer-two',
      category: 'account',
      title: 'P11 Customer Account Notice Two',
      body: 'Second synthetic customer notification.',
      href: '/tai-khoan',
      readAt: null,
    },
    {
      userId: otherCustomer._id,
      eventKey: 'p11-notification-other-owner',
      category: 'order',
      title: 'P11 Private Other Customer Notice',
      body: 'This synthetic notification belongs only to the other customer.',
      href: '/tai-khoan/don-hang',
      readAt: null,
    },
  ]);

  return {
    publishedProductId: String(published._id),
    draftProductId: String(draft._id),
    otherCustomerAddressId: String((await Address.findOne({ userId: otherCustomer._id }).exec())._id),
    staffOrderId: String(orderRecords.find(({ order }) => order.code === STAFF_ORDER_CODE).order._id),
    paymentOrderId: String(orderRecords.find(({ order }) => order.code === PAYMENT_ORDER_CODE).order._id),
    guestOrderId: String(orderRecords.find(({ order }) => order.code === GUEST_ORDER_CODE).order._id),
    reviewOrderId: String(orderRecords.find(({ order }) => order.code === REVIEW_ORDER_CODE).order._id),
    customerNotificationIds: notifications.slice(0, 2).map((notification) => String(notification._id)),
    otherCustomerNotificationId: String(notifications[2]._id),
    seededOrderCount: orderRecords.length,
    expectedAdditionalOrderCount: 2,
  };
}

function listen(server, port) {
  return new Promise((resolvePromise, reject) => {
    const onError = (error) => {
      server.removeListener('listening', onListen);
      reject(error);
    };
    const onListen = () => {
      server.removeListener('error', onError);
      resolvePromise();
    };
    server.once('error', onError);
    server.once('listening', onListen);
    server.listen(port, '127.0.0.1');
  });
}

function closeHttpServer(server) {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolvePromise, reject) => {
    server.close((error) => (error ? reject(error) : resolvePromise()));
  });
}

export async function startRuntime() {
  assertNoLiveProviderConfiguration();
  const { uri, databaseName } = assertDedicatedLocalMongoUri(process.env.P11_E2E_MONGODB_URI);
  const mediaStorageDirectory = resolve(tmpdir(), `tro-lam-p11-media-${randomBytes(12).toString('hex')}`);
  const supportStorageDirectory = resolve(tmpdir(), `tro-lam-p11-private-support-${randomBytes(12).toString('hex')}`);
  const mailEncryptionKey = randomBytes(32).toString('base64');
  process.env.P11_E2E_MAIL_ENCRYPTION_KEY = mailEncryptionKey;
  process.env.NODE_ENV = 'test';
  const env = validateEnv({
    NODE_ENV: 'test',
    PORT: String(API_PORT),
    MONGODB_URI: uri,
    SUPPORT_INBOX_EMAIL: 'support.p11@example.test',
    CORS_ORIGIN: WEB_ORIGIN,
    PUBLIC_WEB_URL: WEB_ORIGIN,
    BACKGROUND_WORKERS_ENABLED: 'false',
    PAYOS_ENABLED: 'false',
    AI_DAILY_BUDGET: '0',
    OUTBOX_ENCRYPTION_KEY: mailEncryptionKey,
    MEDIA_STORAGE_DRIVER: 'local',
    MEDIA_STORAGE_PATH: mediaStorageDirectory,
    MEDIA_PUBLIC_BASE_URL: '/media/products',
    SUPPORT_STORAGE_DRIVER: 'local',
    SUPPORT_STORAGE_PATH: supportStorageDirectory,
  });

  const runtime = { databaseName, mediaStorageDirectory, supportStorageDirectory, composition: null, api: null, vite: null };
  try {
    await connectDatabase(uri);
    const fixture = await seedSyntheticFixture();
    // Browser tests share one loopback IP; backend route tests cover the production login limits.
    const testConfig = { ...env, loginRateLimit: 10_000, identityLoginRateLimit: 10_000 };
    runtime.composition = await createDomainComposition(testConfig);
    const app = createApp({
      corsOrigin: env.corsOrigin,
      trustProxy: 0,
      isDatabaseReady: () => true,
      domainRouters: runtime.composition.domainRouters,
      mediaStaticDirectory: mediaStorageDirectory,
      // Browser acceptance uses one loopback IP across tests; preserve production defaults outside this harness.
      apiRateLimitLimit: 10_000,
    });
    runtime.api = createHttpServer(app);
    await listen(runtime.api, API_PORT);

    runtime.vite = await createViteServer({
      configFile: resolve('fondend/vite.config.js'),
      root: resolve('fondend'),
      server: {
        host: '127.0.0.1',
        port: WEB_PORT,
        strictPort: true,
        proxy: { '/api': 'http://127.0.0.1:' + API_PORT, '/media': 'http://127.0.0.1:' + API_PORT },
      },
      logLevel: 'warn',
    });
    await runtime.vite.listen();

    const health = await fetch(WEB_ORIGIN + '/api/v1/health/ready');
    if (!health.ok) throw new Error('Integrated test API readiness returned ' + health.status + '.');
    runtime.fixture = fixture;
    return runtime;
  } catch (error) {
    await stopRuntime(runtime).catch(() => {});
    throw error;
  }
}

export async function stopRuntime(runtime = globalThis.__P11_E2E_RUNTIME) {
  if (!runtime) return;
  const safeDatabase = assertDedicatedLocalMongoUri(process.env.P11_E2E_MONGODB_URI);
  if (runtime.databaseName !== safeDatabase.databaseName
    || (mongoose.connection.readyState === 1 && mongoose.connection.name !== safeDatabase.databaseName)) {
    throw new Error('Refusing to clean up a Mongo database outside the validated P11 E2E target.');
  }
  const mediaRoot = resolve(tmpdir());
  const mediaDirectory = resolve(runtime.mediaStorageDirectory);
  const mediaRelativePath = relative(mediaRoot, mediaDirectory);
  if (!mediaRelativePath || mediaRelativePath.startsWith('..') || isAbsolute(mediaRelativePath)
    || !basename(mediaDirectory).startsWith('tro-lam-p11-media-')) {
    throw new Error('Refusing to remove a media directory outside the dedicated P11 temp path.');
  }
  const supportDirectory = resolve(runtime.supportStorageDirectory);
  const supportRelativePath = relative(mediaRoot, supportDirectory);
  if (!supportRelativePath || supportRelativePath.startsWith('..') || isAbsolute(supportRelativePath)
    || !basename(supportDirectory).startsWith('tro-lam-p11-private-support-')) {
    throw new Error('Refusing to remove a private support directory outside the dedicated P11 temp path.');
  }
  let orderCount = null;
  if (mongoose.connection.readyState === 1) {
    orderCount = await Order.countDocuments({}).exec().catch(() => null);
  }
  await runtime.vite?.close().catch(() => {});
  await closeHttpServer(runtime.api).catch(() => {});
  await runtime.composition?.stopWorkers().catch(() => {});
  await rm(mediaDirectory, { recursive: true, force: true });
  await rm(supportDirectory, { recursive: true, force: true });
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.dropDatabase();
    await disconnectDatabase();
  }
  globalThis.__P11_E2E_RUNTIME = null;
  const expectedOrderCount = runtime.fixture.seededOrderCount + runtime.fixture.expectedAdditionalOrderCount;
  if (orderCount !== null && (orderCount < runtime.fixture.seededOrderCount || orderCount > expectedOrderCount)) {
    throw new Error('P11 test database order count is outside its expected synthetic fixture range ('
      + runtime.fixture.seededOrderCount + ' to ' + expectedOrderCount + ', found ' + orderCount + ').');
  }
}
