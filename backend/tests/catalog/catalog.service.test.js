import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogService } from '../../src/services/catalog/catalog.service.js';
import { createDeterministicFakeMediaProvider, createUnavailableMediaProvider } from '../../src/services/catalog/media-provider.js';

const categoryId = '64f000000000000000000001';
const adminId = '64f000000000000000000099';

function product(id, overrides = {}) {
  return {
    _id: id,
    slug: `product-${id.slice(-2)}`,
    sku: `SKU-${id.slice(-2)}`,
    name: `Product ${id.slice(-2)}`,
    line: 'lifestyle',
    categoryId,
    description: 'A published product',
    material: 'Ceramic',
    images: [{ url: '/assets/product.webp', alt: 'Ceramic product', sortOrder: 0 }],
    saleMode: 'buy',
    priceVnd: 250000,
    status: 'published',
    featured: false,
    version: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
}

function category(id = categoryId, overrides = {}) {
  return { _id: id, slug: 'ceramics', name: 'Ceramics', sortOrder: 0, status: 'published', version: 0, ...overrides };
}

function serviceFor(overrides = {}) {
  const repository = {
    listPublishedProductPage: async () => ({ items: [], total: 0 }),
    streamPublishedProducts: async function* () {},
    resolvePublishedCategory: async () => category(),
    listPublishedCategories: async () => [category()],
    findPublishedProductBySlug: async () => null,
    getPublishedCategoryForProduct: async () => category(),
    findPublishedProductsByIds: async () => [],
    getPublishedCategoryIds: async () => [categoryId],
    findAdminProductById: async () => null,
    createProduct: async (input) => ({ _id: '64f000000000000000000010', ...input, version: 0 }),
    updateProduct: async () => null,
    archiveProduct: async () => null,
    listAdminProducts: async () => ({ items: [], total: 0 }),
    listAdminCategories: async () => [],
    findCategoryById: async () => category(),
    createCategory: async (input) => ({ _id: '64f000000000000000000020', ...input, version: 0 }),
    updateCategory: async () => null,
    archiveCategory: async () => null,
    hasProductsInCategory: async () => false,
    createMediaAsset: async (input) => ({ _id: '64f000000000000000000030', ...input }),
  };
  Object.assign(repository, overrides.repository);
  return {
    repository,
    service: createCatalogService({
      productRepository: repository,
      categoryRepository: repository,
      inventoryPort: { getAvailability: async (ids) => ids.map((productId) => ({ productId, available: true })) },
      ...overrides,
    }),
  };
}

test('public product summaries omit SKU and inventory internals while exposing availability', async () => {
  const item = product('64f000000000000000000011', { featured: true });
  const { service } = serviceFor({
    repository: { listPublishedProductPage: async () => ({ items: [item], total: 1 }) },
    inventoryPort: { getAvailability: async (ids) => ids.map((productId) => ({ productId, available: true, onHand: 20, reserved: 4 })) },
  });

  const result = await service.listPublishedProducts({ page: '1', limit: '20' });

  assert.equal(result.items[0].id, item._id);
  assert.equal(result.items[0].availableForPurchase, true);
  assert.equal(result.items[0].featured, true);
  assert.equal('sku' in result.items[0], false);
  assert.equal('onHand' in result.items[0], false);
  assert.equal('reserved' in result.items[0], false);
  assert.deepEqual(result.pagination, { page: 1, limit: 20, total: 1, totalPages: 1 });
});

test('public search passes normalized filters and returns repository pagination unchanged', async () => {
  const item = product('64f000000000000000000012', { name: 'Blue Tea Cup' });
  let received;
  const { service } = serviceFor({
    repository: {
      listPublishedProductPage: async (filters) => {
        received = filters;
        return { items: [item], total: 3 };
      },
    },
  });

  const result = await service.searchPublished({ q: '  tea  ', page: '2', limit: '1', sort: 'name' });

  assert.equal(received.q, 'tea');
  assert.equal(received.page, 2);
  assert.equal(received.limit, 1);
  assert.equal(received.sort, 'name');
  assert.deepEqual(result.pagination, { page: 2, limit: 1, total: 3, totalPages: 3 });
});

test('availability filtering paginates only known matching inventory and fails closed on provider failure', async () => {
  const products = [
    product('64f000000000000000000021'),
    product('64f000000000000000000022'),
    product('64f000000000000000000023'),
  ];
  const { service } = serviceFor({
    repository: { streamPublishedProducts: async function* () { yield* products; } },
    inventoryPort: {
      getAvailability: async (ids) => ids.map((productId) => ({
        productId,
        available: productId === products[1]._id,
      })),
    },
  });

  const result = await service.listPublishedProducts({ available: 'true', page: '1', limit: '10' });
  assert.deepEqual(result.items.map((item) => item.id), [products[1]._id]);
  assert.equal(result.pagination.total, 1);

  const unavailable = serviceFor({
    repository: { streamPublishedProducts: async function* () { yield products[0]; } },
    inventoryPort: { getAvailability: async () => { throw new Error('inventory down'); } },
  }).service;
  await assert.rejects(
    unavailable.listPublishedProducts({ available: 'false' }),
    (error) => error.status === 503 && error.code === 'DATABASE_UNAVAILABLE',
  );
});

test('ordinary browse marks missing inventory unknown and never offers a purchase-ready DTO', async () => {
  const item = product('64f000000000000000000031');
  const { service } = serviceFor({
    repository: { listPublishedProductPage: async () => ({ items: [item], total: 1 }) },
    inventoryPort: { getAvailability: async () => [] },
  });

  const result = await service.listPublishedProducts({});
  assert.equal(result.items[0].availableForPurchase, false);
  assert.match(result.items[0].stockLabel, /xác minh/i);
});

test('quote-only products omit price and cannot be returned by the checkout port', async () => {
  const quote = product('64f000000000000000000041', { saleMode: 'quote', priceVnd: undefined });
  let inventoryReads = 0;
  let streamReads = 0;
  const { service } = serviceFor({
    repository: {
      listPublishedProductPage: async () => ({ items: [quote], total: 1 }),
      streamPublishedProducts: async function* () { streamReads += 1; yield quote; },
      findPublishedProductsByIds: async () => [quote],
    },
    inventoryPort: { getAvailability: async () => { inventoryReads += 1; return [{ productId: quote._id, available: true }]; } },
  });

  const listed = await service.listPublishedProducts({});
  assert.equal('priceVnd' in listed.items[0], false);
  assert.equal(listed.items[0].availableForPurchase, false);
  assert.equal(listed.items[0].stockLabel, 'Yêu cầu tư vấn');
  assert.deepEqual(await service.getCheckoutProducts([quote._id]), []);
  assert.deepEqual(await service.listPublishedProducts({ saleMode: 'quote', available: 'true' }), {
    items: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
  assert.deepEqual(await service.searchPublished({ saleMode: 'quote', available: 'true' }), {
    items: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
  assert.equal(inventoryReads, 0);
  assert.equal(streamReads, 0);
});

test('draft and products in unpublished categories stay private by slug and ID', async () => {
  const draft = product('64f000000000000000000051', { status: 'draft' });
  const { service } = serviceFor({
    repository: {
      findPublishedProductBySlug: async () => null,
      findPublishedProductsByIds: async () => [draft],
      getPublishedCategoryIds: async () => [],
    },
  });

  await assert.rejects(service.getPublishedProductBySlug(draft.slug), (error) => error.status === 404);
  assert.deepEqual(await service.getPublishedProductsByIds([draft._id]), []);
});

test('an unpublished linked story does not hide its published product detail', async () => {
  const item = product('64f000000000000000000055', { storyId: '64f000000000000000000056' });
  const { service } = serviceFor({
    repository: {
      findPublishedProductBySlug: async () => item,
      listPublishedProductPage: async () => ({ items: [], total: 0 }),
    },
    storyPort: { getPublishedStoryById: async () => { throw Object.assign(new Error('Story not published'), { status: 404 }); } },
  });

  const detail = await service.getPublishedProductBySlug(item.slug);
  assert.equal(detail.id, item._id);
  assert.equal(detail.story, undefined);
});

test('stale product edits conflict and duplicate SKU maps to HTTP 409', async () => {
  const current = product('64f000000000000000000061');
  const { service } = serviceFor({
    repository: {
      findAdminProductById: async () => current,
      createProduct: async () => { throw Object.assign(new Error('duplicate'), { code: 11000, keyPattern: { sku: 1 } }); },
    },
  });

  await assert.rejects(
    service.updateProduct(current._id, { expectedVersion: 2, name: 'Changed' }),
    (error) => error.status === 409 && error.code === 'VERSION_CONFLICT',
  );
  await assert.rejects(
    service.createProduct({
      name: 'Cup', slug: 'cup', sku: 'SKU-1', line: 'lifestyle', categoryId,
      description: 'A cup', material: 'Ceramic', images: [], saleMode: 'buy', priceVnd: 100,
      status: 'draft', featured: false,
    }),
    (error) => error.status === 409,
  );
});

test('catalog product creation writes its redacted P09 audit event in the Mongo transaction', async () => {
  const session = { transaction: 'catalog-create' };
  let createdWith;
  let auditEvent;
  let auditSession;
  const { service } = serviceFor({
    repository: {
      transaction: (work) => work(session),
      findCategoryById: async (_id, options) => {
        assert.equal(options.session, session);
        return category();
      },
      createProduct: async (input, options) => {
        createdWith = options.session;
        return { _id: '64f000000000000000000010', version: 0, ...input };
      },
    },
    auditPort: {
      appendAudit: async (event, options) => {
        auditEvent = event;
        auditSession = options.session;
      },
    },
  });

  await service.createProduct({
    name: 'Cup', slug: 'cup', sku: 'SKU-1', line: 'lifestyle', categoryId,
    description: 'A cup', material: 'Ceramic', images: [], saleMode: 'buy', priceVnd: 100,
    status: 'draft', featured: false,
  }, { actor: { id: adminId, role: 'admin', requestId: 'request-1' } });

  assert.equal(createdWith, session);
  assert.equal(auditSession, session);
  assert.equal(auditEvent.action, 'catalog.product.created');
  assert.equal(auditEvent.targetId, '64f000000000000000000010');
  assert.equal(auditEvent.requestId, 'request-1');
  assert.deepEqual(auditEvent.changesRedacted.fields, ['categoryId', 'description', 'featured', 'images', 'line', 'material', 'name', 'priceVnd', 'saleMode', 'sku', 'slug', 'status']);
});

test('the deterministic media fake stores repeatable content and unavailable media reports the contract code', async () => {
  const mediaProvider = createDeterministicFakeMediaProvider();
  const { service } = serviceFor({ mediaProvider });
  const actor = { id: adminId, role: 'admin', status: 'active' };
  const file = { buffer: Buffer.from('fixture image bytes'), bytes: 19, mimeType: 'image/png' };

  const asset = await service.createMediaAsset({ file, alt: 'Test image' }, { actor });
  assert.equal(asset.status, 'ready');
  assert.equal(mediaProvider.stored.get(asset.url.split('/').at(-1)).toString(), 'fixture image bytes');

  const unavailable = serviceFor({ mediaProvider: createUnavailableMediaProvider() }).service;
  await assert.rejects(
    unavailable.createMediaAsset({ file, alt: 'Test image' }, { actor }),
    (error) => error.status === 503 && error.code === 'MEDIA_UNAVAILABLE',
  );
});
