import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDemoCatalogMongoUri, readConceptManifest } from '../../src/scripts/seed-demo-catalog.js';

test('demo catalog seed accepts only its dedicated unauthenticated loopback database', () => {
  assert.deepEqual(
    assertDemoCatalogMongoUri('mongodb://127.0.0.1:27017/tro_lam_dev_catalog_demo'),
    { uri: 'mongodb://127.0.0.1:27017/tro_lam_dev_catalog_demo', databaseName: 'tro_lam_dev_catalog_demo' },
  );
});

test('demo catalog manifest contains three existing same-site concept images for each approved preview entry', async () => {
  const products = await readConceptManifest();
  assert.equal(products.length, 8);
  assert.deepEqual(
    products.reduce((counts, product) => {
      counts[product.line] = (counts[product.line] ?? 0) + 1;
      return counts;
    }, {}),
    { lifestyle: 3, diplomacy: 5 },
  );
  for (const product of products) {
    assert.ok(product.images.length >= 3, `${product.slug} has at least three images`);
    assert.deepEqual(product.images.map((image) => image.sortOrder), product.images.map((_, index) => index));
    for (const image of product.images) {
      assert.match(image.url, /^\/assets\/products\/concepts\//u);
      assert.match(image.alt, /concept AI/u);
    }
  }
});

test('demo catalog seed rejects missing, remote, authenticated, configured, and wrong-database URIs', () => {
  for (const uri of [
    undefined,
    'mongodb://cluster.example/tro_lam_dev_catalog_demo',
    'mongodb://user:password@127.0.0.1:27017/tro_lam_dev_catalog_demo',
    'mongodb://127.0.0.1:27017/tro_lam_dev_catalog_demo?replicaSet=rs0',
    'mongodb://127.0.0.1:27017/production',
    'mongodb+srv://127.0.0.1/tro_lam_dev_catalog_demo',
  ]) {
    assert.throws(() => assertDemoCatalogMongoUri(uri), /Refusing catalog demo seed|Set DEMO_CATALOG_MONGODB_URI/);
  }
});
