import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { CommerceRepository } from '../../src/services/commerce/commerce.repository.js';
import { createCommerceService } from '../../src/services/commerce/commerce.service.js';
import { ensureCommerceIndexes } from '../../src/models/commerce/indexes.js';
import { Inventory } from '../../src/models/commerce/inventory.model.js';
import { Order } from '../../src/models/commerce/order.model.js';
import { StockReservation } from '../../src/models/commerce/stock-reservation.model.js';
import { IdempotencyRecord } from '../../src/models/commerce/idempotency-record.model.js';
import { assertPendingGuestCodAttribution, backfillPendingGuestCodKeys } from '../../src/services/commerce/cod-quota-migration.js';

const uri = process.env.P05_TEST_REPLICA_SET_URI;
const options = { skip: !uri && 'Requires a dedicated loopback MongoDB replica set.' };

async function fixture(work) {
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\//u, 'Only loopback test MongoDB is permitted');
  await mongoose.connect(uri, { dbName: `tro_lam_cod_security_${randomUUID().replaceAll('-', '')}`, serverSelectionTimeoutMS: 5000 });
  try {
    await ensureCommerceIndexes();
    const ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    await Inventory.insertMany(ids.map(productId => ({ productId, onHand: 10, reserved: 0, version: 0 })));
    const repository = new CommerceRepository();
    const service = createCommerceService({ ports: {
      repository,
      catalog: { async getCheckoutProducts(values) { return values.map(_id => ({ _id, status: 'published', saleMode: 'buy', sku: `TEST-${_id}`, name: 'Synthetic quota fixture', priceVnd: 100000, images: [] })); } },
      settings: { async getBusinessSettings() { return { values: { shippingZones: [{ id: 'test', provinceNames: ['*'], feeVnd: 25000 }], codEnabled: true, checkoutLimits: { maxPendingCodOrders: 1 } } }; } },
      shipping: { async quoteFeeVnd() { return 25000; } },
      payment: { async isConfigured() { return false; } },
      identity: { async createGuestOrderProof() { return { token: randomUUID(), expiresAt: new Date(Date.now() + 3600000) }; } },
      outbox: { async appendOutbox() {}, async appendAudit() {}, async enqueueMail() {} },
    } });
    const create = (actor, email, index = 0, key = randomUUID()) => service.createOrder(actor, {
      items: [{ productId: String(ids[index]), quantity: 1 }],
      recipient: { recipientName: 'Synthetic Recipient', email, phone: '0900000000', line1: 'Test only', province: 'Test', countryCode: 'VN', formattedAddress: 'Test only' },
      paymentMethod: 'cod', consent: true,
    }, key);
    await work({ create, repository });
  } finally { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
}

test('COD cap serializes concurrent same-email guests with disjoint inventory', options, async () => fixture(async ({ create, repository }) => {
  // On the old path, barrier both zero counts to expose snapshot write skew.
  const original = repository.countPendingCodOrders.bind(repository);
  const hasGuard = typeof repository.lockPendingCodScopes === 'function';
  let release;
  let reached = 0;
  const barrier = new Promise(resolve => { release = resolve; });
  repository.countPendingCodOrders = async (...args) => {
    const count = await original(...args);
    if (!hasGuard) { if (++reached === 2) release(); await barrier; }
    return count;
  };
  const results = await Promise.allSettled([
    create({ kind: 'guest', guestTokenHash: 'a'.repeat(64) }, 'same@example.test', 0),
    create({ kind: 'guest', guestTokenHash: 'b'.repeat(64) }, 'same@example.test', 1),
  ]);
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(await Order.countDocuments({}), 1);
  assert.equal(await StockReservation.countDocuments({ status: 'held' }), 1);
  assert.equal((await Inventory.find({}).lean()).reduce((sum, row) => sum + row.reserved, 0), 1);
}));

test('guest email rotation cannot reset COD cap; replay and cancellation remain valid', options, async () => fixture(async ({ create }) => {
  const actor = { kind: 'guest', guestTokenHash: 'c'.repeat(64) };
  const key = randomUUID();
  const first = await create(actor, 'first@example.test', 0, key);
  await assert.rejects(create(actor, 'second@example.test', 1), { code: 'CHECKOUT_NOT_ALLOWED' });
  const replay = await create(actor, 'first@example.test', 0, key);
  assert.equal(String(replay.order.id), String(first.order.id));
  assert.equal(replay.replay, true);
  // A cancelled order must stop consuming quota; normal cancellation owns release.
  await Order.updateOne({ _id: first.order.id }, { $set: { status: 'cancelled' } });
  await create(actor, 'second@example.test', 1);
  assert.equal(await Order.countDocuments({ status: 'pending' }), 1);
}));

for (const authenticated of [false, true]) {
  test(`COD actor cap survives concurrent email rotation (${authenticated ? 'user' : 'guest'})`, options, async () => fixture(async ({ create }) => {
    const actor = authenticated ? { id: String(new mongoose.Types.ObjectId()), role: 'customer' }
      : { kind: 'guest', guestTokenHash: 'd'.repeat(64) };
    const results = await Promise.allSettled([
      create(actor, 'left@example.test', 0), create(actor, 'right@example.test', 1),
    ]);
    assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(results.filter(row => row.status === 'rejected' && row.reason.code === 'CHECKOUT_NOT_ALLOWED').length, 1);
    assert.equal(await Order.countDocuments({}), 1);
  }));
}

test('separate COD identities retain capacity; private quota keys stay out of DTOs', options, async () => fixture(async ({ create }) => {
  const left = await create({ kind: 'guest', guestTokenHash: 'e'.repeat(64) }, 'left@example.test', 0);
  await create({ kind: 'guest', guestTokenHash: 'f'.repeat(64) }, 'right@example.test', 1);
  assert.equal(await Order.countDocuments({}), 2);
  const order = await Order.findById(left.order.id).lean();
  assert.equal(Object.hasOwn(order, 'guestCheckoutKeyHash'), false);
  assert.equal(JSON.stringify(left).includes('guestCheckoutKeyHash'), false);
}));

test('legacy COD attribution is dry by default and blocks rotated email after backfill', options, async () => fixture(async ({ create }) => {
  const actor = { kind: 'guest', guestTokenHash: '1'.repeat(64) };
  const first = await create(actor, 'old@example.test');
  await Order.updateOne({ _id: first.order.id }, { $unset: { guestCheckoutKeyHash: 1 } });
  assert.deepEqual(await backfillPendingGuestCodKeys(), { legacy: 1, attributable: 1, unresolved: 0, updated: 0 });
  assert.equal(await Order.countDocuments({ guestCheckoutKeyHash: { $exists: false } }), 1);
  await assert.rejects(assertPendingGuestCodAttribution(), /before activation/u);
  assert.deepEqual(await backfillPendingGuestCodKeys({ apply: true }), { legacy: 1, attributable: 1, unresolved: 0, updated: 1 });
  await assert.doesNotReject(assertPendingGuestCodAttribution());
  await assert.rejects(create(actor, 'new@example.test', 1), { code: 'CHECKOUT_NOT_ALLOWED' });
}));

test('legacy COD migration refuses missing attribution without modifying orders', options, async () => fixture(async ({ create }) => {
  const first = await create({ kind: 'guest', guestTokenHash: '2'.repeat(64) }, 'old@example.test');
  await Order.updateOne({ _id: first.order.id }, { $unset: { guestCheckoutKeyHash: 1 } });
  await IdempotencyRecord.deleteMany({});
  assert.deepEqual(await backfillPendingGuestCodKeys({ apply: true }), { legacy: 1, attributable: 0, unresolved: 1, updated: 0 });
  assert.equal(await Order.countDocuments({ guestCheckoutKeyHash: { $exists: false } }), 1);
}));
