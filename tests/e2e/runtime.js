import argon2 from 'argon2';
import mongoose from 'mongoose';
import { createServer as createHttpServer } from 'node:http';
import { resolve } from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createApp } from '../../backend/src/app.js';
import { connectDatabase, disconnectDatabase } from '../../backend/src/config/database.js';
import { createDomainComposition } from '../../backend/src/composition.js';
import { Address } from '../../backend/src/models/account/address.model.js';
import { CatalogCategory } from '../../backend/src/models/catalog/category.model.js';
import { CatalogProduct } from '../../backend/src/models/catalog/product.model.js';
import { Inventory } from '../../backend/src/models/commerce/inventory.model.js';
import { Order } from '../../backend/src/models/commerce/order.model.js';
import { User } from '../../backend/src/models/identity/user.model.js';
import { validateEnv } from '../../backend/src/validators/env.validator.js';
import {
  assertDedicatedLocalMongoUri,
  API_PORT,
  DRAFT_PRODUCT,
  FIXTURE_PASSWORD,
  PUBLISHED_PRODUCT,
  USERS,
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
    Order.init(),
    User.init(),
  ]);

  const passwordHash = await argon2.hash(FIXTURE_PASSWORD);
  await User.insertMany(Object.values(USERS).map((user) => ({
    ...user,
    emailNormalized: user.email,
    passwordHash,
    status: 'active',
    emailVerifiedAt: new Date(),
    authVersion: 0,
    version: 0,
  })));

  const category = await CatalogCategory.create({
    slug: 'p11-fixture-category',
    name: 'P11 Fixture Category',
    description: 'Synthetic category for isolated P11 browser tests.',
    sortOrder: 0,
    status: 'published',
    version: 0,
  });

  const [published, draft] = await CatalogProduct.create([
    {
      ...PUBLISHED_PRODUCT,
      line: 'lifestyle',
      categoryId: category._id,
      description: 'Synthetic test-only item. Not a real offer.',
      material: 'Fixture only',
      images: [],
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
    onHand: 2,
    reserved: 0,
    version: 0,
  });
  return { publishedProductId: String(published._id), draftProductId: String(draft._id) };
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
  process.env.NODE_ENV = 'test';
  const env = validateEnv({
    NODE_ENV: 'test',
    PORT: String(API_PORT),
    MONGODB_URI: uri,
    CORS_ORIGIN: WEB_ORIGIN,
    PUBLIC_WEB_URL: WEB_ORIGIN,
    BACKGROUND_WORKERS_ENABLED: 'false',
    PAYOS_ENABLED: 'false',
    AI_DAILY_BUDGET: '0',
  });

  const runtime = { databaseName, composition: null, api: null, vite: null };
  try {
    await connectDatabase(uri);
    const fixture = await seedSyntheticFixture();
    runtime.composition = await createDomainComposition(env);
    const app = createApp({
      corsOrigin: env.corsOrigin,
      trustProxy: 0,
      isDatabaseReady: () => true,
      domainRouters: runtime.composition.domainRouters,
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
        proxy: { '/api': 'http://127.0.0.1:' + API_PORT },
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
  let orderCount = null;
  if (mongoose.connection.readyState === 1) {
    orderCount = await Order.countDocuments({}).exec().catch(() => null);
  }
  await runtime.vite?.close().catch(() => {});
  await closeHttpServer(runtime.api).catch(() => {});
  await runtime.composition?.stopWorkers().catch(() => {});
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.dropDatabase();
    await disconnectDatabase();
  }
  globalThis.__P11_E2E_RUNTIME = null;
  if (orderCount !== null && orderCount !== 0) {
    throw new Error('P11 R06-unconfigured suite should not create an order; found ' + orderCount + '.');
  }
}
