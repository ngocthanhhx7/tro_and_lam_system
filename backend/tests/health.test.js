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
});
test('CORS grants configured origin and not an unrelated origin', async () => {
  const app = createApp({ corsOrigin: 'https://tro-lam.example' });
  for (const origin of ['https://tro-lam.example', 'https://unrelated.example']) {
    const res = await request(app).get('/api/v1/health').set('Origin', origin);
    assert.equal(res.headers['access-control-allow-origin'], 'https://tro-lam.example');
  }
});
test('oversized JSON returns 413 without internal details', async () => {
  const res = await request(createApp()).post('/api/v1/missing').send({ value: 'x'.repeat(110000) });
  assert.equal(res.status, 413);
  assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
  assert.equal(res.body.error.stack, undefined);
});
test('malformed JSON returns 400 without parser details', async () => {
  const res = await request(createApp()).post('/api/v1/missing').set('Content-Type', 'application/json').send('{broken');
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'BAD_REQUEST');
});
