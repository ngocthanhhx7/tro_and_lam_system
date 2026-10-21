import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { CatalogProduct } from '../../src/models/catalog/product.model.js';
import { CatalogCategory } from '../../src/models/catalog/category.model.js';
import { Inventory } from '../../src/models/commerce/inventory.model.js';
import { createMongooseCatalogRepository } from '../../src/services/catalog/mongoose-catalog.repository.js';
import { createCatalogService } from '../../src/services/catalog/catalog.service.js';
import { createReviewService } from '../../src/reviews/review.service.js';

const uri = process.env.QUERY_TEST_REPLICA_SET_URI;
test('detail lookup and ID-batch reads enforce published categories and read fresh batched stock', { skip: !uri }, async (t) => {
  const target = new URL(uri);
  assert.equal(target.protocol, 'mongodb:');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
  assert.equal(target.username + target.password + target.search + target.hash, '');
  await mongoose.connect(uri, { dbName: `tro_lam_detail_test_${randomBytes(12).toString('hex')}` });
  try {
    const categories = ['published', 'draft', 'archived'].map(status => ({ _id: new mongoose.Types.ObjectId(), slug: `local-${status}`, status }));
    await CatalogCategory.collection.insertMany(categories);
    const products = Array.from({ length: 7 }, (_, index) => ({
      _id: new mongoose.Types.ObjectId(), slug: `local-detail-${index}`, sku: `LOCAL-DETAIL-${index}`, name: `Local ${index}`,
      status: index === 6 ? 'draft' : 'published', line: 'lifestyle', categoryId: categories[index === 1 ? 1 : index === 2 ? 2 : 0]._id,
      saleMode: 'buy', priceVnd: 100000, images: [{ url: '/local.webp', alt: 'Local fixture', sortOrder: 0 }],
      createdAt: new Date(2026, 0, index + 1),
    }));
    await CatalogProduct.collection.insertMany(products);
    await Inventory.collection.insertMany(products.map(product => ({ productId: product._id, onHand: 3, reserved: 0 })));
    const repository = createMongooseCatalogRepository();
    repository.getPublishedCategoryForProduct = repository.getPublishedCategoryIds = async () => { throw new Error('Unexpected redundant category query'); };
    let stockReads = 0;
    const inventoryPort = { async getAvailability(ids, { session } = {}) {
      stockReads += 1;
      const rows = await Inventory.find({ productId: { $in: ids } }).session(session || null).lean();
      return rows.map(row => ({ productId: row.productId, available: row.onHand - row.reserved > 0 }));
    } };
    const service = createCatalogService({ productRepository: repository, categoryRepository: repository, inventoryPort });
    for (const index of [1, 2, 6]) await assert.rejects(service.getPublishedProductBySlug(products[index].slug), error => error.status === 404);
    assert.equal(stockReads, 0);
    for (const index of [1, 2, 6]) assert.equal(await service.hasPublishedProduct(String(products[index]._id)), false);
    assert.equal(await service.hasPublishedProduct(String(products[0]._id)), true);
    assert.equal(await service.hasPublishedProduct('invalid-id'), false);
    assert.equal(stockReads, 0, 'Existence checks must not load inventory');
    const result = await service.getPublishedProductBySlug(products[0].slug);
    assert.equal(stockReads, 1);
    assert.equal(result.availableForPurchase, true);
    assert.deepEqual(result.relatedProducts.map(row => row.id), [5, 4, 3].map(index => String(products[index]._id)));
    assert.ok(result.relatedProducts.every(row => row.sku === undefined && row._publishedCategory === undefined));
    await Inventory.updateMany({}, { $set: { reserved: 3 } });
    const fresh = await service.getPublishedProductBySlug(products[0].slug);
    assert.equal(stockReads, 2);
    assert.equal(fresh.availableForPurchase, false);
    assert.ok(fresh.relatedProducts.every(row => row.availableForPurchase === false));
    const batch = await service.getPublishedProductsByIds(products.map(row => String(row._id)));
    assert.deepEqual(new Set(batch.map(row => row.id)), new Set([0, 3, 4, 5].map(index => String(products[index]._id))));
    // Compare the real default review repository with the old full-DTO catalog
    // port, then with the existence port; both return identical public metadata.
    const commands = [];
    mongoose.set('debug', (collection, method) => { if (['aggregate', 'find', 'countDocuments'].includes(method)) commands.push(`${collection}.${method}`); });
    const oldReviewService = createReviewService({ ports: { catalog: { getPublishedProductsByIds: service.getPublishedProductsByIds } } });
    const newReviewService = createReviewService({ ports: { catalog: service } });
    const oldResult = await oldReviewService.listPublishedProductReviews(String(products[0]._id), { page: 1, limit: 10 });
    const before = [...commands];
    commands.length = 0;
    const readsBeforeGate = stockReads;
    const newResult = await newReviewService.listPublishedProductReviews(String(products[0]._id), { page: 1, limit: 10 });
    const after = [...commands];
    mongoose.set('debug', false);
    assert.deepEqual(newResult, oldResult);
    assert.equal(stockReads, readsBeforeGate);
    assert.equal(before.length, 4);
    assert.equal(after.length, 3);
    assert.equal(after.some(command => command.startsWith('inventory.')), false);
    t.diagnostic(JSON.stringify({ publicReviewCommandsBefore: before, publicReviewCommandsAfter: after }));
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const transactional = await service.getPublishedProductBySlug(products[0].slug, { session });
        assert.equal(transactional.availableForPurchase, false);
        assert.equal(transactional.relatedProducts.length, 3);
      });
    } finally { await session.endSession(); }
  } finally {
    mongoose.set('debug', false);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
