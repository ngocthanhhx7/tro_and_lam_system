import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { Cart } from '../../src/models/account/cart.model.js';
import { Inventory } from '../../src/models/commerce/inventory.model.js';
import { Order } from '../../src/models/commerce/order.model.js';
import { ensureCommerceIndexes } from '../../src/models/commerce/indexes.js';
import { createAccountService } from '../../src/services/account/account.service.js';
import { createCommerceService } from '../../src/services/commerce/commerce.service.js';
import { createShippingZoneQuotePort } from '../../src/services/commerce/shipping-zones.js';
import { createVoucherService } from '../../src/services/commerce/voucher.service.js';
import { Voucher } from '../../src/models/commerce/voucher.model.js';
import { VoucherRedemption } from '../../src/models/commerce/voucher-redemption.model.js';

const uri = process.env.QUERY_TEST_REPLICA_SET_URI;
test('cart CAS and committed checkout quantities remain atomic, owner scoped and replay safe', { skip: !uri }, async () => {
  const target = new URL(uri);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
  assert.equal(target.username + target.password + target.search + target.hash, '');
  await mongoose.connect(uri, { dbName: `tro_lam_cart_checkout_${randomBytes(12).toString('hex')}` });
  try {
    await ensureCommerceIndexes();
    await Cart.createIndexes();
    const productId = new mongoose.Types.ObjectId();
    const otherProductId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    const products = [productId, otherProductId].map(id => ({ productId: String(id), _id: id, status: 'published', saleMode: 'buy', sku: `LOCAL-${id}`, name: 'Local fixture', priceVnd: 100000 }));
    const catalog = { async getCheckoutProducts(ids) { return products.filter(row => ids.includes(row.productId)); } };
    const account = createAccountService({ ports: { catalogService: catalog } });
    const actor = { id: String(userId), role: 'customer', user: { emailNormalized: 'local@example.test' } };
    let cart = await account.setCartItemQuantity(actor, String(productId), 5, 0);
    await account.setCartItemQuantity(actor, String(otherProductId), 2, cart.version);
    await account.setCartItemQuantity({ id: String(otherUserId) }, String(productId), 4, 0);
    await Inventory.create({ productId, onHand: 20, reserved: 0, version: 0 });
    let failOutbox = false;
    const vouchers = createVoucherService();
    const commerce = createCommerceService({ ports: {
      catalog, cart: account, vouchers,
      settings: { async getBusinessSettings() { return { values: { codEnabled: true, shippingZones: [{ id: 'local', provinceNames: ['*'], feeVnd: 0 }], checkoutLimits: { maxPendingCodOrders: 10 } } }; } },
      shipping: createShippingZoneQuotePort(), payment: { async isConfigured() { return true; } },
      identity: { async createGuestOrderProof() { return { token: randomBytes(32).toString('base64url'), expiresAt: new Date(Date.now() + 600000) }; } },
      outbox: { async appendOutbox() { if (failOutbox) throw new Error('Local rollback test'); }, async enqueueMail() {}, async appendAudit() {} },
    } });
    const input = { items: [{ productId: String(productId), quantity: 2 }], paymentMethod: 'cod', consent: true,
      recipient: { recipientName: 'Local test', email: 'local@example.test', phone: '0000000000', line1: 'Local fixture', province: 'Hà Nội', countryCode: 'VN', formattedAddress: 'Local fixture, Hà Nội' } };
    const result = await commerce.createOrder(actor, input, 'local-cart-checkout-success-key-123456');
    let saved = await account.getCart(actor);
    assert.deepEqual(saved.items.map(row => [row.productId, row.quantity]), [[String(productId), 3], [String(otherProductId), 2]]);
    const replay = await commerce.createOrder(actor, input, 'local-cart-checkout-success-key-123456');
    assert.equal(replay.order.id, result.order.id);
    assert.equal((await account.getCart(actor)).version, saved.version, 'replay must not deduct again');
    assert.equal((await account.getCart({ id: String(otherUserId) })).items[0].quantity, 4);
    const ordersBeforeFailure = await Order.countDocuments();
    failOutbox = true;
    await assert.rejects(commerce.createOrder(actor, input, 'local-cart-checkout-failed-key-123456'), /Local rollback test/);
    assert.deepEqual(await account.getCart(actor), saved);
    assert.equal(await Order.countDocuments(), ordersBeforeFailure);
    failOutbox = false;
    const guest = { kind: 'guest', guestTokenHash: randomBytes(32).toString('hex') };
    await account.setCartItemQuantity(guest, String(productId), 3, 0);
    const snapshot = await account.getGuestCartSnapshot(guest.guestTokenHash);
    const writes = await Promise.allSettled([4, 5].map(quantity => account.setCartItemQuantity(guest, String(productId), quantity, snapshot.version, { guestCartSnapshot: structuredClone(snapshot) })));
    assert.equal(writes.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(writes.filter(row => row.status === 'rejected' && row.reason.code === 'VERSION_CONFLICT').length, 1);
    const guestBefore = await account.getCart(guest);
    await commerce.createOrder(guest, input, 'local-guest-cart-checkout-key-123456');
    const guestAfter = await account.getCart(guest);
    assert.equal(guestAfter.items[0].quantity, guestBefore.items[0].quantity - 2);
    assert.deepEqual(await account.getCart(actor), saved, 'guest order must not change signed-in cart');
    const privateVoucher = await Voucher.create({ userId, createdBy: userId, code: 'LOCAL-PRIVATE', title: 'Local private', discountType: 'fixed', discountValue: 10000, expiresAt: new Date(Date.now() + 600000) });
    await assert.rejects(vouchers.resolvePublicCode(privateVoucher.code), { code: 'VOUCHER_NOT_AVAILABLE' });
    await assert.rejects(vouchers.quote(undefined, String(privateVoucher._id), 200000), { code: 'VOUCHER_NOT_AVAILABLE' });
    const promo = await vouchers.issue({ id: String(userId), role: 'admin' }, { scope: 'public', maxRedemptions: 1, code: 'LOCAL-PUBLIC', title: 'Local public', discountType: 'fixed', discountValue: 10000, minSubtotalVnd: 100000, expiresAt: new Date(Date.now() + 600000).toISOString() });
    assert.equal((await vouchers.resolvePublicCode(' local-public ')).id, promo.id);
    assert.equal((await vouchers.listMine(String(userId))).some(row => row.id === promo.id), false);
    const buyerGuests = [0, 1].map(() => ({ kind: 'guest', guestTokenHash: randomBytes(32).toString('hex') }));
    for (const buyer of buyerGuests) await account.setCartItemQuantity(buyer, String(productId), 3, 0);
    const discounted = { ...input, voucherId: promo.id };
    const beforeOrders = await Order.countDocuments();
    const purchases = await Promise.allSettled(buyerGuests.map((buyer, index) => commerce.createOrder(buyer, discounted, `local-public-voucher-race-key-${index}-123456`)));
    assert.equal(purchases.filter(row => row.status === 'fulfilled').length, 1, 'last public voucher use must be atomic');
    assert.equal(purchases.filter(row => row.status === 'rejected' && row.reason.code === 'VOUCHER_NOT_AVAILABLE').length, 1);
    assert.equal(await Order.countDocuments(), beforeOrders + 1);
    assert.equal((await Voucher.findById(promo.id)).redeemedCount, 1);
    assert.equal(await VoucherRedemption.countDocuments({ voucherId: promo.id }), 1);
    const winningIndex = purchases.findIndex(row => row.status === 'fulfilled');
    assert.equal((await account.getCart(buyerGuests[winningIndex])).items[0].quantity, 1);
    assert.equal((await account.getCart(buyerGuests[1 - winningIndex])).items[0].quantity, 3);
    const winnerOrder = purchases[winningIndex].value.order;
    assert.equal(winnerOrder.totalVnd, 190000);
    const progress = await commerce.getPublicOrderProgress(winnerOrder.code.toLowerCase());
    assert.deepEqual(Object.keys(progress).sort(), ['code', 'createdAt', 'history', 'status', 'updatedAt']);
    assert.deepEqual(Object.keys(progress.history[0]).sort(), ['at', 'status']);
    await assert.rejects(commerce.getPublicOrderProgress('TL-UNKNOWN123'), { status: 404 });
    const cancelKey = 'local-public-voucher-cancel-key-123456';
    await commerce.cancelOwnedOrder({ orderId: winnerOrder.id }, winnerOrder.id, { expectedVersion: 0, reason: 'Local cancellation' }, cancelKey);
    assert.equal((await Voucher.findById(promo.id)).redeemedCount, 0);
    await commerce.cancelOwnedOrder({ orderId: winnerOrder.id }, winnerOrder.id, { expectedVersion: 0, reason: 'Local cancellation' }, cancelKey);
    assert.equal((await Voucher.findById(promo.id)).redeemedCount, 0, 'cancellation replay must restore usage once');
  } finally { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
});
