import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { Refund } from '../../src/models/payments/refund.model.js';
import { ensurePaymentIndexes } from '../../src/models/payments/indexes.js';
import { createPaymentsService } from '../../src/services/payments/payments.service.js';

const replicaSetUri = process.env.P06_TEST_REPLICA_SET_URI;

test('MongoDB replica-set unique open-refund index serializes competing refund requests', {
  skip: !replicaSetUri,
}, async () => {
  let orderId;
  try {
    const target = new URL(replicaSetUri);
    const databaseName = target.pathname.slice(1).split('/')[0];
    if (!/test|spec/i.test(databaseName)) throw new Error('P06_TEST_REPLICA_SET_URI must point to a dedicated database whose name contains test or spec');
    await mongoose.connect(replicaSetUri, { serverSelectionTimeoutMS: 10000 });
    await ensurePaymentIndexes();
    orderId = new mongoose.Types.ObjectId();
    const staffId = new mongoose.Types.ObjectId();
    const order = {
      _id: orderId,
      userId: undefined,
      code: 'TL-REPLICA-TEST',
      status: 'pending',
      paymentStatus: 'paid',
      paidAmountVnd: 9000,
      refundedAmountVnd: 0,
      version: 0,
    };
    const service = createPaymentsService({
      ports: {
        commerceService: {
          async getOwnedOrder() { return order; },
          async getPaymentContext() { return null; },
          async getOperationalOrder() { return order; },
          async applyVerifiedPayment() { throw new Error('not used'); },
          async applyRefundAggregate() { throw new Error('not used'); },
        },
        appendAudit: async () => {},
        now: () => new Date(),
      },
      config: { publicWebUrl: 'https://shop.example.test' },
    });
    const create = (suffix) => service.createRefundRequest(
      { id: String(staffId), role: 'staff' },
      String(orderId),
      { amountVnd: 9000, reason: 'Replica-set concurrency fixture', expectedVersion: 0 },
      `replica-refund-${suffix}-${randomBytes(18).toString('hex')}`,
      { requestId: `p06-replica-${suffix}` },
    );
    const outcomes = await Promise.allSettled([create('left'), create('right')]);
    assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = outcomes.find((result) => result.status === 'rejected');
    assert.equal(rejected.reason.code, 'REFUND_IN_PROGRESS');
    assert.equal(await Refund.countDocuments({ orderId, status: 'requested' }), 1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      if (orderId) await Refund.deleteMany({ orderId });
      await mongoose.disconnect();
    }
  }
});

test('refund schema has a unique partial index for one open refund per order', () => {
  const [, options] = Refund.schema.indexes().find(([, index]) => index.name === 'refund_one_open_per_order') || [];
  assert.equal(options?.unique, true);
  assert.deepEqual(options?.partialFilterExpression, {
    $or: [{ status: 'requested' }, { status: 'approved' }, { status: 'processing' }],
  });
});
