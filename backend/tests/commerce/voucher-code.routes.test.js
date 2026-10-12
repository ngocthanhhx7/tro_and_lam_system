import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createVoucherRouter } from '../../src/routes/voucher.routes.js';
test('voucher code lookup requires a customer, CSRF and a strict code body', async () => {
  const calls = [];
  const app = express();
  app.use(express.json());
  app.use(createVoucherRouter({ identity: {
    requireActor() {},
    requireCapability: () => (req, res, next) => {
      if (!req.get('test-role')) return res.sendStatus(401);
      if (req.get('test-role') !== 'customer') return res.sendStatus(403);
      req.actor = { id: 'customer-owned-id' }; next();
    },
    csrfProtection: (req, res, next) => req.get('test-csrf') === 'valid' ? next() : res.sendStatus(403),
  }, service: { resolveCode: async (userId, code) => { calls.push({ userId, code }); return { id: 'voucher-id', code: 'SAVE10' }; } } }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ code: error.code }));
  const path = '/account/vouchers/resolve';
  await request(app).post(path).send({ code: 'SAVE10' }).expect(401);
  await request(app).post(path).set('test-role', 'staff').send({ code: 'SAVE10' }).expect(403);
  await request(app).post(path).set('test-role', 'customer').send({ code: 'SAVE10' }).expect(403);
  for (const body of [{ code: 'ab' }, { code: 'SAVE10', userId: 'other' }, { code: '$invalid' }]) {
    await request(app).post(path).set('test-role', 'customer').set('test-csrf', 'valid').send(body).expect(400);
  }
  assert.equal(calls.length, 0);
  const response = await request(app).post(path).set('test-role', 'customer').set('test-csrf', 'valid').send({ code: ' save10 ' }).expect(200);
  assert.equal(response.body.data.code, 'SAVE10');
  assert.deepEqual(calls, [{ userId: 'customer-owned-id', code: ' save10 ' }]);
});
