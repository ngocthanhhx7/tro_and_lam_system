import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommerceService } from '../../src/services/commerce/commerce.service.js';

const PRODUCT_A = '507f1f77bcf86cd799439011';
const PRODUCT_B = '507f1f77bcf86cd799439012';
const USER_ID = '507f1f77bcf86cd799439099';

class MemoryCommerceRepository {
  constructor({ stock = {} } = {}) {
    this.counter = 100;
    this.orders = new Map();
    this.reservations = new Map();
    this.codCollections = new Map();
    this.inventory = new Map(Object.entries(stock).map(([id, onHand]) => [id, { productId: id, onHand, reserved: 0, version: 0 }]));
    this.movements = [];
    this.idempotency = new Map();
    this.challenges = new Map();
    this.tail = Promise.resolve();
    this.models = {
      Order: {
        updateOne: (filter, update) => ({ exec: async () => {
          const order = this.orders.get(String(filter._id));
          if (order) Object.assign(order, update.$set);
          return { modifiedCount: order ? 1 : 0 };
        } }),
        findOneAndUpdate: (filter, update) => ({ exec: async () => {
          const order = this.orders.get(String(filter._id));
          if (!order || (filter.userId === null && order.userId)
            || (filter.version !== undefined && order.version !== filter.version)
            || (filter['recipientSnapshot.email'] && order.recipientSnapshot.email !== filter['recipientSnapshot.email'])) return null;
          Object.assign(order, structuredClone(update.$set ?? {}));
          for (const key of Object.keys(update.$unset ?? {})) delete order[key];
          order.version += update.$inc?.version ?? 0;
          return structuredClone(order);
        } }),
      },
      StockReservation: {
        findOne: (filter) => {
          const query = {
            session: () => query,
            exec: async () => {
              const reservation = filter.orderId
                ? this.reservations.get(String(filter.orderId))
                : [...this.reservations.values()].find((item) => String(item._id) === String(filter._id));
              if (!reservation || (filter.status && reservation.status !== filter.status)
                || (filter.expiresAt?.$lte && new Date(reservation.expiresAt) > filter.expiresAt.$lte)) return null;
              return structuredClone(reservation);
            },
          };
          return query;
        },
        find: (filter) => {
          let max = 500;
          const query = {
            sort: () => query,
            limit: (value) => { max = value; return query; },
            lean: () => query,
            exec: async () => [...this.reservations.values()]
              .filter((item) => item.status === filter.status && item.expiresAt && new Date(item.expiresAt) <= filter.expiresAt.$lte)
              .slice(0, max).map((item) => structuredClone(item)),
          };
          return query;
        },
        updateOne: (filter, update) => ({ exec: async () => {
          const reservation = this.reservations.get(String(filter.orderId ?? [...this.reservations.values()].find((item) => String(item._id) === String(filter._id))?.orderId));
          if (reservation && reservation.status === filter.status
            && (!filter.expiresAt?.$lte || new Date(reservation.expiresAt) <= filter.expiresAt.$lte)) {
            if (update.$unset?.expiresAt) delete reservation.expiresAt;
            reservation.version += update.$inc?.version ?? 0;
            return { modifiedCount: 1 };
          }
          return { modifiedCount: 0 };
        } }),
      },
      Inventory: {
        findOneAndUpdate: (filter, update) => ({ exec: async () => {
          const inventory = this.inventory.get(String(filter.productId));
          const onHandDelta = update.$inc.onHand;
          if (!inventory || inventory.onHand + onHandDelta < inventory.reserved) return null;
          inventory.onHand += onHandDelta;
          inventory.version += update.$inc.version;
          return structuredClone(inventory);
        } }),
      },
      InventoryMovement: {
        create: async (rows) => {
          for (const row of rows) {
            if (this.movements.some((movement) => movement.eventKey === row.eventKey)) {
              throw Object.assign(new Error('Duplicate inventory movement'), { code: 11000 });
            }
            this.movements.push(structuredClone(row));
          }
          return rows;
        },
      },
    };
  }

  newId() { this.counter += 1; return `507f1f77bcf86cd79944${String(this.counter).padStart(4, '0')}`; }

  async transaction(callback) {
    const run = async () => {
      const state = structuredClone({
        orders: [...this.orders], reservations: [...this.reservations], codCollections: [...this.codCollections], inventory: [...this.inventory], movements: structuredClone(this.movements),
        idempotency: [...this.idempotency], challenges: [...this.challenges], counter: this.counter,
      });
      const session = { effects: { outbox: [], mails: [], audit: [], proofs: [], revokedProofs: [] } };
      try {
        const result = await callback(session);
        this.committedEffects ??= { outbox: [], mails: [], audit: [], proofs: [], revokedProofs: [] };
        for (const key of Object.keys(session.effects)) this.committedEffects[key].push(...session.effects[key]);
        return result;
      } catch (error) {
        this.orders = new Map(state.orders);
        this.reservations = new Map(state.reservations);
        this.codCollections = new Map(state.codCollections);
        this.inventory = new Map(state.inventory);
        this.movements = state.movements;
        this.idempotency = new Map(state.idempotency);
        this.challenges = new Map(state.challenges);
        this.counter = state.counter;
        throw error;
      }
    };
    const pending = this.tail.then(run, run);
    this.tail = pending.then(() => undefined, () => undefined);
    return pending;
  }

  async createOrder(order) {
    const value = structuredClone({ ...order, _id: order._id ?? this.newId(), createdAt: new Date('2026-10-06T00:00:00Z') });
    this.orders.set(String(value._id), value);
    return value;
  }
  async findOrderById(id) { return this.orders.get(String(id)) ?? null; }
  async findOrderByCodeAndEmail(code, email) {
    return [...this.orders.values()].find((order) => order.code === code && order.recipientSnapshot.email === email) ?? null;
  }
  async findOrderByCode(code) { return [...this.orders.values()].find((order) => order.code === code) ?? null; }
  async findOwnedOrder(actorId, id) {
    const order = this.orders.get(String(id));
    return order?.userId && String(order.userId) === String(actorId) ? order : null;
  }
  async listOwnedOrders(actorId, { status }) {
    const items = [...this.orders.values()].filter((order) => String(order.userId) === String(actorId) && (!status || order.status === status));
    return { items, total: items.length };
  }
  async listStaffOrders() { return { items: [...this.orders.values()], total: this.orders.size }; }
  async findStaffOrder(id) { return this.orders.get(String(id)) ?? null; }
  async updateOrder(id, expectedVersion, changes) {
    const order = this.orders.get(String(id));
    if (!order || order.version !== expectedVersion) return null;
    Object.assign(order, structuredClone(changes), { version: order.version + 1 });
    return order;
  }
  async insertIdempotency(record) {
    const value = { ...structuredClone(record), _id: this.newId() };
    const key = `${value.scope}:${value.actorKey}:${value.keyHash}`;
    this.idempotency.set(key, value);
    return value;
  }
  async findIdempotency({ scope, actorKey, keyHash }) { return this.idempotency.get(`${scope}:${actorKey}:${keyHash}`) ?? null; }
  async finishIdempotency(id, changes) {
    const record = [...this.idempotency.values()].find((item) => item._id === id);
    if (!record) return null;
    Object.assign(record, structuredClone(changes), { state: 'succeeded' });
    return record;
  }
  async getAvailability(ids) {
    return ids.map((productId) => {
      const item = this.inventory.get(String(productId));
      return { productId: String(productId), available: item ? item.onHand - item.reserved : 0 };
    });
  }
  async reserve(items, orderId, { expiresAt } = {}) {
    for (const item of items) {
      const stock = this.inventory.get(String(item.productId));
      if (!stock || stock.onHand - stock.reserved < item.quantity) {
        throw Object.assign(new Error('Out of stock'), { code: 'OUT_OF_STOCK' });
      }
    }
    for (const item of items) this.inventory.get(String(item.productId)).reserved += item.quantity;
    const value = { _id: this.newId(), orderId, items: structuredClone(items), status: 'held', expiresAt, version: 0 };
    this.reservations.set(String(orderId), value);
    return value;
  }
  async release(orderId) {
    const reservation = this.reservations.get(String(orderId));
    if (!reservation || reservation.status !== 'held') return false;
    for (const item of reservation.items) this.inventory.get(String(item.productId)).reserved -= item.quantity;
    reservation.status = 'released';
    return true;
  }
  async commitShipment(orderId) {
    const reservation = this.reservations.get(String(orderId));
    if (!reservation || reservation.status !== 'held') return false;
    for (const item of reservation.items) {
      const stock = this.inventory.get(String(item.productId));
      stock.onHand -= item.quantity;
      stock.reserved -= item.quantity;
    }
    reservation.status = 'committed';
    return true;
  }
  async findCodCollectionByIdempotencyKey(key) {
    return this.codCollections.get(key) ?? null;
  }
  async createCodCollection(record) {
    if (this.codCollections.has(record.idempotencyKey)) throw Object.assign(new Error('Duplicate COD key'), { code: 11000 });
    const value = structuredClone({ ...record, _id: this.newId() });
    this.codCollections.set(value.idempotencyKey, value);
    return value;
  }
  async countPendingCodOrders(actor, email) {
    return [...this.orders.values()].filter((order) => order.paymentMethod === 'cod' && order.paymentStatus === 'pending'
      && (actor?.id ? String(order.userId) === String(actor.id) : order.recipientSnapshot.email === email)).length;
  }
  async createOrderAccessChallenge(challenge) {
    const value = { ...structuredClone(challenge), _id: this.newId() };
    this.challenges.set(value.challengeIdHash, value);
    return value;
  }
  async findOrderAccessChallenge(idHash) { return this.challenges.get(idHash) ?? null; }
  async incrementOrderAccessAttempts(id) {
    const value = [...this.challenges.values()].find((item) => item._id === id);
    if (value && value.attempts < 5) value.attempts += 1;
    return value ? { modifiedCount: 1 } : { modifiedCount: 0 };
  }
  async consumeOrderAccessChallenge(id, now) {
    const value = [...this.challenges.values()].find((item) => item._id === id);
    if (!value || value.consumedAt || value.expiresAt <= now || value.attempts >= 5) return false;
    value.consumedAt = now;
    return true;
  }
}

const checkoutInput = (items = [{ productId: PRODUCT_A, quantity: 1 }]) => ({
  items,
  recipient: {
    recipientName: 'Nguyễn An', email: 'an@example.com', phone: '0900000000',
    line1: '12 Đường Gốm', countryCode: 'VN', formattedAddress: '12 Đường Gốm, Hải Dương',
  },
  paymentMethod: 'cod', consent: true,
});

function serviceFixture({ stock = { [PRODUCT_A]: 1, [PRODUCT_B]: 1 }, settings, paymentConfigured = false, paymentExpiry, refunds, address } = {}) {
  const repository = new MemoryCommerceRepository({ stock });
  const proofCalls = [];
  const ports = {
    repository,
    clock: { now: () => new Date('2026-10-06T00:00:00Z') },
    catalog: { async getCheckoutProducts(ids) {
      return ids.map((id) => ({
        _id: id, status: 'published', saleMode: 'buy', sku: `SKU-${id.slice(-2)}`,
        name: 'Gốm Chu Đậu', priceVnd: 175000, images: [{ url: '/assets/ceramic.webp', alt: 'Gốm', sortOrder: 0 }],
      }));
    } },
    settings: { async getBusinessSettings() {
      return { values: settings ?? { shippingZones: [{ id: 'approved-zone' }], codEnabled: true, checkoutLimits: { maxPendingCodOrders: 3 } } };
    } },
    shipping: { async quoteFeeVnd() { return 25000; } },
    payment: {
      async isConfigured() { return paymentConfigured; },
      ...(paymentExpiry ? { async getReservationExpiryStatus(order) { return paymentExpiry(order); } } : {}),
    },
    outbox: {
      async appendOutbox(event, { session }) { session.effects.outbox.push(structuredClone(event)); },
      async appendAudit(event, { session }) { session.effects.audit.push(structuredClone(event)); },
      async enqueueMail(template, recipient, data, { session }) { session.effects.mails.push({ template, recipient, data: structuredClone(data) }); },
    },
    identity: {
      async createGuestOrderProof({ orderId, identityVerifiedAt, session }) {
        const proof = { orderId: String(orderId), identityVerifiedAt, token: `guest-secret-${proofCalls.length + 1}`, expiresAt: new Date('2026-10-06T01:00:00Z') };
        proofCalls.push(proof);
        session.effects.proofs.push(proof);
        return proof;
      },
      async revokeGuestOrderProofs(orderId, { session }) { session.effects.revokedProofs.push(String(orderId)); },
    },
    ...(refunds ? { refunds } : {}),
    ...(address ? { address } : {}),
  };
  return { service: createCommerceService({ ports }), repository, proofCalls };
}

test('checkout calculates VND from catalog and snapshots recipient and product data', async () => {
  const { service, repository } = serviceFixture();
  const actor = { id: USER_ID, role: 'customer', status: 'active', user: { emailNormalized: 'an@example.com' } };
  const orderResult = await service.createOrder(actor, checkoutInput(), 'a'.repeat(32));
  const order = repository.orders.get(orderResult.order.id);

  assert.equal(orderResult.order.totalVnd, 200000);
  assert.equal(order.subtotalVnd, 175000);
  assert.equal(order.shippingFeeVnd, 25000);
  assert.equal(order.recipientSnapshot.recipientName, 'Nguyễn An');
  assert.equal(order.itemsSnapshot[0].unitPriceVnd, 175000);
  assert.equal(order.paymentStatus, 'pending');
  assert.equal(repository.inventory.get(PRODUCT_A).reserved, 1);
  assert.equal(orderResult.payment.status, 'pending');
  const createdEvent = repository.committedEffects.outbox.find((event) => event.type === 'order.created');
  assert.equal(createdEvent.aggregateVersion, 0);
  assert.equal(Object.hasOwn(createdEvent, 'eventType'), false);
});

test('checkout copies only an account-owned address into an immutable order snapshot', async () => {
  const ADDRESS_ID = '507f1f77bcf86cd799439015';
  const address = {
    _id: ADDRESS_ID, recipientName: 'Nguyễn An', phone: '0900000000', line1: '12 Đường Gốm',
    countryCode: 'VN', formattedAddress: '12 Đường Gốm, Hải Dương',
  };
  const actorCalls = [];
  const { service, repository } = serviceFixture({
    address: { async getOwnedAddress(actorId, addressId) {
      actorCalls.push({ actorId, addressId });
      return String(address._id) === addressId ? address : null;
    } },
  });
  const actor = { id: USER_ID, role: 'customer', user: { emailNormalized: 'an@example.com' } };
  const result = await service.createOrder(actor, {
    items: [{ productId: PRODUCT_A, quantity: 1 }], addressId: ADDRESS_ID, paymentMethod: 'cod', consent: true,
  }, 'owned-address-snapshot-checkout-key-123456');
  address.line1 = 'Số 99, nơi khác';
  address.formattedAddress = 'Địa chỉ đã sửa';

  assert.deepEqual(actorCalls, [{ actorId: USER_ID, addressId: ADDRESS_ID }]);
  assert.equal(repository.orders.get(result.order.id).recipientSnapshot.line1, '12 Đường Gốm');
  assert.equal(repository.orders.get(result.order.id).recipientSnapshot.formattedAddress, '12 Đường Gốm, Hải Dương');
  await assert.rejects(service.createOrder(actor, {
    items: [{ productId: PRODUCT_B, quantity: 1 }], addressId: PRODUCT_B, paymentMethod: 'cod', consent: true,
  }, 'other-users-address-checkout-key-123456'), (error) => error.code === 'NOT_FOUND');
});

test('checkout idempotency replays one order and rejects the same key with changed payload', async () => {
  const { service, repository } = serviceFixture();
  const actor = { id: USER_ID, role: 'customer', status: 'active', user: { emailNormalized: 'an@example.com' } };
  const key = 'idempotency-key-with-more-than-128-bits';
  const first = await service.createOrder(actor, checkoutInput(), key);
  const replay = await service.createOrder(actor, checkoutInput(), key);
  assert.equal(first.order.id, replay.order.id);
  assert.equal(replay.replay, true);
  assert.equal(repository.orders.size, 1);
  await assert.rejects(
    service.createOrder(actor, { ...checkoutInput(), note: 'Thay đổi' }, key),
    (error) => error.code === 'IDEMPOTENCY_CONFLICT' && error.status === 409,
  );
});

test('pending COD limit blocks additional inventory holds for the same owner', async () => {
  const { service, repository } = serviceFixture({
    stock: { [PRODUCT_A]: 3 },
    settings: { shippingZones: [{ id: 'approved-zone' }], codEnabled: true, checkoutLimits: { maxPendingCodOrders: 1 } },
  });
  const actor = { id: USER_ID, role: 'customer', status: 'active', user: { emailNormalized: 'an@example.com' } };
  await service.createOrder(actor, checkoutInput(), 'cod-limit-first-checkout-key-12345');

  await assert.rejects(
    service.createOrder(actor, checkoutInput(), 'cod-limit-second-checkout-key-12345'),
    (error) => error.code === 'CHECKOUT_NOT_ALLOWED' && error.status === 422,
  );
  assert.equal(repository.orders.size, 1);
  assert.equal(repository.reservations.size, 1);
  assert.equal(repository.inventory.get(PRODUCT_A).reserved, 1);
});

test('order detail is restricted to the authenticated owner or the exact guest proof scope', async () => {
  const { service } = serviceFixture();
  const customer = { id: USER_ID, role: 'customer', status: 'active', user: { emailNormalized: 'an@example.com' } };
  const created = await service.createOrder(customer, checkoutInput(), 'order-ownership-create-key-123456');
  const orderId = created.order.id;

  assert.equal((await service.getOwnedOrder(customer, orderId)).id, orderId);
  await assert.rejects(service.getOwnedOrder({ id: PRODUCT_B, role: 'customer' }, orderId), (error) => error.code === 'NOT_FOUND');
  await assert.rejects(service.getOwnedOrder({ actorKey: 'guest-cookie-actor-key-123456' }, orderId), (error) => error.code === 'NOT_FOUND');
  await assert.rejects(service.getOwnedOrder({ orderId: PRODUCT_B }, orderId), (error) => error.code === 'NOT_FOUND');
});

test('multi-item checkout shortage rolls back every reservation and the order', async () => {
  const { service, repository } = serviceFixture({ stock: { [PRODUCT_A]: 2, [PRODUCT_B]: 0 } });
  const actor = { id: USER_ID, role: 'customer', status: 'active', user: { emailNormalized: 'an@example.com' } };
  await assert.rejects(
    service.createOrder(actor, checkoutInput([{ productId: PRODUCT_A, quantity: 1 }, { productId: PRODUCT_B, quantity: 1 }]), 'multi-item-checkout-key-12345'),
    (error) => error.code === 'OUT_OF_STOCK' && error.status === 409,
  );
  assert.equal(repository.inventory.get(PRODUCT_A).reserved, 0);
  assert.equal(repository.orders.size, 0);
  assert.equal(repository.reservations.size, 0);
});

test('two checkouts competing for the last unit create one held reservation', async () => {
  const { service, repository } = serviceFixture({ stock: { [PRODUCT_A]: 1 } });
  const actor = { id: USER_ID, role: 'customer', status: 'active', user: { emailNormalized: 'an@example.com' } };
  const results = await Promise.allSettled([
    service.createOrder(actor, checkoutInput(), 'checkout-race-key-1234567890-a'),
    service.createOrder(actor, checkoutInput(), 'checkout-race-key-1234567890-b'),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected' && result.reason.code === 'OUT_OF_STOCK').length, 1);
  assert.equal(repository.inventory.get(PRODUCT_A).reserved, 1);
  assert.equal(repository.orders.size, 1);
});

test('customer cancellation is idempotent and releases its reservation once', async () => {
  const { service, repository } = serviceFixture();
  const actor = { id: USER_ID, role: 'customer', status: 'active', user: { emailNormalized: 'an@example.com' } };
  const created = await service.createOrder(actor, checkoutInput(), 'cancel-order-create-key-123456');
  const orderId = created.order.id;
  const cancelInput = { reason: 'Khách đổi ý', expectedVersion: 0 };
  const cancelled = await service.cancelOwnedOrder(actor, orderId, cancelInput, 'cancel-order-operation-key-123456');
  const replay = await service.cancelOwnedOrder(actor, orderId, cancelInput, 'cancel-order-operation-key-123456');

  assert.equal(cancelled.status, 'cancelled');
  assert.equal(replay.status, 'cancelled');
  assert.equal(repository.inventory.get(PRODUCT_A).reserved, 0);
  assert.equal(repository.reservations.get(orderId).status, 'released');
  assert.equal(repository.committedEffects.outbox.filter((event) => event.type === 'order.cancelled').length, 1);
});

test('paid staff cancellation fails closed until P06 can open a refund request', async () => {
  const { service, repository } = serviceFixture();
  const staff = { id: USER_ID, role: 'staff' };
  const order = await repository.createOrder({
    _id: repository.newId(), code: 'TL-PAID-CANCEL-TEST', userId: USER_ID,
    recipientSnapshot: { email: 'an@example.com' }, itemsSnapshot: [{ productId: PRODUCT_A, quantity: 1 }],
    subtotalVnd: 175000, shippingFeeVnd: 25000, discountVnd: 0, totalVnd: 200000,
    status: 'processing', paymentMethod: 'cod', paymentStatus: 'paid', paidAmountVnd: 200000,
    refundedAmountVnd: 0, reservationId: repository.newId(), statusHistory: [], version: 0,
  });
  await assert.rejects(service.transitionOrder(staff, order._id, {
    toStatus: 'cancelled', expectedVersion: 0, reason: 'Hủy sau khi đã thu tiền',
  }, 'paid-cancel-operation-key-123456'), (error) => error.code === 'DATABASE_UNAVAILABLE');
  assert.equal(repository.orders.get(String(order._id)).status, 'processing');
  assert.equal(repository.idempotency.size, 0);
});

test('paid staff cancellation opens one full-balance P06 refund in its transaction', async () => {
  const refundRequests = [];
  const { service, repository } = serviceFixture({
    refunds: { async requestOrderCancellationRefund(input, { session }) { refundRequests.push({ input, session }); } },
  });
  const staff = { id: USER_ID, role: 'staff' };
  const order = await repository.createOrder({
    _id: repository.newId(), code: 'TL-PAID-CANCEL-P06', userId: USER_ID,
    recipientSnapshot: { email: 'an@example.com' }, itemsSnapshot: [{ productId: PRODUCT_A, quantity: 1 }],
    subtotalVnd: 175000, shippingFeeVnd: 25000, discountVnd: 0, totalVnd: 200000,
    status: 'processing', paymentMethod: 'cod', paymentStatus: 'paid', paidAmountVnd: 200000,
    refundedAmountVnd: 25000, reservationId: repository.newId(), statusHistory: [], version: 0,
  });
  const input = { toStatus: 'cancelled', expectedVersion: 0, reason: 'Hủy sau khi hoàn một phần' };
  const cancelled = await service.transitionOrder(staff, order._id, input, 'paid-cancel-operation-key-654321');
  await service.transitionOrder(staff, order._id, input, 'paid-cancel-operation-key-654321');

  assert.equal(cancelled.status, 'cancelled');
  assert.equal(refundRequests.length, 1);
  assert.equal(refundRequests[0].input.amountVnd, 175000);
  assert.equal(refundRequests[0].input.reason, input.reason);
  assert.equal(refundRequests[0].input.actor.id, staff.id);
  assert.match(refundRequests[0].input.requestKey, /^[a-f\d]{64}$/u);
  assert.notEqual(refundRequests[0].input.requestKey, 'paid-cancel-operation-key-654321');
  assert.ok(refundRequests[0].session);
});

test('paid customer cancellation queues a refund request without erasing payment facts', async () => {
  const refundRequests = [];
  const { service, repository } = serviceFixture({
    refunds: { async requestOrderCancellationRefund(input, { session }) { refundRequests.push({ input, session }); } },
  });
  const customer = { id: USER_ID, role: 'customer', user: { emailNormalized: 'an@example.com' } };
  const order = await repository.createOrder({
    _id: repository.newId(), code: 'TL-PAID-CUSTOMER-CANCEL', userId: USER_ID,
    recipientSnapshot: { email: 'an@example.com' }, itemsSnapshot: [{ productId: PRODUCT_A, quantity: 1 }],
    subtotalVnd: 175000, shippingFeeVnd: 25000, discountVnd: 0, totalVnd: 200000,
    status: 'pending', paymentMethod: 'payos', paymentStatus: 'paid', paidAmountVnd: 200000,
    refundedAmountVnd: 0, reservationId: repository.newId(), statusHistory: [], version: 0,
  });
  const cancelInput = { reason: 'Tôi muốn hủy đơn', expectedVersion: 0 };
  const cancelled = await service.cancelOwnedOrder(customer, order._id, cancelInput, 'paid-customer-cancel-key-123456');
  await service.cancelOwnedOrder(customer, order._id, cancelInput, 'paid-customer-cancel-key-123456');

  assert.equal(cancelled.status, 'cancelled');
  assert.equal(refundRequests.length, 1);
  assert.equal(refundRequests[0].input.amountVnd, 200000);
  assert.equal(refundRequests[0].input.actor.id, USER_ID);
  assert.equal(repository.orders.get(String(order._id)).paidAmountVnd, 200000);
});

test('paid guest cancellation requests a refund without fabricating an authenticated user ID', async () => {
  const refundRequests = [];
  const { service, repository } = serviceFixture({
    refunds: { async requestOrderCancellationRefund(input, { session }) { refundRequests.push({ input, session }); } },
  });
  const guestOrderId = repository.newId();
  const guest = { orderId: String(guestOrderId) };
  const order = await repository.createOrder({
    _id: guestOrderId, code: 'TL-PAID-GUEST-CANCEL',
    recipientSnapshot: { email: 'an@example.com' }, itemsSnapshot: [{ productId: PRODUCT_A, quantity: 1 }],
    subtotalVnd: 175000, shippingFeeVnd: 25000, discountVnd: 0, totalVnd: 200000,
    status: 'pending', paymentMethod: 'payos', paymentStatus: 'paid', paidAmountVnd: 200000,
    refundedAmountVnd: 0, reservationId: repository.newId(), statusHistory: [], version: 0,
  });
  const cancelled = await service.cancelOwnedOrder(guest, order._id, {
    reason: 'Tôi muốn hủy đơn đã thanh toán', expectedVersion: 0,
  }, 'paid-guest-cancel-operation-key-123456');

  assert.equal(cancelled.status, 'cancelled');
  assert.equal(refundRequests.length, 1);
  assert.deepEqual(refundRequests[0].input.actor, { orderId: String(order._id), role: 'guest' });
  assert.equal(Object.hasOwn(refundRequests[0].input.actor, 'id'), false);
  assert.equal(refundRequests[0].input.amountVnd, 200000);
});

test('staff shipment commits the held stock once and requires carrier details', async () => {
  const { service, repository } = serviceFixture();
  const actor = { id: USER_ID, role: 'staff' };
  const created = await service.createOrder(actor, checkoutInput(), 'ship-order-create-key-123456');
  const orderId = created.order.id;
  const order = repository.orders.get(orderId);
  order.status = 'processing';

  await assert.rejects(service.transitionOrder(actor, orderId, {
    toStatus: 'shipped', expectedVersion: 0,
  }, 'ship-order-operation-key-123456'), (error) => error.code === 'VALIDATION_ERROR');

  const shipped = await service.transitionOrder(actor, orderId, {
    toStatus: 'shipped', expectedVersion: 0,
    shipping: { carrier: 'Viettel Post', trackingNumber: 'VT123456' },
  }, 'ship-order-operation-key-123456');
  const replay = await service.transitionOrder(actor, orderId, {
    toStatus: 'shipped', expectedVersion: 0,
    shipping: { carrier: 'Viettel Post', trackingNumber: 'VT123456' },
  }, 'ship-order-operation-key-123456');

  assert.equal(shipped.status, 'shipped');
  assert.equal(replay.status, 'shipped');
  assert.equal(repository.inventory.get(PRODUCT_A).onHand, 0);
  assert.equal(repository.inventory.get(PRODUCT_A).reserved, 0);
  assert.equal(repository.reservations.get(orderId).status, 'committed');
  assert.equal(repository.committedEffects.outbox.filter((event) => event.type === 'order.status_changed').length, 1);
});

test('COD collection requires full balance evidence and retries without duplicate ledger records', async () => {
  const { service, repository } = serviceFixture();
  const staff = { id: USER_ID, role: 'staff' };
  const order = await repository.createOrder({
    _id: repository.newId(), code: 'TL-COD-TEST', userId: USER_ID,
    recipientSnapshot: { email: 'an@example.com' }, itemsSnapshot: [{ productId: PRODUCT_A, quantity: 1 }],
    subtotalVnd: 175000, shippingFeeVnd: 25000, discountVnd: 0, totalVnd: 200000,
    status: 'shipped', paymentMethod: 'cod', paymentStatus: 'pending', paidAmountVnd: 0,
    refundedAmountVnd: 0, reservationId: repository.newId(), statusHistory: [], version: 0,
  });
  const input = { amountVnd: 200000, evidenceReference: 'receipt:COD-0001', expectedVersion: 0 };
  const collected = await service.collectCod(staff, order._id, input, 'cod-collection-operation-key-123456');
  const replay = await service.collectCod(staff, order._id, input, 'cod-collection-operation-key-123456');

  assert.equal(collected.paymentStatus, 'paid');
  assert.equal(collected.paidAmountVnd, 200000);
  assert.equal(replay.paymentStatus, 'paid');
  assert.equal(repository.codCollections.size, 1);
  await assert.rejects(service.collectCod(staff, order._id, {
    ...input, amountVnd: 199999,
  }, 'cod-collection-operation-key-123456'), (error) => error.code === 'IDEMPOTENCY_CONFLICT');
});

test('P06 refund aggregate follows its ledger and preserves the collected amount', async () => {
  const { service, repository } = serviceFixture();
  const order = await repository.createOrder({
    _id: repository.newId(), code: 'TL-REFUND-TEST', userId: USER_ID,
    recipientSnapshot: { email: 'an@example.com' }, itemsSnapshot: [{ productId: PRODUCT_A, quantity: 1 }],
    subtotalVnd: 175000, shippingFeeVnd: 25000, discountVnd: 0, totalVnd: 200000,
    status: 'delivered', paymentMethod: 'payos', paymentStatus: 'paid', paidAmountVnd: 200000,
    refundedAmountVnd: 0, reservationId: repository.newId(), statusHistory: [], version: 0,
  });

  const pending = await repository.transaction((session) => service.applyRefundAggregate(order._id, {
    expectedVersion: 0, refundedAmountVnd: 0, hasInFlightRefund: true,
  }, { session }));
  assert.equal(pending.paymentStatus, 'refund_pending');
  assert.equal(pending.paidAmountVnd, 200000);
  assert.equal(pending.version, 1);

  const failed = await repository.transaction((session) => service.applyRefundAggregate(order._id, {
    expectedVersion: 1, refundedAmountVnd: 0, hasInFlightRefund: false,
  }, { session }));
  assert.equal(failed.paymentStatus, 'paid');
  assert.equal(failed.paidAmountVnd, 200000);
  assert.equal(failed.refundedAmountVnd, 0);

  const completed = await repository.transaction((session) => service.applyRefundAggregate(order._id, {
    expectedVersion: 2, refundedAmountVnd: 200000, hasInFlightRefund: false,
  }, { session }));
  assert.equal(completed.paymentStatus, 'refunded');
  assert.equal(completed.paidAmountVnd, 200000);
  assert.equal(completed.refundedAmountVnd, 200000);
  assert.equal(completed.version, 3);
});

test('P07 return inspection closes the order and restocks only resellable units atomically', async () => {
  const { service, repository } = serviceFixture({ stock: { [PRODUCT_A]: 0 } });
  const staff = { id: USER_ID, role: 'staff' };
  const order = await repository.createOrder({
    _id: repository.newId(), code: 'TL-RETURN-TEST', userId: USER_ID,
    recipientSnapshot: { email: 'an@example.com' }, itemsSnapshot: [{ productId: PRODUCT_A, quantity: 2 }],
    subtotalVnd: 350000, shippingFeeVnd: 25000, discountVnd: 0, totalVnd: 375000,
    status: 'return_requested', paymentMethod: 'cod', paymentStatus: 'paid', paidAmountVnd: 375000,
    refundedAmountVnd: 0, reservationId: repository.newId(), statusHistory: [], version: 4,
  });
  const returnId = '507f1f77bcf86cd799439021';
  const input = {
    orderId: order._id, returnId, items: [{ productId: PRODUCT_A, receivedQuantity: 2, resellableQuantity: 1 }],
    reason: 'One unit passed inspection', expectedOrderVersion: 4,
  };

  const result = await repository.transaction((session) => service.completeReturn(staff, input, { session }));

  assert.equal(result.order.status, 'returned');
  assert.equal(result.order.version, 5);
  assert.equal(result.inventory[0].onHand, 1);
  assert.equal(repository.inventory.get(PRODUCT_A).onHand, 1);
  assert.deepEqual(repository.movements.map((movement) => ({ eventKey: movement.eventKey, onHandDelta: movement.onHandDelta })), [
    { eventKey: `return:${returnId}:${PRODUCT_A}`, onHandDelta: 1 },
  ]);
  assert.equal(repository.committedEffects.outbox.some((event) => event.type === 'order.return_resolved'), true);
  await assert.rejects(
    repository.transaction((session) => service.completeReturn(staff, input, { session })),
    (error) => error.code === 'INVALID_TRANSITION',
  );
  assert.equal(repository.inventory.get(PRODUCT_A).onHand, 1);
  assert.equal(repository.movements.length, 1);
});

test('failed return inspection rolls back earlier resellable item movements in its transaction', async () => {
  const { service, repository } = serviceFixture({ stock: { [PRODUCT_A]: 0, [PRODUCT_B]: 0 } });
  const staff = { id: USER_ID, role: 'staff' };
  const order = await repository.createOrder({
    _id: repository.newId(), code: 'TL-RETURN-ROLLBACK', userId: USER_ID,
    recipientSnapshot: { email: 'an@example.com' }, itemsSnapshot: [
      { productId: PRODUCT_A, quantity: 1 }, { productId: PRODUCT_B, quantity: 1 },
    ],
    subtotalVnd: 350000, shippingFeeVnd: 25000, discountVnd: 0, totalVnd: 375000,
    status: 'return_requested', paymentMethod: 'cod', paymentStatus: 'paid', paidAmountVnd: 375000,
    refundedAmountVnd: 0, reservationId: repository.newId(), statusHistory: [], version: 2,
  });

  await assert.rejects(repository.transaction((session) => service.completeReturn(staff, {
    orderId: order._id, returnId: '507f1f77bcf86cd799439022', expectedOrderVersion: 2,
    items: [
      { productId: PRODUCT_A, receivedQuantity: 1, resellableQuantity: 1 },
      { productId: PRODUCT_B, receivedQuantity: 1, resellableQuantity: 2 },
    ],
  }, { session })), (error) => error.code === 'VALIDATION_ERROR');

  assert.equal(repository.orders.get(String(order._id)).status, 'return_requested');
  assert.equal(repository.inventory.get(PRODUCT_A).onHand, 0);
  assert.equal(repository.inventory.get(PRODUCT_B).onHand, 0);
  assert.equal(repository.movements.length, 0);
});

test('P06 verified payment updates the order only for full amount and keeps stock held', async () => {
  const { service, repository } = serviceFixture();
  const order = await repository.createOrder({
    _id: repository.newId(), code: 'TL-PAYMENT-TEST', userId: USER_ID,
    recipientSnapshot: { email: 'an@example.com' }, itemsSnapshot: [{ productId: PRODUCT_A, quantity: 1 }],
    subtotalVnd: 175000, shippingFeeVnd: 25000, discountVnd: 0, totalVnd: 200000,
    status: 'pending', paymentMethod: 'payos', paymentStatus: 'pending', paidAmountVnd: 0,
    refundedAmountVnd: 0, reservationId: repository.newId(), statusHistory: [], version: 0,
  });
  const expiresAt = new Date('2026-10-06T00:15:00Z');
  repository.reservations.set(String(order._id), {
    _id: repository.newId(), orderId: order._id, items: [{ productId: PRODUCT_A, quantity: 1 }],
    status: 'held', expiresAt, version: 0,
  });
  repository.inventory.get(PRODUCT_A).reserved = 1;

  const mismatch = await repository.transaction((session) => service.applyVerifiedPayment({
    provider: 'payos', status: 'paid', currency: 'VND', amountVnd: 199999, orderId: order._id,
  }, { session }));
  assert.equal(mismatch.applied, false);
  assert.equal(mismatch.reviewRequired, true);
  assert.equal(repository.orders.get(String(order._id)).paymentStatus, 'pending');
  assert.equal(repository.orders.get(String(order._id)).paidAmountVnd, 0);

  const match = await repository.transaction((session) => service.applyVerifiedPayment({
    provider: 'payos', status: 'paid', currency: 'VND', amountVnd: 200000, orderId: order._id,
  }, { session }));
  assert.equal(match.applied, true);
  assert.equal(match.reviewRequired, false);
  assert.equal(repository.orders.get(String(order._id)).paymentStatus, 'paid');
  assert.equal(repository.orders.get(String(order._id)).paidAmountVnd, 200000);
  assert.equal(repository.inventory.get(PRODUCT_A).reserved, 1);
  assert.equal(repository.reservations.get(String(order._id)).status, 'held');
  assert.equal(repository.reservations.get(String(order._id)).expiresAt, undefined);
  const paymentEvent = repository.committedEffects.outbox.find((event) => event.type === 'order.payment_verified');
  assert.equal(paymentEvent.aggregateVersion, 2);
});

test('guest lookup challenge returns generic acceptance and stores only a digest', async () => {
  const { service, repository, proofCalls } = serviceFixture();
  const guest = { actorKey: 'guest-cart-token-hash-0123456789' };
  const placed = await service.createOrder(guest, checkoutInput(), 'guest-checkout-key-1234567890');
  const order = repository.orders.get(placed.order.id);
  assert.equal(repository.committedEffects.proofs[0].identityVerifiedAt, undefined);
  assert.notEqual(order.guestAccessTokenHash, 'guest-secret-1');

  const mailCount = repository.committedEffects.mails.length;
  const unknown = await service.issueOrderAccessChallenge({ code: 'TL-UNKNOWN', email: 'an@example.com' });
  assert.equal(unknown.accepted, true);
  assert.equal(repository.committedEffects.mails.length, mailCount);

  const issued = await service.issueOrderAccessChallenge({ code: order.code, email: 'an@example.com' });
  const mail = repository.committedEffects.mails.at(-1);
  assert.equal(repository.committedEffects.mails.length, mailCount + 1);
  const verified = await service.verifyOrderAccessChallenge({ challengeId: issued.challengeId, verificationCode: mail.data.verificationCode });
  assert.equal(verified.orderId, placed.order.id);
  assert.ok(proofCalls.at(-1).identityVerifiedAt instanceof Date);
});

test('verified guest claim compare-and-sets the order and revokes proof once', async () => {
  const { service, repository } = serviceFixture();
  const guest = { actorKey: 'guest-claim-cart-token-0123456789' };
  const placed = await service.createOrder(guest, checkoutInput(), 'guest-claim-create-key-123456789');
  const customer = {
    id: USER_ID, role: 'customer', status: 'active',
    user: { emailNormalized: 'an@example.com', emailVerifiedAt: new Date('2026-10-06T00:00:00Z') },
    guestOrderProof: { orderId: placed.order.id },
  };
  const claimKey = 'guest-claim-operation-key-123456';
  const compareAndSet = repository.models.Order.findOneAndUpdate;
  repository.models.Order.findOneAndUpdate = () => ({ exec: async () => null });
  await assert.rejects(
    service.claimGuestOrder(customer, placed.order.id, claimKey),
    (error) => error.code === 'VERSION_CONFLICT',
  );
  assert.equal(repository.committedEffects.revokedProofs.length, 0);
  repository.models.Order.findOneAndUpdate = compareAndSet;

  const claimed = await service.claimGuestOrder(customer, placed.order.id, claimKey);
  const replay = await service.claimGuestOrder(customer, placed.order.id, claimKey);
  const order = repository.orders.get(placed.order.id);
  assert.equal(claimed.id, placed.order.id);
  assert.equal(replay.id, placed.order.id);
  assert.equal(order.userId, USER_ID);
  assert.equal(Object.hasOwn(order, 'guestAccessTokenHash'), false);
  assert.deepEqual(repository.committedEffects.revokedProofs, [placed.order.id]);
  assert.equal(repository.committedEffects.outbox.filter((event) => event.type === 'order.guest_claimed').length, 1);
});


test('payment context returns the exact reservation expiry only to its owner or scoped guest proof', async () => {
  const { service, repository } = serviceFixture({ paymentConfigured: true });
  const guest = { actorKey: 'guest-payment-context-token-123456789' };
  const created = await service.createOrder(guest, { ...checkoutInput(), paymentMethod: 'payos' }, 'payment-context-create-key-123456');
  const orderId = created.order.id;
  const reservation = repository.reservations.get(orderId);
  assert.ok(reservation.expiresAt instanceof Date);

  const context = await service.getPaymentContext({ orderId }, orderId);
  assert.equal(context.order.id, orderId);
  assert.equal(context.reservation.status, 'held');
  assert.equal(context.reservation.expiresAt.getTime(), reservation.expiresAt.getTime());
  await assert.rejects(service.getPaymentContext({ orderId: PRODUCT_B }, orderId), (error) => error.code === 'NOT_FOUND');
  await assert.rejects(service.getPaymentContext({ id: USER_ID, role: 'customer' }, orderId), (error) => error.code === 'NOT_FOUND');
});

test('reservation expiry defers COD, paid, and non-pending orders while releasing only expired pending PayOS', async () => {
  const providerChecks = [];
  const { service, repository } = serviceFixture({
    stock: { [PRODUCT_A]: 8 },
    paymentExpiry: async (order) => { providerChecks.push(String(order._id)); return 'expired'; },
  });
  async function addExpiredOrder({ code, status, paymentMethod, paymentStatus }) {
    const order = await repository.createOrder({
      _id: repository.newId(), code, userId: USER_ID,
      recipientSnapshot: { email: 'an@example.com' }, itemsSnapshot: [{ productId: PRODUCT_A, quantity: 1 }],
      subtotalVnd: 175000, shippingFeeVnd: 25000, discountVnd: 0, totalVnd: 200000,
      status, paymentMethod, paymentStatus, paidAmountVnd: paymentStatus === 'paid' ? 200000 : 0,
      refundedAmountVnd: 0, reservationId: repository.newId(), statusHistory: [], version: 0,
    });
    repository.reservations.set(String(order._id), {
      _id: repository.newId(), orderId: order._id,
      items: [{ productId: PRODUCT_A, quantity: 1 }], status: 'held',
      expiresAt: new Date('2026-10-05T23:45:00Z'), version: 0,
    });
    repository.inventory.get(PRODUCT_A).reserved += 1;
    return order;
  }

  const paid = await addExpiredOrder({ code: 'TL-EXP-PAID', status: 'pending', paymentMethod: 'payos', paymentStatus: 'paid' });
  const cod = await addExpiredOrder({ code: 'TL-EXP-COD', status: 'pending', paymentMethod: 'cod', paymentStatus: 'pending' });
  const confirmed = await addExpiredOrder({ code: 'TL-EXP-CONFIRMED', status: 'confirmed', paymentMethod: 'payos', paymentStatus: 'pending' });
  const pending = await addExpiredOrder({ code: 'TL-EXP-PENDING', status: 'pending', paymentMethod: 'payos', paymentStatus: 'pending' });

  const result = await service.releaseExpiredReservations();

  assert.deepEqual(result, { checked: 4, released: 1, deferred: 3 });
  assert.deepEqual(providerChecks, [String(pending._id)]);
  assert.equal(repository.reservations.get(String(paid._id)).status, 'held');
  assert.equal(repository.reservations.get(String(cod._id)).status, 'held');
  assert.equal(repository.reservations.get(String(confirmed._id)).status, 'held');
  assert.equal(repository.reservations.get(String(pending._id)).status, 'released');
  assert.equal(repository.orders.get(String(pending._id)).paymentStatus, 'expired');
  assert.equal(repository.inventory.get(PRODUCT_A).reserved, 3);
});
