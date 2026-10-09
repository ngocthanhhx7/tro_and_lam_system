import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';
import { CodCollection } from '../../src/models/commerce/cod-collection.model.js';
import { Order } from '../../src/models/commerce/order.model.js';
import { PaymentEvent } from '../../src/models/payments/payment-event.model.js';
import { Refund } from '../../src/models/payments/refund.model.js';
import { createDashboardService } from '../../src/services/operations/dashboard.service.js';
import { createFinanceLedgerPort } from '../../src/services/operations/finance-ledger.port.js';
import { createOperationsRouter } from '../../src/routes/operations.routes.js';

const replicaSetUri = process.env.P09_TEST_REPLICA_SET_URI;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const DIGEST = 'a'.repeat(64);

function assertDedicatedLoopbackUri(value) {
  let target;
  try { target = new URL(value); } catch { throw new Error('P09_TEST_REPLICA_SET_URI must be a loopback MongoDB URI.'); }
  assert.equal(target.protocol, 'mongodb:');
  assert.ok(LOOPBACK_HOSTS.has(target.hostname), 'finance acceptance may only connect to loopback MongoDB');
  assert.equal(target.username, '', 'finance acceptance must not use database credentials');
  assert.equal(target.password, '', 'finance acceptance must not use database credentials');
  assert.equal(target.search, '', 'finance acceptance does not accept URI options');
  assert.equal(target.hash, '', 'finance acceptance does not accept URI fragments');
}

async function assertDatabaseAbsent(uri, dbName) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const { databases } = await client.db('admin').admin().listDatabases({ nameOnly: true });
    assert.equal(databases.some(({ name }) => name === dbName), false, 'generated finance test database must be new');
  } finally {
    await client.close();
  }
}

function paymentEvent(dedupeKey, { state = 'applied', amountVnd, verifiedAt }) {
  return {
    provider: 'payos', dedupeKey, payloadDigest: DIGEST,
    receivedAt: new Date('2026-09-01T00:00:00.000Z'),
    processingState: state, amountVnd,
    ...(verifiedAt ? { verifiedAt: new Date(verifiedAt) } : {}),
  };
}

function codCollection(idempotencyKey, amountVnd, recordedAt) {
  return {
    orderId: new mongoose.Types.ObjectId(), amountVnd,
    evidenceReference: `fixture:${idempotencyKey}`, idempotencyKey,
    recordedBy: new mongoose.Types.ObjectId(), recordedAt: new Date(recordedAt),
  };
}

test('P09 replica set: admin revenue reconciles persisted PayOS, COD, refunds, Vietnam days, and prior period', {
  skip: replicaSetUri ? false : 'Set P09_TEST_REPLICA_SET_URI to a dedicated loopback MongoDB replica set.',
}, async () => {
  assertDedicatedLoopbackUri(replicaSetUri);
  const dbName = `tro_lam_p09_test_${randomBytes(6).toString('hex')}`;
  let connected = false;

  try {
    await assertDatabaseAbsent(replicaSetUri, dbName);
    await mongoose.connect(replicaSetUri, { dbName, serverSelectionTimeoutMS: 5000 });
    connected = true;
    assert.equal(mongoose.connection.name, dbName);
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.ok(hello.setName, 'finance integration requires a MongoDB replica set');
    await Promise.all([PaymentEvent.init(), CodCollection.init(), Refund.init(), Order.init()]);

    await PaymentEvent.create([
      paymentEvent('current-payos-1', { amountVnd: 100_000, verifiedAt: '2026-10-01T17:05:00.000Z' }),
      paymentEvent('current-payos-2', { amountVnd: 30_000, verifiedAt: '2026-10-02T17:05:00.000Z' }),
      paymentEvent('prior-payos-1', { amountVnd: 80_000, verifiedAt: '2026-09-28T17:05:00.000Z' }),
      paymentEvent('prior-payos-2', { amountVnd: 10_000, verifiedAt: '2026-09-30T16:00:00.000Z' }),
      paymentEvent('rejected-payos', { state: 'rejected', amountVnd: 999_000, verifiedAt: '2026-10-01T11:00:00.000Z' }),
      paymentEvent('unverified-payos', { state: 'received', amountVnd: 888_000 }),
      paymentEvent('outside-payos', { amountVnd: 777_000, verifiedAt: '2026-10-03T17:05:00.000Z' }),
    ]);
    await CodCollection.create([
      codCollection('current-cod', 20_000, '2026-10-02T04:00:00.000Z'),
      codCollection('prior-cod', 20_000, '2026-09-30T04:00:00.000Z'),
    ]);
    await Refund.collection.insertMany([
      {
        orderId: new mongoose.Types.ObjectId(), amountVnd: 5_000, status: 'completed',
        reason: 'Synthetic completed refund', requesterType: 'admin', requestKey: 'current-refund',
        requestPayloadHash: DIGEST, version: 1, updatedAt: new Date('2026-10-02T04:30:00.000Z'),
      },
      {
        orderId: new mongoose.Types.ObjectId(), amountVnd: 6_000, status: 'failed',
        reason: 'Synthetic failed refund', requesterType: 'admin', requestKey: 'failed-refund',
        requestPayloadHash: DIGEST, version: 1, updatedAt: new Date('2026-10-02T05:00:00.000Z'),
      },
    ]);

    const financeLedger = createFinanceLedgerPort({ PaymentEvent, CodCollection, Refund });
    const dashboard = createDashboardService({ Order, financeLedger });
    const result = await dashboard.getAdminStatistics({
      from: '2026-10-01T00:00:00+07:00',
      to: '2026-10-03T23:59:59.999+07:00',
    });

    assert.equal(result.grossCollectedVnd, 150_000);
    assert.equal(result.refundedVnd, 5_000);
    assert.equal(result.netCollectedVnd, 145_000);
    assert.deepEqual(result.comparison, {
      from: '2026-09-27T17:00:00.000Z',
      to: '2026-09-30T16:59:59.999Z',
      grossCollectedVnd: 110_000,
      deltaVnd: 40_000,
      changePercent: 36.4,
    });
    assert.equal(result.revenueTrend.timezone, 'Asia/Ho_Chi_Minh');
    assert.deepEqual(result.revenueTrend.daily, [
      { date: '2026-10-01', grossCollectedVnd: 0 },
      { date: '2026-10-02', grossCollectedVnd: 120_000 },
      { date: '2026-10-03', grossCollectedVnd: 30_000 },
    ]);
    assert.deepEqual(result.revenueTrend.comparisonDaily, [
      { date: '2026-10-01', comparisonDate: '2026-09-28', grossCollectedVnd: 0 },
      { date: '2026-10-02', comparisonDate: '2026-09-29', grossCollectedVnd: 80_000 },
      { date: '2026-10-03', comparisonDate: '2026-09-30', grossCollectedVnd: 30_000 },
    ]);

    const router = createOperationsRouter({
      auth: {
        authenticate(_req, _res, next) {
          _req.actor = { id: 'finance-test-admin', role: 'admin', status: 'active' };
          next();
        },
        requireCsrf(_req, _res, next) { next(); },
      },
      notificationService: {}, outboxService: {}, auditService: {}, settingsService: {},
      dashboardService: dashboard,
    });
    const app = express().use('/api/v1', router);
    const apiResponse = await request(app)
      .get('/api/v1/admin/statistics')
      .query({ from: '2026-10-01T00:00:00+07:00', to: '2026-10-03T23:59:59.999+07:00' });
    assert.equal(apiResponse.status, 200);
    assert.equal(apiResponse.body.data.grossCollectedVnd, 150_000);
    assert.deepEqual(apiResponse.body.data.revenueTrend.daily, result.revenueTrend.daily);
  } finally {
    if (connected) {
      assert.match(dbName, /^tro_lam_p09_test_[a-f\d]{12}$/u);
      assert.equal(mongoose.connection.name, dbName, 'cleanup must target only the generated finance test database');
      await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    }
  }
});
