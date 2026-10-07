import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { Refund } from '../../src/models/payments/refund.model.js';
import { ensurePaymentIndexes } from '../../src/models/payments/indexes.js';
import { createPaymentsService } from '../../src/services/payments/payments.service.js';

const replicaSetUri = process.env.P06_TEST_REPLICA_SET_URI;

function assertDedicatedP06DatabaseUri(value) {
  let target;
  try {
    target = new URL(value);
  } catch {
    throw new Error('P06_TEST_REPLICA_SET_URI must be a dedicated loopback MongoDB URI.');
  }

  const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
  if (target.protocol !== 'mongodb:'
    || !allowedHosts.has(target.hostname)
    || target.username
    || target.password
    || target.search
    || target.hash) {
    throw new Error('P06 replica-set tests may connect only to unauthenticated loopback MongoDB without URI options.');
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(target.pathname.replace(/^\/+/, ''));
  } catch {
    throw new Error('P06_TEST_REPLICA_SET_URI contains an invalid database name.');
  }
  const isCiDatabase = databaseName === 'tro_lam_p06_ci_test';
  const isDedicatedLocalDatabase = /^tro_lam_p06_test_[a-f0-9]{12}$/u.test(databaseName);
  if (!isCiDatabase && !isDedicatedLocalDatabase) {
    throw new Error('P06_TEST_REPLICA_SET_URI must name a dedicated P06 test database.');
  }
  return databaseName;
}

async function assertP06DatabaseDoesNotExist(value, databaseName) {
  const adminUri = new URL(value);
  adminUri.pathname = '/admin';
  const adminConnection = await mongoose.createConnection(adminUri.toString(), {
    serverSelectionTimeoutMS: 10000,
  }).asPromise();
  try {
    const existingDatabases = await adminConnection.db.admin().listDatabases({ nameOnly: true });
    if (existingDatabases.databases.some((database) => database.name === databaseName)) {
      throw new Error('P06 replica-set tests require a new, unused test database.');
    }
  } finally {
    await adminConnection.close();
  }
}

test('P06 replica-set URI is restricted to dedicated loopback test databases', () => {
  assert.equal(assertDedicatedP06DatabaseUri('mongodb://127.0.0.1:27017/tro_lam_p06_test_0123456789ab'), 'tro_lam_p06_test_0123456789ab');
  assert.equal(assertDedicatedP06DatabaseUri('mongodb://127.0.0.1:27017/tro_lam_p06_ci_test'), 'tro_lam_p06_ci_test');
  assert.throws(() => assertDedicatedP06DatabaseUri('mongodb://example.com/tro_lam_p06_test_0123456789ab'), /loopback MongoDB/u);
  assert.throws(() => assertDedicatedP06DatabaseUri('mongodb://user:secret@127.0.0.1/tro_lam_p06_test_0123456789ab'), /unauthenticated loopback/u);
  assert.throws(() => assertDedicatedP06DatabaseUri('mongodb://127.0.0.1/tro_lam_p06_test_0123456789ab?retryWrites=true'), /URI options/u);
  assert.throws(() => assertDedicatedP06DatabaseUri('mongodb://127.0.0.1/tro_lam_production'), /dedicated P06 test database/u);
});

test('MongoDB replica-set unique open-refund index serializes competing refund requests', {
  skip: !replicaSetUri,
}, async () => {
  let orderId;
  let databaseName;
  let ownsDatabase = false;
  try {
    databaseName = assertDedicatedP06DatabaseUri(replicaSetUri);
    await assertP06DatabaseDoesNotExist(replicaSetUri, databaseName);
    ownsDatabase = true;
    await mongoose.connect(replicaSetUri, { serverSelectionTimeoutMS: 10000 });
    assert.equal(mongoose.connection.name, databaseName);
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
      try {
        if (ownsDatabase && mongoose.connection.name === databaseName) await mongoose.connection.dropDatabase();
      } finally {
        await mongoose.disconnect();
      }
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
