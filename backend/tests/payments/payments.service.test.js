import test from 'node:test';
import assert from 'node:assert/strict';
import { PayosAdapterError, createPayosAdapter, createPayosSignature } from '../../src/services/integrations/payos/payos.adapter.js';
import { createPaymentsService } from '../../src/services/payments/payments.service.js';
import { createPaymentHarness, verifiedFact } from './payments.fake.js';

const validKey = 'payment-request-idempotency-key-001';

function addAttempt(harness, changes = {}) {
  const attempt = {
    _id: 'cccccccccccccccccccccccc',
    orderId: harness.orderId,
    provider: 'payos',
    providerOrderCode: 123456789,
    paymentLinkId: 'link-verified-1',
    status: 'pending',
    providerState: 'pending',
    amountVnd: harness.order.totalVnd,
    expiresAt: new Date(harness.fixedNow.getTime() + 15 * 60_000),
    requestKey: validKey,
    active: true,
    version: 0,
    ...changes,
  };
  harness.repository.state.attempts.push(attempt);
  return attempt;
}

function serviceFor(harness) {
  return createPaymentsService({
    ports: harness.ports,
    config: harness.config,
    provider: harness.provider,
    repository: harness.repository,
  });
}

test('invalid PayOS signature cannot create an event or update the order', async () => {
  const harness = createPaymentHarness({ provider: createPayosAdapter({
    config: { enabled: true, clientId: 'client', apiKey: 'api', checksumKey: 'test-secret' },
  }) });
  addAttempt(harness);
  const service = serviceFor(harness);
  const data = {
    orderCode: 123456789, amount: 9000, currency: 'VND', paymentLinkId: 'link-verified-1', code: '00',
  };
  await assert.rejects(service.receivePayosWebhook({ data, signature: '0'.repeat(64) }), (error) => error.code === 'PAYOS_SIGNATURE_INVALID');
  assert.equal(harness.repository.state.events.length, 0);
  assert.equal(harness.delivered.facts.length, 0);
  assert.equal(harness.order.paymentStatus, 'pending');
});

test('a signed PayOS payment is applied once when the provider replays the same webhook', async () => {
  const harness = createPaymentHarness({ provider: createPayosAdapter({
    config: { enabled: true, clientId: 'client', apiKey: 'api', checksumKey: 'test-checksum-key' },
  }) });
  addAttempt(harness);
  const service = serviceFor(harness);
  const data = {
    orderCode: 123456789,
    amount: harness.order.totalVnd,
    currency: 'VND',
    paymentLinkId: 'link-verified-1',
    reference: 'TF-ONE-PAYMENT',
    transactionDateTime: '2026-10-06T05:00:00+07:00',
    code: '00',
  };
  const body = { data, signature: createPayosSignature(data, 'test-checksum-key') };
  const first = await service.receivePayosWebhook(body, { requestId: 'payment-test-1' });
  const replay = await service.receivePayosWebhook(body, { requestId: 'payment-test-replay' });
  assert.equal(first.applied, true);
  assert.equal(first.processingState, 'applied');
  assert.equal(replay.duplicate, true);
  assert.equal(harness.repository.state.events.length, 1);
  assert.equal(harness.delivered.facts.length, 1);
  assert.equal(harness.order.paymentStatus, 'paid');
  assert.equal(harness.repository.state.attempts[0].active, false);
  assert.equal(harness.delivered.mail.length, 1);
  assert.equal(harness.delivered.outbox.length, 1);
  assert.equal(harness.delivered.outbox[0].type, 'operations.delivery');
});

test('amount mismatch is sent to review and never confirmed as a settled order', async () => {
  const harness = createPaymentHarness();
  addAttempt(harness);
  const service = serviceFor(harness);
  const result = await service.receivePayosWebhook({ fact: verifiedFact(harness, { amountVnd: 8000 }) });
  assert.equal(result.processingState, 'review');
  assert.equal(result.reviewRequired, true);
  assert.equal(harness.order.paymentStatus, 'pending');
  assert.equal(harness.order.paymentReview.required, true);
  assert.equal(harness.repository.state.events[0].reasonCode, 'PAYMENT_AMOUNT_MISMATCH');
  assert.match(harness.delivered.mail[0].data.status, /đang được kiểm tra/u);
});

test('unknown provider order codes are recorded as rejected without creating or changing an order', async () => {
  const harness = createPaymentHarness();
  const service = serviceFor(harness);
  const result = await service.receivePayosWebhook({ fact: verifiedFact(harness, { providerOrderCode: 987654321 }) });
  assert.equal(result.processingState, 'rejected');
  assert.equal(result.reasonCode, 'PAYMENT_ATTEMPT_NOT_FOUND');
  assert.equal(harness.repository.state.events.length, 1);
  assert.equal(harness.delivered.facts.length, 0);
  assert.equal(harness.order.paymentStatus, 'pending');
});

test('late payment after reservation release is ledgered for review and does not ship the order', async () => {
  const harness = createPaymentHarness({ reservation: { status: 'released' } });
  addAttempt(harness);
  const service = serviceFor(harness);
  const result = await service.receivePayosWebhook({ fact: verifiedFact(harness) });
  assert.equal(result.processingState, 'review');
  assert.equal(result.reviewRequired, true);
  assert.equal(harness.order.paymentStatus, 'paid');
  assert.equal(harness.order.status, 'pending');
  assert.equal(harness.order.paymentReview.reasonCode, 'LATE_PAYMENT_STOCK_REVIEW');
  assert.match(harness.delivered.mail[0].data.status, /chưa được xác nhận giao/u);
});

test('provider timeout retry reuses the same persisted attempt and provider order code', async () => {
  const harness = createPaymentHarness();
  const providerCodes = [];
  let calls = 0;
  harness.provider.createLink = async (attempt) => {
    providerCodes.push(attempt.providerOrderCode);
    calls += 1;
    if (calls === 1) throw new PayosAdapterError('PAYMENT_PROVIDER_UNAVAILABLE');
    return {
      paymentLinkId: 'link-retry-1',
      checkoutUrl: 'https://pay.payos.vn/web/link-retry-1',
      status: 'pending',
    };
  };
  const service = serviceFor(harness);
  await assert.rejects(service.createPaymentAttempt({ id: 'customer-id' }, harness.orderId, validKey),
    (error) => error.code === 'PAYMENT_PROVIDER_UNAVAILABLE');
  assert.equal(harness.repository.state.attempts.length, 1);
  const attemptId = harness.repository.state.attempts[0]._id;
  const result = await service.createPaymentAttempt({ id: 'customer-id' }, harness.orderId, validKey);
  assert.equal(result.checkoutUrl, 'https://pay.payos.vn/web/link-retry-1');
  assert.equal(harness.repository.state.attempts.length, 1);
  assert.equal(harness.repository.state.attempts[0]._id, attemptId);
  assert.deepEqual(providerCodes, [123456789, 123456789]);
});

test('full refund approval and recorded failure restore the paid aggregate', async () => {
  const harness = createPaymentHarness({ order: { paymentStatus: 'paid', paidAmountVnd: 9000 } });
  const service = serviceFor(harness);
  const requested = await service.createRefundRequest(
    { id: 'dddddddddddddddddddddddd', role: 'staff' },
    harness.orderId,
    { amountVnd: 9000, reason: 'Khách đã xác nhận hủy đơn', expectedVersion: 0 },
    'staff-refund-idempotency-key-01',
    { requestId: 'refund-test-1' },
  );
  await assert.rejects(service.createRefundRequest(
    { id: 'dddddddddddddddddddddddd', role: 'staff' },
    harness.orderId,
    { amountVnd: 4500, reason: 'Một phần', expectedVersion: 0 },
    'staff-refund-idempotency-key-02',
  ), (error) => error.code === 'PARTIAL_OPERATION_DISABLED');
  const approved = await service.decideRefund(
    { id: 'eeeeeeeeeeeeeeeeeeeeeeee', role: 'admin' }, requested.id,
    { decision: 'approved', reason: 'Đã kiểm tra', expectedVersion: 0 },
  );
  assert.equal(approved.status, 'approved');
  assert.equal(harness.order.paymentStatus, 'refund_pending');
  const failed = await service.failRefund(requested.id, 'MANUAL_REFUND_FAILED', { requestId: 'refund-fail-test' });
  assert.equal(failed.status, 'failed');
  assert.equal(harness.order.paymentStatus, 'paid');
  assert.equal(harness.order.refundedAmountVnd, 0);
  assert.equal(harness.delivered.mail.at(-1).data.status, 'Yêu cầu hoàn tiền không hoàn tất và đã được gỡ khỏi số dư chờ xử lý');
});

test('a completed manual refund changes the aggregate only after both evidence fields are recorded', async () => {
  const harness = createPaymentHarness({ order: { paymentStatus: 'paid', paidAmountVnd: 9000 } });
  const service = serviceFor(harness);
  const requested = await service.createRefundRequest(
    { id: 'dddddddddddddddddddddddd', role: 'staff' }, harness.orderId,
    { amountVnd: 9000, reason: 'Đơn được hủy theo yêu cầu', expectedVersion: 0 },
    'manual-refund-complete-key-001',
  );
  await service.decideRefund(
    { id: 'eeeeeeeeeeeeeeeeeeeeeeee', role: 'admin' }, requested.id,
    { decision: 'approved', reason: 'Đã duyệt hoàn', expectedVersion: 0 },
  );
  const completed = await service.completeRefund(
    { id: 'eeeeeeeeeeeeeeeeeeeeeeee', role: 'admin' }, requested.id,
    { externalReference: 'BANK-REF-20261006', evidenceReference: 'internal-evidence-001', expectedVersion: 1 },
  );
  assert.equal(completed.status, 'completed');
  assert.equal(completed.externalReference, 'BANK-REF-20261006');
  assert.equal(completed.evidenceReference, 'internal-evidence-001');
  assert.equal(harness.order.paymentStatus, 'refunded');
  assert.equal(harness.order.refundedAmountVnd, 9000);
  assert.equal(harness.delivered.mail.at(-1).data.status, 'Khoản hoàn tiền đã được ghi nhận');
});

test('concurrent full refund requests cannot reserve more than the paid balance', async () => {
  const harness = createPaymentHarness({ order: { paymentStatus: 'paid', paidAmountVnd: 9000 } });
  const service = serviceFor(harness);
  const request = (requestKey) => service.createRefundRequest(
    { id: 'dddddddddddddddddddddddd', role: 'staff' }, harness.orderId,
    { amountVnd: 9000, reason: 'Yêu cầu hoàn toàn bộ', expectedVersion: 0 }, requestKey,
  );
  const outcomes = await Promise.allSettled([
    request('staff-refund-concurrent-key-001'),
    request('staff-refund-concurrent-key-002'),
  ]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(harness.repository.state.refunds.length, 1);
  assert.equal(harness.repository.state.refunds[0].amountVnd, 9000);
});

test('paid guest cancellation creates a refund request without inventing a user ID', async () => {
  const harness = createPaymentHarness({ order: {
    userId: undefined,
    paymentStatus: 'paid',
    paidAmountVnd: 9000,
  } });
  const service = serviceFor(harness);
  const refund = await service.requestOrderCancellationRefund({
    orderId: harness.orderId,
    amountVnd: 9000,
    reason: 'Khách đã hủy đơn đang chờ xử lý',
    actor: { orderId: harness.orderId, role: 'guest' },
    requestKey: 'guest-cancel-refund-key-0001',
    requestId: 'guest-cancel-1',
  }, { session: { testSession: true } });
  const stored = harness.repository.state.refunds[0];
  assert.equal(refund.status, 'requested');
  assert.equal(Object.hasOwn(stored, 'requestedBy'), false);
  assert.equal(stored.requesterType, 'guest');
  assert.equal(Object.hasOwn(refund, 'requestedBy'), false);
  assert.equal(harness.delivered.audit[0].actorRole, 'system');
  assert.equal(harness.delivered.mail.length, 1);
});

test('payment cancellation refund port fails closed outside the caller transaction', async () => {
  const harness = createPaymentHarness({ order: { paymentStatus: 'paid', paidAmountVnd: 9000 } });
  const service = serviceFor(harness);
  await assert.rejects(service.requestOrderCancellationRefund({
    orderId: harness.orderId, amountVnd: 9000, reason: 'Hủy',
    actor: { id: 'dddddddddddddddddddddddd', role: 'customer' }, requestKey: validKey,
  }), /bên trong transaction/u);
});
