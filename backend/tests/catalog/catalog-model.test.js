import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { CatalogProduct } from '../../src/models/catalog/product.model.js';

function product(overrides = {}) {
  return new CatalogProduct({
    slug: 'model-fixture',
    sku: 'MODEL-FIXTURE',
    name: 'Model fixture',
    line: 'lifestyle',
    categoryId: new mongoose.Types.ObjectId(),
    saleMode: 'buy',
    priceVnd: 120_000,
    ...overrides,
  });
}

test('product pre-validation accepts direct-sale VND and rejects a missing or invalid price', async () => {
  await assert.doesNotReject(() => product().validate());

  const zeroPrice = await product({ priceVnd: 0 }).validate().then(
    () => null,
    (error) => error,
  );
  assert.ok(zeroPrice?.errors?.priceVnd);

  const fractionalPrice = await product({ priceVnd: 120_000.5 }).validate().then(
    () => null,
    (error) => error,
  );
  assert.ok(fractionalPrice?.errors?.priceVnd);
  assert.match(fractionalPrice.errors.priceVnd.message, /giá VND nguyên lớn hơn 0/u);
});

test('quote-only product may omit a direct-sale price', async () => {
  await assert.doesNotReject(() => product({ saleMode: 'quote', priceVnd: undefined }).validate());
});
