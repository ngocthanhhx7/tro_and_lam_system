import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnv } from '../src/validators/env.validator.js';

const valid = { MONGODB_URI: 'mongodb://localhost:27017/tro_lam' };
test('valid configuration has development defaults', () => {
  const config = validateEnv(valid);
  assert.equal(config.port, 5000);
  assert.equal(config.publicWebUrl, 'http://localhost:5173');
  assert.equal(config.sameSite, 'Lax');
  assert.equal(config.secureCookies, false);
  assert.equal(config.guestOrderCookieName, 'tl_guest_order');
  assert.ok(config.csrfSecret.length >= 32);
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

test('production requires CSRF secret, HTTPS web origin, and secure cookies', () => {
  const production = { ...valid, NODE_ENV: 'production', CORS_ORIGIN: 'https://store.example' };
  assert.throws(() => validateEnv(production), /CSRF_SECRET/);
  const configured = { ...production, CSRF_SECRET: 'a'.repeat(48), PUBLIC_WEB_URL: 'https://store.example' };
  assert.equal(validateEnv(configured).secureCookies, true);
  assert.throws(() => validateEnv({ ...configured, PUBLIC_WEB_URL: 'http://store.example' }), /PUBLIC_WEB_URL/);
  assert.throws(() => validateEnv({ ...configured, SECURE_COOKIES: 'false' }), /SECURE_COOKIES/);
});

test('cookie names and SameSite settings are validated', () => {
  assert.throws(() => validateEnv({ ...valid, SESSION_COOKIE_NAME: 'bad;name' }), /SESSION_COOKIE_NAME/);
  assert.throws(() => validateEnv({ ...valid, COOKIE_SAME_SITE: 'CrossSite' }), /COOKIE_SAME_SITE/);
  assert.throws(() => validateEnv({ ...valid, COOKIE_SAME_SITE: 'None' }), /SameSite=None/);
  assert.equal(validateEnv({ ...valid, COOKIE_SAME_SITE: 'None', SECURE_COOKIES: 'true' }).sameSite, 'None');
});
