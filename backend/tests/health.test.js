import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('liveness works independently of MongoDB', async () => {
  const res = await request(createApp({ isDatabaseReady: () => false })).get('/api/v1/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
  assert.equal(res.headers['x-powered-by'], undefined);
});
test('formal live probe keeps the legacy health shape', async () => {
  const res = await request(createApp({ isDatabaseReady: () => false })).get('/api/v1/health/live');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});
test('readiness returns 503 while MongoDB is disconnected', async () => {
  const res = await request(createApp({ isDatabaseReady: () => false })).get('/api/v1/health/ready');
  assert.equal(res.status, 503);
  assert.equal(res.body.database, 'disconnected');
});
test('readiness returns 200 when MongoDB is connected', async () => {
  const res = await request(createApp({ isDatabaseReady: () => true })).get('/api/v1/health/ready');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ready');
});
test('unknown routes return JSON 404', async () => {
  const res = await request(createApp()).get('/api/v1/missing');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
  assert.match(res.body.meta.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(res.headers['x-request-id'], res.body.meta.requestId);
});
test('CORS grants configured origin and rejects unrelated origins', async () => {
  const app = createApp({ corsOrigin: 'https://tro-lam.example' });
  const accepted = await request(app).get('/api/v1/health').set('Origin', 'https://tro-lam.example');
  assert.equal(accepted.headers['access-control-allow-origin'], 'https://tro-lam.example');
  assert.equal(accepted.headers['access-control-allow-credentials'], 'true');
  const rejected = await request(app).get('/api/v1/health').set('Origin', 'https://unrelated.example');
  assert.equal(rejected.status, 403);
  assert.equal(rejected.body.error.code, 'CORS_ORIGIN_DENIED');
  assert.equal(rejected.headers['access-control-allow-origin'], undefined);
});
test('oversized JSON returns 413 without internal details', async () => {
  const res = await request(createApp()).post('/api/v1/missing').send({ value: 'x'.repeat(110000) });
  assert.equal(res.status, 413);
  assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
  assert.equal(res.body.error.stack, undefined);
  assert.ok(res.body.meta.requestId);
});
test('malformed JSON returns 400 without parser details', async () => {
  const res = await request(createApp()).post('/api/v1/missing').set('Content-Type', 'application/json').send('{broken');
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'BAD_REQUEST');
  assert.ok(res.body.meta.requestId);
});

test('unexpected failures return a generic message and redact stack details', async () => {
  const app = createApp({ domainRouters: [{ prefix: '/fault-test', router: Object.assign(
    (req, res, next) => next(new Error('private provider credential')), { stack: 'private stack' },
  ) }] });
  const res = await request(app).get('/api/v1/fault-test');
  assert.equal(res.status, 500);
  assert.deepEqual(res.body.error, { code: 'INTERNAL_ERROR', message: 'Lỗi máy chủ' });
  assert.equal(JSON.stringify(res.body).includes('private provider credential'), false);
  assert.equal(JSON.stringify(res.body).includes('stack'), false);
});
