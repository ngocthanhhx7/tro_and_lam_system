import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { CatalogProduct } from '../../src/models/catalog/product.model.js';
import { CatalogCategory } from '../../src/models/catalog/category.model.js';
import { Inventory } from '../../src/models/commerce/inventory.model.js';
import { createMongooseCatalogRepository } from '../../src/services/catalog/mongoose-catalog.repository.js';
import { createCatalogService } from '../../src/services/catalog/catalog.service.js';

const uri = process.env.QUERY_TEST_REPLICA_SET_URI;
test('joined catalogue preserves exact DTOs, filters and totals, with fresh stock and one command', { skip: !uri }, async t => {
  const target = new URL(uri);
  assert.equal(target.protocol, 'mongodb:');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
  assert.equal(target.username + target.password + target.search + target.hash, '');
  await mongoose.connect(uri, { dbName: `tro_lam_list_test_${randomBytes(12).toString('hex')}` });
  try {
    await Promise.all([CatalogCategory.createIndexes(), CatalogProduct.createIndexes(), Inventory.createIndexes()]);
    const categories = ['published', 'draft', 'archived'].map(status => ({ _id: new mongoose.Types.ObjectId(), slug: `local-${status}`, status }));
    await CatalogCategory.collection.insertMany(categories);
    const products = Array.from({ length: 115 }, (_, i) => ({
      _id: new mongoose.Types.ObjectId(), slug: `local-list-${i}`, sku: i === 6 ? 'demo-lif-006' : i === 7 ? 'DEMO-DIP-007' : `LOCAL-${i}`,
      purchaseApproved: i === 7, name: `Local ${String(i).padStart(3, '0')}`, description: i % 2 ? 'cup' : 'vase',
      status: i === 3 ? 'draft' : i === 4 ? 'archived' : 'published',
      categoryId: categories[i < 2 ? i + 1 : 0]._id,
      line: i % 2 ? 'lifestyle' : 'diplomacy', saleMode: i === 5 ? 'quote' : i % 2 ? 'buy' : 'both',
      priceVnd: i === 5 ? undefined : (i + 1) * 10000, images: [{ url: '/local.webp', alt: 'Local fixture' }],
      createdAt: new Date(2026, 0, i + 1),
    }));
    await CatalogProduct.collection.insertMany(products);
    await Inventory.collection.insertMany(products.filter((_, i) => i !== 8).map((p, i) => ({ productId: p._id, onHand: i === 9 ? Infinity : 3, reserved: i % 3 ? 0 : 3 })));
    const inventoryPort = { async getAvailability(ids, { session } = {}) {
      const rows = await Inventory.find({ productId: { $in: ids } }).session(session || null).lean();
      const byId = new Map(rows.map(row => [String(row.productId), Math.max(0, row.onHand - row.reserved)]));
      return ids.map(id => ({ productId: id, available: Number.isFinite(byId.get(id) || 0) && (byId.get(id) || 0) > 0 }));
    } };
    const oldRepo = createMongooseCatalogRepository();
    const newRepo = createMongooseCatalogRepository({ Inventory });
    const oldService = createCatalogService({ productRepository: oldRepo, categoryRepository: oldRepo, inventoryPort });
    const service = createCatalogService({ productRepository: newRepo, categoryRepository: newRepo, inventoryPort: { getAvailability() { throw new Error('Redundant stock read'); } } });
    let cases = 0;
    for (const available of [undefined, 'true', 'false']) {
      for (const sort of ['newest', 'name', 'price_asc', 'price_desc']) {
        for (const filter of [{}, { line: 'lifestyle' }, { category: 'local-published' }, { category: String(categories[0]._id) }, { category: 'local-draft' }, { saleMode: 'quote' }, { saleMode: 'both' }, { priceMin: '200000', priceMax: '800000' }, { q: 'cup' }, { q: '.*' }, { buyableOnly: 'true' }]) {
          for (const page of ['1', '2', '25']) {
            const query = { available, sort, page, limit: '5', ...filter };
            assert.deepEqual(await service.listPublishedProducts(query), await oldService.listPublishedProducts(query), JSON.stringify(query));
            cases += 1;
          }
        }
      }
    }
    const commands = [];
    mongoose.set('debug', (collection, method) => { if (['aggregate', 'find', 'distinct'].includes(method)) commands.push(`${collection}.${method}`); });
    for (const available of [undefined, 'true', 'false']) {
      commands.length = 0;
      const result = await service.listPublishedProducts({ available, limit: '100' });
      assert.deepEqual(commands, ['products.aggregate']);
      assert.ok(result.items.every(row => !Object.keys(row).some(key => key.startsWith('_catalog') || key === '_publishedCategory' || key === 'onHand' || key === 'reserved')));
    }
    mongoose.set('debug', false);
    await Inventory.updateMany({}, { $set: { onHand: 3, reserved: 3 } });
    assert.equal((await service.listPublishedProducts({ available: 'true' })).pagination.total, 0);
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await Inventory.updateOne({ productId: products[7]._id }, { $set: { reserved: 0 } }, { session });
      assert.equal((await service.listPublishedProducts({ available: 'true' }, { session })).pagination.total, 1);
      await session.abortTransaction();
      assert.equal((await service.listPublishedProducts({ available: 'true' })).pagination.total, 0);
    } finally { await session.endSession(); }
    t.diagnostic(`${cases} old/new comparisons; all list variants use one aggregate; stock changes and transaction rollback observed`);
  } finally {
    mongoose.set('debug', false);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
