import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createCommerceRouter } from '../../src/routes/commerce/commerce.routes.js';
import { errorHandler } from '../../src/middlewares/error.middleware.js';
import { ServiceError } from '../../src/utils/serviceError.js';

const secret = 'commerce-route-tests-challenge-secret-0123456789';
const ORDER_ID = '507f1f77bcf86cd799439011';

function createFixture(overrides = {}) {
  const calls = [];
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => { res.locals.requestId = 'request-commerce-route-test'; next(); });
  const service = {
    async quoteCheckout(actor, body) { calls.push({ name: 'quoteCheckout', actor, body }); return { totalVnd: 200000 }; },
    async createOrder(actor, body, key, context) {
      calls.push({ name: 'createOrder', actor, body, key, context });
      return {
        order: { id: ORDER_ID, code: 'TL-ROUTE-TEST', status: 'pending', paymentStatus: 'pending', totalVnd: 200000 },
        payment: { status: 'pending', retryable: false },
        guestAccess: { expiresAt: '2026-10-06T01:00:00.000Z' },
        guestProofToken: 'opaque-guest-proof-token',
      };
    },
    async getOwnedOrder(actor, id) { calls.push({ name: 'getOwnedOrder', actor, id }); return { id, code: 'TL-OWNED', recipient: { email: 'owner@example.com' } }; },
    async issueOrderAccessChallenge(body, context) { calls.push({ name: 'issueChallenge', body, context }); return { accepted: true, challengeId: 'safe-random-challenge-id' }; },
    async verifyOrderAccessChallenge(_body) { return { orderId: ORDER_ID, expiresAt: new Date('2026-10-06T01:00:00.000Z'), proofToken: 'verified-guest-proof-token' }; },
    async listOwnOrders() { return { items: [], total: 0 }; },
    async listStaffOrders() { return { items: [], total: 0 }; },
    async getOperationalOrder(id) { return { id }; },
    async cancelOwnedOrder() { return {}; },
    async claimGuestOrder() { return {}; },
    async transitionOrder() { return {}; },
    async recordShippingEvent() { return {}; },
    async collectCod() { return {}; },
    async adjustInventory() { return {}; },
  };
  const identity = {
    csrfProtection: (_req, _res, next) => next(),
    requireActor: (_req, _res, next) => next(),
    requireCapability: () => (_req, _res, next) => next(),
  };
  const ports = {
    identity,
    commerceService: service,
    resolveActor: async () => undefined,
    resolveOrderActor: async (req, id) => {
      calls.push({ name: 'resolveOrderActor', id, authKind: req.get('X-Test-Auth') });
      if (req.get('X-Test-Auth') === 'blocked') throw new ServiceError(403, 'ACCOUNT_BLOCKED', 'Tài khoản đang bị khóa');
      if (req.get('X-Test-Auth') === 'owner') return { id: '507f1f77bcf86cd799439099', role: 'customer' };
      return { orderId: id };
    },
    ...overrides,
  };
  const router = createCommerceRouter({ ports, config: { challengeSecret: secret, secureCookies: false } });
  app.use('/api/v1', router);
  app.use(errorHandler);
  return { app, calls };
}

test('guest checkout sets a scoped HttpOnly proof cookie and removes the token from JSON', async () => {
  const { app, calls } = createFixture();
  const response = await request(app).post('/api/v1/orders')
    .set('Idempotency-Key', 'commerce-route-idempotency-key-1234567890')
    .send({
      items: [{ productId: ORDER_ID, quantity: 1 }], paymentMethod: 'cod', consent: true,
      recipient: {
        recipientName: 'Nguyễn An', email: 'owner@example.com', phone: '0900000000', line1: '12 Đường Gốm',
        countryCode: 'VN', formattedAddress: '12 Đường Gốm, Hải Dương',
      },
    }).expect(201);

  assert.equal(response.body.data.order.id, ORDER_ID);
  assert.equal(Object.hasOwn(response.body.data, 'guestProofToken'), false);
  assert.equal(response.headers['set-cookie'][0].includes('HttpOnly'), true);
  assert.equal(response.headers['set-cookie'][0].includes('Path=/api/v1'), true);
  assert.equal(calls.find((call) => call.name === 'createOrder').key, 'commerce-route-idempotency-key-1234567890');
});

test('blocked full authentication is not downgraded to guest order proof', async () => {
  const { app, calls } = createFixture();
  const response = await request(app).get(`/api/v1/orders/${ORDER_ID}`).set('X-Test-Auth', 'blocked').expect(403);

  assert.equal(response.body.error.code, 'ACCOUNT_BLOCKED');
  assert.equal(calls.some((call) => call.name === 'getOwnedOrder'), false);
});

test('guest order reads are bound to the exact resolved order proof', async () => {
  const { app, calls } = createFixture();
  const response = await request(app).get(`/api/v1/orders/${ORDER_ID}`).expect(200);

  assert.equal(response.body.data.id, ORDER_ID);
  const call = calls.find((entry) => entry.name === 'getOwnedOrder');
  assert.equal(call.id, ORDER_ID);
  assert.equal(call.actor.orderId, ORDER_ID);
});
