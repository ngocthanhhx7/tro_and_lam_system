import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import { PaymentAttempt } from '../src/models/payments/payment-attempt.model.js';
import { PaymentEvent } from '../src/models/payments/payment-event.model.js';
import { Refund } from '../src/models/payments/refund.model.js';
import { CodCollection } from '../src/models/commerce/cod-collection.model.js';
import { PaymentsRepository } from '../src/services/payments/payments.repository.js';
import { createPaymentsService } from '../src/services/payments/payments.service.js';
import { createFinanceLedgerPort } from '../src/services/operations/finance-ledger.port.js';
import { createPayosAdapter, createPayosSignature } from '../src/services/integrations/payos/payos.adapter.js';
import { createPaymentHarness } from './payments/payments.fake.js';

test('replica set: reconciliation followed by a signed delayed webhook contributes one settlement to finance', { skip: !process.env.QUERY_TEST_REPLICA_SET_URI }, async () => {
  const uri = new URL(process.env.QUERY_TEST_REPLICA_SET_URI);
  assert.equal(uri.protocol, 'mongodb:');
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(uri.hostname));
  assert.equal(uri.username + uri.password + uri.search + uri.hash, '');
  const name = `tro_lam_security_test_${randomBytes(6).toString('hex')}`;
  uri.pathname = `/${name}`;
  let owned = false;
  try {
    const probe = new MongoClient(uri.toString(), { serverSelectionTimeoutMS: 5000 });
    try {
      await probe.connect();
      assert.equal((await probe.db('admin').admin().listDatabases({ nameOnly: true })).databases.some(db => db.name === name), false);
    } finally { await probe.close(); }
    owned = true;
    await mongoose.connect(uri.toString(), { autoIndex: false, serverSelectionTimeoutMS: 5000 });
    for (const model of [PaymentAttempt, PaymentEvent, Refund, CodCollection]) await model.createIndexes();
    const harness = createPaymentHarness();
    const attempt = await PaymentAttempt.create({ orderId: harness.orderId, provider: 'payos', providerOrderCode: 123456789,
      paymentLinkId: 'security-one-link', status: 'pending', providerState: 'pending', amountVnd: 9000,
      expiresAt: new Date(harness.fixedNow.getTime() + 900_000), requestKey: 'security-reconciliation-fixture', active: true, version: 0 });
    const checksumKey = 'synthetic-security-checksum';
    const provider = createPayosAdapter({ config: { enabled: true, clientId: 'synthetic', apiKey: 'synthetic', checksumKey },
      fetchImpl: async () => ({ ok: true, json: async () => ({ code: '00', data: { id: attempt.paymentLinkId, orderCode: 123456789, amount: 9000, amountPaid: 9000, currency: 'VND', status: 'PAID' } }) }) });
    const service = createPaymentsService({ ports: harness.ports, config: harness.config, provider, repository: new PaymentsRepository() });
    await service.reconcilePendingAttempts();
    const data = { orderCode: 123456789, amount: 9000, currency: 'VND', paymentLinkId: attempt.paymentLinkId, reference: 'synthetic-delayed-reference', code: '00' };
    const result = await service.receivePayosWebhook({ data, signature: createPayosSignature(data, checksumKey) });
    assert.equal(result.applied, false);
    assert.equal(result.reasonCode, 'PAYMENT_ALREADY_APPLIED');
    assert.equal(await PaymentEvent.countDocuments(), 2);
    assert.equal(await PaymentEvent.countDocuments({ processingState: 'applied' }), 1);
    const finance = createFinanceLedgerPort({ PaymentEvent, Refund, CodCollection });
    const totals = await finance.getStatistics({ from: new Date(harness.fixedNow.getTime() - 1000), to: new Date(harness.fixedNow.getTime() + 1000) });
    assert.equal(totals.grossCollectedVnd, 9000);
  } finally {
    if (owned && mongoose.connection.name === name) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
