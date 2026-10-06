import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { sendCreated } from '../src/utils/apiResponse.js';
import { ServiceError } from '../src/utils/serviceError.js';

test('domain success responses use the frozen envelope and server request ID', async () => {
  const router = (_req, res) => sendCreated(res, { id: 'resource-1' }, { meta: { requestId: 'caller-controlled' } });
  const response = await request(createApp({ domainRouters: [{ prefix: '/test', router }] })).post('/api/v1/test');

  assert.equal(response.status, 201);
  assert.deepEqual(response.body.data, { id: 'resource-1' });
  assert.match(response.body.meta.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(response.headers['x-request-id'], response.body.meta.requestId);
  assert.notEqual(response.body.meta.requestId, 'caller-controlled');
});

test('validation errors include bounded field details and request ID', async () => {
  const router = (_req, _res, next) => next(new ServiceError(422, 'VALIDATION_ERROR', 'Dữ liệu chưa hợp lệ', [
    { field: 'recipient.phone', code: 'INVALID_PHONE', message: 'Số điện thoại chưa hợp lệ' },
  ]));
  const response = await request(createApp({ domainRouters: [{ prefix: '/test', router }] })).post('/api/v1/test');

  assert.equal(response.status, 422);
  assert.deepEqual(response.body.error.details, [
    { field: 'recipient.phone', code: 'INVALID_PHONE', message: 'Số điện thoại chưa hợp lệ' },
  ]);
  assert.equal(response.headers['x-request-id'], response.body.meta.requestId);
});

test('rate limit responses keep the standard error envelope', async () => {
  const app = createApp();
  let response;
  for (let attempt = 0; attempt < 101; attempt += 1) {
    response = await request(app).get('/api/v1/missing');
  }

  assert.equal(response.status, 429);
  assert.equal(response.body.error.code, 'RATE_LIMITED');
  assert.ok(response.body.meta.requestId);
  assert.equal(response.headers['x-request-id'], response.body.meta.requestId);
});

test('isolated app instances can set a bounded global API rate limit', async () => {
  const app = createApp({ apiRateLimitLimit: 1, apiRateLimitWindowMs: 60_000 });
  const first = await request(app).get('/api/v1/missing');
  const second = await request(app).get('/api/v1/missing');

  assert.equal(first.status, 404);
  assert.equal(second.status, 429);
  assert.equal(second.body.error.code, 'RATE_LIMITED');
});

test('global API rate limit configuration rejects invalid values', () => {
  assert.throws(() => createApp({ apiRateLimitLimit: 0 }), /positive safe integer/u);
  assert.throws(() => createApp({ apiRateLimitWindowMs: -1 }), /positive safe integer/u);
});
