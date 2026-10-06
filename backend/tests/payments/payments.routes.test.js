import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createPaymentsRouter } from '../../src/routes/payments/payments.routes.js';
import { ServiceError } from '../../src/utils/serviceError.js';

const orderId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const refundId = 'cccccccccccccccccccccccc';

function setup({ resolveOrderActor, permissions = {} } = {}) {
  const calls = { attempts: [], statuses: [], refunds: [], decisions: [] };
  const identity = {
    csrfProtection: (_req, _res, next) => next(),
    requireCapability(capability) {
      return (req, _res, next) => {
        const actor = req.get('X-Test-Actor') || '';
        const allowed = permissions[actor]?.includes(capability);
        if (!allowed) return next(new ServiceError(403, 'FORBIDDEN', 'Không có quyền'));
        req.actor = { id: 'dddddddddddddddddddddddd', role: actor };
        return next();
      };
    },
  };
  const paymentsService = {
    async createPaymentAttempt(actor, id, key) { calls.attempts.push({ actor, id, key }); return { attemptId: 'attempt-1', status: 'pending' }; },
    async paymentStatus(actor, id) { calls.statuses.push({ actor, id }); return { paymentStatus: 'pending', paidAmountVnd: 0, refundedAmountVnd: 0, reviewRequired: false }; },
    async receivePayosWebhook() { return { duplicate: false }; },
    async createRefundRequest(actor, id, body, key) { calls.refunds.push({ actor, id, body, key }); return { id: 'refund-1', status: 'requested' }; },
    async listRefunds() { return { items: [], total: 0 }; },
    async decideRefund(actor, id, body) { calls.decisions.push({ actor, id, body }); return { id, status: body.decision }; },
    async completeRefund() { return { id: refundId, status: 'completed' }; },
  };
  const router = createPaymentsRouter({ ports: { identity, resolveOrderActor, paymentsService } });
  const app = createApp({
    corsOrigin: 'http://localhost:5173',
    isDatabaseReady: () => true,
    domainRouters: [{ router }],
  });
  return { app, calls };
}

test('blocked full session is propagated by P02 resolver and is never retried as guest proof', async () => {
  let resolverCalls = 0;
  const { app, calls } = setup({ resolveOrderActor: async () => {
    resolverCalls += 1;
    throw new ServiceError(403, 'ACCOUNT_BLOCKED', 'Tài khoản đang bị khóa');
  } });
  const response = await request(app).get(`/api/v1/orders/${orderId}/payment`);
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'ACCOUNT_BLOCKED');
  assert.equal(resolverCalls, 1);
  assert.equal(calls.statuses.length, 0);
});

test('missing order actor is a 404 and prevents payment service reads', async () => {
  const { app, calls } = setup({ resolveOrderActor: async () => undefined });
  const response = await request(app).get(`/api/v1/orders/${orderId}/payment`);
  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
  assert.equal(calls.statuses.length, 0);
});

test('guest payment attempt uses the scoped P02 actor and idempotency key', async () => {
  const guest = { role: 'guest', orderId };
  const { app, calls } = setup({ resolveOrderActor: async (_req, id) => id === orderId ? guest : undefined });
  const response = await request(app).post(`/api/v1/orders/${orderId}/payment-attempts`)
    .set('Idempotency-Key', 'guest-payment-attempt-key-0001')
    .send({});
  assert.equal(response.status, 201);
  assert.deepEqual(calls.attempts, [{ actor: guest, id: orderId, key: 'guest-payment-attempt-key-0001' }]);
});

test('staff can request refunds while customer capability cannot', async () => {
  const permissions = { staff: ['refunds.request'], customer: [] };
  const { app, calls } = setup({ permissions, resolveOrderActor: async () => undefined });
  const body = { amountVnd: 9000, reason: 'Khách xác nhận hủy đơn', expectedVersion: 1 };
  const denied = await request(app).post(`/api/v1/staff/orders/${orderId}/refund-requests`)
    .set('X-Test-Actor', 'customer')
    .set('Idempotency-Key', 'customer-refund-request-key-01')
    .send(body);
  const accepted = await request(app).post(`/api/v1/staff/orders/${orderId}/refund-requests`)
    .set('X-Test-Actor', 'staff')
    .set('Idempotency-Key', 'staff-refund-request-key-0001')
    .send(body);
  assert.equal(denied.status, 403);
  assert.equal(accepted.status, 201);
  assert.equal(calls.refunds.length, 1);
  assert.equal(calls.refunds[0].actor.role, 'staff');
});
