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
  assert.equal(Buffer.from(config.outboxEncryptionKey, 'base64').length, 32);
  assert.equal(config.smtpConfigured, false);
  assert.equal(config.payosEnabled, false);
  assert.equal(config.aiDailyBudget, 0);
  assert.equal(config.backgroundWorkersEnabled, true);
  assert.equal(config.reservationSweepIntervalMs, 30_000);
  assert.equal(config.paymentReconciliationIntervalMs, 60_000);
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
  const configured = {
    ...production,
    CSRF_SECRET: 'a'.repeat(48),
    PUBLIC_WEB_URL: 'https://store.example',
    OUTBOX_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  };
  assert.equal(validateEnv(configured).secureCookies, true);
  assert.throws(() => validateEnv({ ...configured, PUBLIC_WEB_URL: 'http://store.example' }), /PUBLIC_WEB_URL/);
  assert.throws(() => validateEnv({ ...configured, SECURE_COOKIES: 'false' }), /SECURE_COOKIES/);
});

test('provider config stays disabled until complete credentials are supplied', () => {
  const smtp = validateEnv({
    ...valid,
    SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', SMTP_SECURE: 'false',
    SMTP_USER: 'mailer', SMTP_PASSWORD: 'private', SMTP_FROM: 'orders@example.com',
  });
  assert.equal(smtp.smtpConfigured, true);
  assert.equal(smtp.smtpPort, 587);
  assert.equal(smtp.smtpSecure, false);
  assert.throws(() => validateEnv({ ...valid, SMTP_HOST: 'smtp.example.com' }), /đầy đủ/);

  assert.equal(validateEnv({ ...valid, GEMINI_MODEL: 'gemini-3.8-flash-high' }).geminiApiKey, '');
  assert.equal(validateEnv({ ...valid, AI_DAILY_BUDGET: '0' }).aiDailyBudget, 0);
  assert.throws(() => validateEnv({ ...valid, AI_DAILY_BUDGET: '-1' }), /AI_DAILY_BUDGET/);
  assert.throws(() => validateEnv({ ...valid, PAYOS_ENABLED: 'true' }), /PAYOS_ENABLED/);
});

test('outbox encryption key validation requires 32 bytes and production key', () => {
  assert.throws(() => validateEnv({ ...valid, OUTBOX_ENCRYPTION_KEY: 'not-a-key' }), /OUTBOX_ENCRYPTION_KEY/);
  assert.throws(() => validateEnv({
    ...valid, NODE_ENV: 'production', CORS_ORIGIN: 'https://store.example',
    CSRF_SECRET: 'a'.repeat(48), PUBLIC_WEB_URL: 'https://store.example',
  }), /OUTBOX_ENCRYPTION_KEY/);
});

test('background worker configuration validates enablement and polling intervals', () => {
  assert.equal(validateEnv({ ...valid, BACKGROUND_WORKERS_ENABLED: 'false' }).backgroundWorkersEnabled, false);
  assert.throws(() => validateEnv({ ...valid, BACKGROUND_WORKERS_ENABLED: 'sometimes' }), /BACKGROUND_WORKERS_ENABLED/);
  assert.throws(() => validateEnv({ ...valid, RESERVATION_SWEEP_INTERVAL_MS: '999' }), /RESERVATION_SWEEP_INTERVAL_MS/);
  assert.throws(() => validateEnv({ ...valid, PAYMENT_RECONCILIATION_INTERVAL_MS: '3600001' }), /PAYMENT_RECONCILIATION_INTERVAL_MS/);
});

test('cookie names and SameSite settings are validated', () => {
  assert.throws(() => validateEnv({ ...valid, SESSION_COOKIE_NAME: 'bad;name' }), /SESSION_COOKIE_NAME/);
  assert.throws(() => validateEnv({ ...valid, COOKIE_SAME_SITE: 'CrossSite' }), /COOKIE_SAME_SITE/);
  assert.throws(() => validateEnv({ ...valid, COOKIE_SAME_SITE: 'None' }), /SameSite=None/);
  assert.equal(validateEnv({ ...valid, COOKIE_SAME_SITE: 'None', SECURE_COOKIES: 'true' }).sameSite, 'None');
});
