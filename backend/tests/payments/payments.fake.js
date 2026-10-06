import { createHash } from 'node:crypto';

const copy = (value) => structuredClone(value);

export function createMemoryPaymentsRepository(seed = {}) {
  let nextId = 1;
  const makeId = () => String(nextId++).padStart(24, '0');
  const state = {
    attempts: (seed.attempts || []).map(copy),
    events: (seed.events || []).map(copy),
    refunds: (seed.refunds || []).map(copy),
  };
  let transactionTail = Promise.resolve();

  async function transaction(callback) {
    const current = transactionTail.then(async () => {
      const snapshot = copy(state);
      try { return await callback({ testSession: true }); }
      catch (error) {
        state.attempts = snapshot.attempts;
        state.events = snapshot.events;
        state.refunds = snapshot.refunds;
        throw error;
      }
    });
    transactionTail = current.then(() => undefined, () => undefined);
    return current;
  }

  return {
    state,
    transaction,
    async findAttempt(orderId, requestKey) {
      return state.attempts.find((row) => String(row.orderId) === String(orderId) && row.requestKey === requestKey) || null;
    },
    async findActiveAttempt(orderId) {
      return state.attempts.find((row) => String(row.orderId) === String(orderId) && row.active) || null;
    },
    async findLatestAttempt(orderId) {
      return state.attempts.filter((row) => String(row.orderId) === String(orderId)).at(-1) || null;
    },
    async findAttemptByProviderOrderCode(providerOrderCode) {
      return state.attempts.find((row) => row.providerOrderCode === providerOrderCode) || null;
    },
    async findAttemptByLinkId(paymentLinkId) {
      return state.attempts.find((row) => row.paymentLinkId === paymentLinkId) || null;
    },
    async createAttempt(input) {
      const row = { _id: makeId(), ...copy(input), createdAt: new Date(), updatedAt: new Date() };
      state.attempts.push(row);
      return row;
    },
    async updateAttempt(id, version, changes) {
      const row = state.attempts.find((entry) => String(entry._id) === String(id) && entry.version === version);
      if (!row) return null;
      Object.assign(row, copy(changes), { version: row.version + 1, updatedAt: new Date() });
      return row;
    },
    async listPendingAttempts({ olderThan, limit = 100 }) {
      return state.attempts.filter((row) => row.status === 'pending' && row.active
        && (!row.lastCheckedAt || new Date(row.lastCheckedAt) <= olderThan))
        .slice(0, limit).map(copy);
    },
    async findEvent(provider, dedupeKey) {
      return state.events.find((row) => row.provider === provider && row.dedupeKey === dedupeKey) || null;
    },
    async createEvent(input) {
      const row = { _id: makeId(), ...copy(input) };
      state.events.push(row);
      return row;
    },
    async updateEvent(id, changes) {
      const row = state.events.find((entry) => String(entry._id) === String(id));
      if (!row) return null;
      Object.assign(row, copy(changes));
      return row;
    },
    async findLatestReviewEvent(orderId) {
      return state.events.find((row) => String(row.orderId) === String(orderId) && row.processingState === 'review') || null;
    },
    async findReviewEvent(orderId) {
      return state.events.find((row) => String(row.orderId) === String(orderId) && row.processingState === 'review') || null;
    },
    async findRefundByKey(orderId, requestKey) {
      return state.refunds.find((row) => String(row.orderId) === String(orderId) && row.requestKey === requestKey) || null;
    },
    async findRefundById(id) {
      return state.refunds.find((row) => String(row._id) === String(id)) || null;
    },
    async createRefund(input) {
      const row = {
        _id: makeId(), ...copy(input), createdAt: new Date(), updatedAt: new Date(),
      };
      state.refunds.push(row);
      return row;
    },
    async updateRefund(id, version, statuses, changes) {
      const row = state.refunds.find((entry) => String(entry._id) === String(id)
        && entry.version === version && statuses.includes(entry.status));
      if (!row) return null;
      Object.assign(row, copy(changes), { version: row.version + 1, updatedAt: new Date() });
      return row;
    },
    async listRefunds({ status, page = 1, limit = 20 } = {}) {
      const rows = status ? state.refunds.filter((row) => row.status === status) : state.refunds;
      return { items: rows.slice((page - 1) * limit, page * limit).map(copy), total: rows.length };
    },
    async refundTotals(orderId) {
      return state.refunds.filter((row) => String(row.orderId) === String(orderId))
        .reduce((total, row) => ({
          completedVnd: total.completedVnd + (row.status === 'completed' ? row.amountVnd : 0),
          requestedVnd: total.requestedVnd + (row.status === 'requested' ? row.amountVnd : 0),
          inFlightVnd: total.inFlightVnd + (['approved', 'processing'].includes(row.status) ? row.amountVnd : 0),
          hasInFlightRefund: total.hasInFlightRefund || ['approved', 'processing'].includes(row.status),
        }), { completedVnd: 0, requestedVnd: 0, inFlightVnd: 0, hasInFlightRefund: false });
    },
    newId: makeId,
  };
}

export function createPaymentHarness({
  order: orderPatch = {},
  reservation: reservationPatch = {},
  attempts = [],
  provider: providerPatch = {},
  ports: portsPatch = {},
  applyPayment: applyPaymentOverride,
} = {}) {
  const orderId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const userId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  const fixedNow = new Date('2026-10-06T05:00:00.000Z');
  const order = {
    _id: orderId,
    id: orderId,
    code: 'TL-TEST-0001',
    userId,
    recipient: { email: 'buyer@example.test' },
    status: 'pending',
    paymentMethod: 'payos',
    paymentStatus: 'pending',
    paidAmountVnd: 0,
    refundedAmountVnd: 0,
    totalVnd: 9000,
    version: 0,
    ...copy(orderPatch),
  };
  const reservation = {
    status: 'held',
    expiresAt: new Date(fixedNow.getTime() + 15 * 60_000),
    ...copy(reservationPatch),
  };
  const repository = createMemoryPaymentsRepository({ attempts });
  const delivered = { mail: [], outbox: [], audit: [], facts: [] };
  const commerce = {
    async getOwnedOrder(_actor, id) {
      if (String(id) !== orderId) return null;
      return copy(order);
    },
    async getPaymentContext(_actor, id) {
      if (String(id) !== orderId) return null;
      return { order: copy(order), reservation: copy(reservation) };
    },
    async getOperationalOrder(id) {
      if (String(id) !== orderId) return null;
      return copy(order);
    },
    async applyVerifiedPayment(fact) {
      delivered.facts.push(copy(fact));
      if (applyPaymentOverride) return applyPaymentOverride(fact, order, reservation);
      if (fact.amountVnd !== order.totalVnd) {
        order.paymentReview = { required: true, reasonCode: 'PAYMENT_AMOUNT_MISMATCH' };
        order.version += 1;
        return { applied: false, reviewRequired: true };
      }
      if (order.status === 'cancelled' || reservation.status !== 'held' || reservation.expiresAt <= fixedNow) {
        order.paymentStatus = 'paid';
        order.paidAmountVnd = fact.amountVnd;
        order.paymentReview = { required: true, reasonCode: 'LATE_PAYMENT_STOCK_REVIEW' };
        order.version += 1;
        return { applied: true, reviewRequired: true, order: copy(order) };
      }
      if (order.paymentStatus === 'paid' && order.paidAmountVnd === fact.amountVnd) {
        return { applied: false, reviewRequired: false, order: copy(order) };
      }
      order.paymentStatus = 'paid';
      order.paidAmountVnd = fact.amountVnd;
      order.version += 1;
      return { applied: true, reviewRequired: false, order: copy(order) };
    },
    async applyRefundAggregate(id, input) {
      if (String(id) !== orderId) return null;
      if (order.version !== input.expectedVersion) throw new Error('VERSION_CONFLICT');
      order.refundedAmountVnd = input.refundedAmountVnd;
      order.paymentStatus = input.hasInFlightRefund ? 'refund_pending'
        : input.refundedAmountVnd === order.paidAmountVnd ? 'refunded'
          : input.refundedAmountVnd > 0 ? 'partially_refunded' : 'paid';
      order.version += 1;
      return copy(order);
    },
  };
  const provider = {
    isConfigured: () => true,
    async createLink() { throw new Error('provider.createLink was not expected'); },
    async getLink() { return { status: 'pending' }; },
    async cancelLink() { return { status: 'CANCELLED' }; },
    verifyWebhook(body) { return body.fact; },
    ...providerPatch,
  };
  const ports = {
    commerceService: commerce,
    now: () => new Date(fixedNow),
    newProviderOrderCode: () => 123456789,
    appendAudit: async (event) => { delivered.audit.push(copy(event)); },
    appendOutbox: async (event) => { delivered.outbox.push(copy(event)); },
    enqueueMail: async (template, recipient, data, options) => { delivered.mail.push({ template, recipient, data, options }); },
    ...portsPatch,
  };
  const config = { publicWebUrl: 'https://shop.example.test', reconciliationMinimumAgeMs: 0 };
  return { orderId, userId, fixedNow, order, reservation, repository, commerce, provider, ports, config, delivered };
}

export function verifiedFact(harness, changes = {}) {
  const attempt = harness.repository.state.attempts[0];
  const unsigned = {
    provider: 'payos',
    providerEventKey: `event:${createHash('sha256').update('fixture').digest('hex')}`,
    providerOrderCode: attempt?.providerOrderCode ?? 123456789,
    paymentLinkId: attempt?.paymentLinkId ?? 'link-verified-1',
    amountVnd: harness.order.totalVnd,
    currency: 'VND',
    status: 'paid',
    occurredAt: harness.fixedNow,
    payloadDigest: createHash('sha256').update('fixture').digest('hex'),
    ...changes,
  };
  return unsigned;
}
