import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import { AuditLog } from '../../src/models/operations/audit-log.model.js';
import { Notification } from '../../src/models/operations/notification.model.js';
import { Inventory } from '../../src/models/commerce/inventory.model.js';
import { Order } from '../../src/models/commerce/order.model.js';
import { User } from '../../src/models/identity/user.model.js';
import { Voucher } from '../../src/models/commerce/voucher.model.js';
import { ensureCommerceIndexes } from '../../src/models/commerce/indexes.js';
import { createCommerceService } from '../../src/services/commerce/commerce.service.js';
import { createShippingZoneQuotePort } from '../../src/services/commerce/shipping-zones.js';
import { createVoucherService } from '../../src/services/commerce/voucher.service.js';
import { createNotificationService } from '../../src/services/operations/notification.service.js';

const replicaSetUri = process.env.P05_TEST_REPLICA_SET_URI;
const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

function assertDedicatedLoopbackUri(value) {
  let uri;
  try { uri = new URL(value); } catch { throw new Error('P05_TEST_REPLICA_SET_URI must be a loopback MongoDB URI.'); }
  assert.equal(uri.protocol, 'mongodb:', 'voucher acceptance may only use local MongoDB');
  assert.ok(allowedHosts.has(uri.hostname), 'voucher acceptance may only use loopback MongoDB');
  assert.equal(uri.username, '', 'voucher acceptance must not use MongoDB credentials');
  assert.equal(uri.password, '', 'voucher acceptance must not use MongoDB credentials');
  const baseDatabase = uri.pathname.replace(/^\/+/u, '');
  assert.ok(baseDatabase === '' || baseDatabase === 'tro_lam_p05_ci_test', 'the URI may only name the local P05 CI database');
  assert.equal(uri.search, '', 'voucher acceptance does not accept URI options');
  assert.equal(uri.hash, '', 'voucher acceptance does not accept URI fragments');
}

async function assertDatabaseAbsent(uri, dbName) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const result = await client.db('admin').admin().listDatabases({ nameOnly: true });
    assert.equal(result.databases.some((database) => database.name === dbName), false, 'generated test database must not already exist');
  } finally {
    await client.close();
  }
}

test('P05 replica set: admin-issued voucher is private, server-priced, one-use, and restored only while valid', {
  skip: replicaSetUri ? false : 'Set P05_TEST_REPLICA_SET_URI to an unauthenticated loopback MongoDB replica-set URI.',
}, async () => {
  assertDedicatedLoopbackUri(replicaSetUri);
  const dbName = `tro_lam_p05_test_${randomBytes(6).toString('hex')}`;
  let connected = false;
  let ownsDatabase = false;
  let currentTime = new Date('2026-10-08T00:00:00.000Z');

  try {
    await assertDatabaseAbsent(replicaSetUri, dbName);
    ownsDatabase = true;
    await mongoose.connect(replicaSetUri, { dbName, serverSelectionTimeoutMS: 5000 });
    connected = true;

    await Promise.all([
      User.createIndexes(), AuditLog.createIndexes(), Notification.createIndexes(), ensureCommerceIndexes(),
    ]);

    const [admin, customer, anotherCustomer, inactiveCustomer] = await User.create([
      { name: 'Local Admin', emailNormalized: 'admin.voucher@example.test', passwordHash: 'test-only-hash', role: 'admin', status: 'active' },
      { name: 'Customer A', emailNormalized: 'customer.a@example.test', passwordHash: 'test-only-hash', role: 'customer', status: 'active' },
      { name: 'Customer B', emailNormalized: 'customer.b@example.test', passwordHash: 'test-only-hash', role: 'customer', status: 'active' },
      { name: 'Blocked Customer', emailNormalized: 'blocked@example.test', passwordHash: 'test-only-hash', role: 'customer', status: 'blocked' },
    ]);
    const adminActor = { id: String(admin._id), role: 'admin' };
    const customerActor = { id: String(customer._id), role: 'customer', user: { emailNormalized: customer.emailNormalized } };
    const notificationService = createNotificationService({ Notification, now: () => currentTime });
    const voucherService = createVoucherService({
      Voucher, User, notificationService, now: () => currentTime,
      auditPort: { async appendAudit(event, { session } = {}) { await AuditLog.create([event], { session }); } },
    });

    const issued = await voucherService.issue(adminActor, {
      email: '  CUSTOMER.A@EXAMPLE.TEST ', code: 'fixed50', title: 'Ưu đãi đơn đầu',
      discountType: 'fixed', discountValue: 50000, minSubtotalVnd: 100000,
      expiresAt: '2026-10-10T00:00:00.000Z',
    }, { requestId: 'voucher-test-issue-001' });
    assert.equal(issued.code, 'FIXED50');
    assert.equal(issued.customer.email, customer.emailNormalized);
    assert.equal((await voucherService.listMine(String(customer._id))).length, 1);
    assert.equal((await voucherService.listMine(String(anotherCustomer._id))).length, 0, 'wallet reads remain owner-scoped');
    assert.equal((await voucherService.listAdmin())[0].customer.email, customer.emailNormalized);
    assert.equal((await notificationService.list(String(customer._id), { category: 'promotion' })).items.length, 1);
    assert.equal((await notificationService.list(String(anotherCustomer._id), { category: 'promotion' })).items.length, 0);
    assert.equal(await AuditLog.countDocuments({ action: 'voucher.issue', actorId: admin._id }).exec(), 1);

    await assert.rejects(voucherService.issue(adminActor, {
      email: inactiveCustomer.emailNormalized, code: 'BLOCKED1', title: 'Blocked',
      discountType: 'fixed', discountValue: 1000, expiresAt: '2026-10-10T00:00:00.000Z',
    }, { requestId: 'voucher-test-inactive-001' }), { status: 404, code: 'CUSTOMER_NOT_FOUND' });
    await assert.rejects(voucherService.issue(adminActor, {
      email: customer.emailNormalized, code: 'FIXED50', title: 'Duplicate code',
      discountType: 'fixed', discountValue: 1000, expiresAt: '2026-10-10T00:00:00.000Z',
    }, { requestId: 'voucher-test-duplicate-001' }), { status: 409, code: 'VOUCHER_CODE_IN_USE' });
    const revocable = await voucherService.issue(adminActor, {
      email: customer.emailNormalized, code: 'REVOKE1', title: 'Can be revoked',
      discountType: 'fixed', discountValue: 5000, expiresAt: '2026-10-10T00:00:00.000Z',
    }, { requestId: 'voucher-test-revoke-issue-001' });
    assert.equal((await voucherService.revoke(adminActor, revocable.id, { requestId: 'voucher-test-revoke-001' })).status, 'revoked');
    assert.equal(await AuditLog.countDocuments({ action: 'voucher.revoke', actorId: admin._id }).exec(), 1);

    await voucherService.issue(adminActor, {
      email: customer.emailNormalized, code: 'PERCENT1', title: 'Phần trăm có trần',
      discountType: 'percent', discountValue: 50, maxDiscountVnd: 15000, minSubtotalVnd: 100000,
      expiresAt: '2026-10-10T00:00:00.000Z',
    }, { requestId: 'voucher-test-percent-001' });
    const percentageVoucher = (await voucherService.listMine(String(customer._id))).find((voucher) => voucher.code === 'PERCENT1');
    assert.equal((await voucherService.quote(String(customer._id), percentageVoucher.id, 175000)).discountVnd, 15000);

    await voucherService.issue(adminActor, {
      email: customer.emailNormalized, code: 'MINIMUM1', title: 'Đơn tối thiểu',
      discountType: 'fixed', discountValue: 10000, minSubtotalVnd: 200000,
      expiresAt: '2026-10-10T00:00:00.000Z',
    }, { requestId: 'voucher-test-minimum-001' });
    const minimumVoucher = (await voucherService.listMine(String(customer._id))).find((voucher) => voucher.code === 'MINIMUM1');
    await assert.rejects(voucherService.quote(String(customer._id), minimumVoucher.id, 175000), { status: 422, code: 'VOUCHER_MINIMUM_NOT_MET' });

    const productId = new mongoose.Types.ObjectId();
    const product = {
      _id: productId, status: 'published', saleMode: 'buy', sku: 'P05-VOUCHER-TEST',
      name: 'Voucher checkout fixture', priceVnd: 175000, images: [],
    };
    await Inventory.create({ productId, onHand: 1, reserved: 0, version: 0 });
    const commerceService = createCommerceService({
      ports: {
        catalog: { async getCheckoutProducts() { return [product]; } },
        settings: { async getBusinessSettings() {
          return { values: { shippingZones: [{ id: 'voucher-test-zone', provinceNames: ['Hải Dương'], feeVnd: 25000 }], codEnabled: true, checkoutLimits: { maxPendingCodOrders: 3 } } };
        } },
        shipping: createShippingZoneQuotePort(),
        payment: { async isConfigured() { return false; } },
        vouchers: voucherService,
        outbox: { async appendOutbox() {}, async enqueueMail() {}, async appendAudit() {} },
        clock: { now: () => currentTime },
      },
    });
    const checkout = {
      items: [{ productId: String(productId), quantity: 1 }],
      recipient: {
        recipientName: customer.name, email: customer.emailNormalized, phone: '0900000000',
        line1: '12 Đường Gốm', province: 'Hải Dương', countryCode: 'VN', formattedAddress: '12 Đường Gốm, Hải Dương',
      },
      paymentMethod: 'cod', voucherId: issued.id, consent: true,
    };
    const quote = await commerceService.quoteCheckout(customerActor, checkout);
    assert.equal(quote.subtotalVnd, 175000);
    assert.equal(quote.discountVnd, 50000);
    assert.equal(quote.shippingFeeVnd, 25000);
    assert.equal(quote.totalVnd, 150000, 'discount applies to item subtotal while shipping remains unchanged');

    const first = await commerceService.createOrder(customerActor, checkout, 'voucher-checkout-idempotency-key-001');
    const firstOrder = await Order.findById(first.order.id).exec();
    assert.equal(firstOrder.discountVnd, 50000);
    assert.equal(firstOrder.totalVnd, 150000);
    assert.equal(firstOrder.voucherSnapshot.code, 'FIXED50');
    assert.equal(firstOrder.voucherSnapshot.discountVnd, 50000);
    assert.equal((await voucherService.listMine(String(customer._id))).find((voucher) => voucher.code === 'FIXED50').status, 'redeemed');

    const firstCancellation = await commerceService.cancelOwnedOrder(customerActor, first.order.id, {
      expectedVersion: 0, reason: 'Khách đổi ý trước khi giao.',
    }, 'voucher-cancel-idempotency-key-first-001');
    assert.equal(firstCancellation.status, 'cancelled');
    const retainedSnapshot = await commerceService.getOwnedOrder(customerActor, first.order.id);
    assert.equal(retainedSnapshot.voucher.code, 'FIXED50', 'canceling does not rewrite the order snapshot');
    assert.equal((await voucherService.listMine(String(customer._id))).find((voucher) => voucher.code === 'FIXED50').status, 'available');

    const second = await commerceService.createOrder(customerActor, checkout, 'voucher-checkout-idempotency-key-002');
    currentTime = new Date('2026-10-11T00:00:00.000Z');
    await commerceService.cancelOwnedOrder(customerActor, second.order.id, {
      expectedVersion: 0, reason: 'Hủy sau khi voucher hết hạn.',
    }, 'voucher-cancel-idempotency-key-second-002');
    assert.equal((await voucherService.listMine(String(customer._id))).find((voucher) => voucher.code === 'FIXED50').status, 'expired');

    const racingVoucher = await voucherService.issue(adminActor, {
      email: customer.emailNormalized, code: 'RACE0001', title: 'Chỉ dùng một lần',
      discountType: 'fixed', discountValue: 10000, expiresAt: '2026-10-20T00:00:00.000Z',
    }, { requestId: 'voucher-test-race-001' });
    const redemptions = await Promise.allSettled([
      voucherService.redeem(String(customer._id), racingVoucher.id, new mongoose.Types.ObjectId(), 175000),
      voucherService.redeem(String(customer._id), racingVoucher.id, new mongoose.Types.ObjectId(), 175000),
    ]);
    assert.equal(redemptions.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal((await Voucher.findById(racingVoucher.id).lean().exec()).status, 'redeemed');
  } finally {
    if (connected) {
      if (ownsDatabase) await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
});
