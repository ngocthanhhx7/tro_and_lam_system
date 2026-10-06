import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDemoCatalogMongoUri, readConceptManifest } from '../../src/scripts/seed-demo-catalog.js';

test('demo catalog seed accepts only its dedicated unauthenticated loopback database', () => {
  assert.deepEqual(
    assertDemoCatalogMongoUri('mongodb://127.0.0.1:27017/tro_lam_dev_catalog_demo'),
    { uri: 'mongodb://127.0.0.1:27017/tro_lam_dev_catalog_demo', databaseName: 'tro_lam_dev_catalog_demo' },
  );
});

test('demo catalog manifest has at least three existing images per product and discloses each image source', async () => {
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
    assert.equal(new Set(product.images.map((image) => image.url)).size, product.images.length, `${product.slug} has distinct images`);
    assert.deepEqual(product.images.map((image) => image.sortOrder), product.images.map((_, index) => index));
    for (const image of product.images) {
      assert.match(image.url, /^\/assets\/products\/(?:concepts|generated|owner-provided|derived)\//u);
      if (image.url.startsWith('/assets/products/concepts/') || image.url.startsWith('/assets/products/generated/')) {
        assert.match(image.alt, /concept AI/u);
      } else if (image.url.startsWith('/assets/products/derived/')) {
        assert.match(image.alt, /cắt từ ảnh/iu);
        assert.match(image.alt, /chủ dự án cung cấp/iu);
      } else {
        assert.match(image.alt, /chủ dự án cung cấp/iu);
      }
    }
  }
  for (const slug of [
    'hu-tra',
    'bo-chen-doc-am',
    'binh-thien-nga',
    'binh-phu-quy',
    'binh-giot-ngoc',
    'binh-hoa-lam',
    'binh-ty-ba',
  ]) {
    assert.ok(products.find((product) => product.slug === slug).images.some((image) => image.url.startsWith('/assets/products/owner-provided/')), `${slug} includes its supplied product photo`);
  }
  assert.ok(products.find((product) => product.slug === 'lu-xong-tram-mini').images.every((image) => image.url.startsWith('/assets/products/concepts/')));
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
