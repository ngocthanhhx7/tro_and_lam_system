import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { Inventory } from '../../src/models/commerce/inventory.model.js';
import { StockReservation } from '../../src/models/commerce/stock-reservation.model.js';
import { Order } from '../../src/models/commerce/order.model.js';
import { ensureCommerceIndexes } from '../../src/models/commerce/indexes.js';
import { CommerceRepository } from '../../src/services/commerce/commerce.repository.js';
import { createCommerceService } from '../../src/services/commerce/commerce.service.js';

const replicaSetUri = process.env.P05_TEST_REPLICA_SET_URI;

test('replica set: competing checkouts reserve the final unit only once', {
  skip: replicaSetUri ? false : 'Set P05_TEST_REPLICA_SET_URI to a dedicated MongoDB replica-set test URI.',
}, async () => {
  const dbName = `tro_lam_p05_${randomUUID().replaceAll('-', '')}`;
  const productId = new mongoose.Types.ObjectId();
  const customerA = new mongoose.Types.ObjectId();
  const customerB = new mongoose.Types.ObjectId();
  const product = {
    _id: productId, status: 'published', saleMode: 'buy', sku: 'P05-RACE-TEST',
    name: 'Replica set concurrency fixture', priceVnd: 175000, images: [],
  };
  let connected = false;
  try {
    await mongoose.connect(replicaSetUri, { dbName, serverSelectionTimeoutMS: 5000 });
    connected = true;
    await ensureCommerceIndexes();
    await Inventory.create({ productId, onHand: 1, reserved: 0, version: 0 });
    const service = createCommerceService({
      ports: {
        repository: new CommerceRepository(),
        catalog: { async getCheckoutProducts(ids) { return ids.map(() => product); } },
        settings: { async getBusinessSettings() {
          return { values: { shippingZones: [{ id: 'replica-test-zone' }], codEnabled: true, checkoutLimits: { maxPendingCodOrders: 3 } } };
        } },
        shipping: { async quoteFeeVnd() { return 25000; } },
        payment: { async isConfigured() { return false; } },
        outbox: {
          async appendOutbox() {}, async appendAudit() {}, async enqueueMail() {},
        },
        clock: { now: () => new Date('2026-10-06T00:00:00.000Z') },
      },
    });
    const recipient = {
      recipientName: 'Kiểm thử replica', email: 'replica@example.com', phone: '0900000000',
      line1: '12 Đường Gốm', countryCode: 'VN', formattedAddress: '12 Đường Gốm, Hải Dương',
    };
    const createInput = () => ({ items: [{ productId: String(productId), quantity: 1 }], recipient, paymentMethod: 'cod', consent: true });
    const results = await Promise.allSettled([
      service.createOrder({ id: String(customerA), role: 'customer', user: { emailNormalized: 'replica@example.com' } }, createInput(), 'replica-set-race-checkout-key-a-123456'),
      service.createOrder({ id: String(customerB), role: 'customer', user: { emailNormalized: 'replica@example.com' } }, createInput(), 'replica-set-race-checkout-key-b-123456'),
    ]);

    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected' && result.reason.code === 'OUT_OF_STOCK').length, 1);
    const [inventory] = await Inventory.find({ productId }).lean().exec();
    assert.equal(inventory.onHand, 1);
    assert.equal(inventory.reserved, 1);
    assert.equal(await Order.countDocuments({}).exec(), 1);
    assert.equal(await StockReservation.countDocuments({ status: 'held' }).exec(), 1);
  } finally {
    if (connected) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
});
