import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnv } from '../src/validators/env.validator.js';

const valid = { MONGODB_URI: 'mongodb://localhost:27017/tro_lam' };
test('valid configuration has development defaults', () => {
  assert.equal(validateEnv(valid).port, 5000);
});
test('missing database configuration fails', () => {
  assert.throws(() => validateEnv({}), /MONGODB_URI/);
});
test('placeholder Atlas credentials fail', () => {
  assert.throws(() => validateEnv({ MONGODB_URI: 'mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/tro_lam' }), /MONGODB_URI/);
});
test('invalid ports fail', () => {
  for (const port of ['abc', '0', '65536', '1.5']) assert.throws(() => validateEnv({ ...valid, PORT: port }), /PORT/);
});
test('production requires an explicit CORS origin', () => {
  assert.throws(() => validateEnv({ ...valid, NODE_ENV: 'production' }), /CORS_ORIGIN/);
});
test('origin rejects paths and invalid proxy setting', () => {
  assert.throws(() => validateEnv({ ...valid, CORS_ORIGIN: 'https://example.com/path' }), /CORS_ORIGIN/);
  assert.throws(() => validateEnv({ ...valid, TRUST_PROXY: '5' }), /TRUST_PROXY/);
});

test('CORS allowlist accepts comma-separated exact origins', () => {
  const config = validateEnv({ ...valid, CORS_ORIGIN: 'https://store.example, https://admin.example' });
  assert.equal(config.corsOrigin, 'https://store.example, https://admin.example');
  assert.throws(() => validateEnv({ ...valid, CORS_ORIGIN: 'https://store.example/path, https://admin.example' }), /origin/);
});
