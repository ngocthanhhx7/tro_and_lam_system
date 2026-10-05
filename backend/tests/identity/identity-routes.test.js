import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createIdentityRouter } from '../../src/routes/identity/identity.routes.js';
import { hashPassword } from '../../src/services/identity/identity.security.js';
import { FakeIdentityRepository } from './fakes/identity-repository.fake.js';

const origin = 'http://localhost:5173';
const secret = 'route-tests-csrf-secret-more-than-thirty-two-characters';

function createFixture() {
  const repository = new FakeIdentityRepository();
  const mail = [];
  const app = createApp({
    corsOrigin: origin,
    domainRouters: [{ router: createIdentityRouter({
      ports: {
        repository,
        outbox: { async enqueueMail(template, to, variables) { mail.push({ template, to, variables }); return { queued: true }; } },
        audit: { async appendAudit(event) { return event; } },
      },
      config: { csrfSecret: secret, publicWebUrl: origin, allowedOrigins: [origin], secureCookies: false },
    }) }],
  });
  return { app, repository, mail };
}

async function tokenFor(agent) {
  const response = await agent.get('/api/v1/auth/csrf').set('Origin', origin).expect(200);
  assert.ok(response.body.data.csrfToken);
  return response.body.data.csrfToken;
}

test('identity routes require CSRF, set opaque HttpOnly sessions, and keep blocked access restricted', async () => {
  const { app, repository, mail } = createFixture();
  const browser = request.agent(app);
  let csrf = await tokenFor(browser);

  await browser.post('/api/v1/auth/register').set('Origin', origin).set('X-CSRF-Token', csrf).send({
    name: 'An Nguyễn', email: 'an@example.test', password: 'Correct Horse Battery Staple 42!', role: 'admin',
  }).expect(400);
  const registration = await browser.post('/api/v1/auth/register').set('Origin', origin).set('X-CSRF-Token', csrf).send({
    name: 'An Nguyễn', email: 'an@example.test', password: 'Correct Horse Battery Staple 42!',
  }).expect(202);
  assert.deepEqual(registration.body.data, { verificationRequired: true });
  assert.equal(repository.users[0].role, 'customer');

  const token = new URLSearchParams(new URL(mail[0].variables.link).hash.slice(1)).get('token');
  await browser.post('/api/v1/auth/verify-email').set('Origin', origin).set('X-CSRF-Token', csrf).send({ token }).expect(200);
  const login = await browser.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf).send({
    email: 'an@example.test', password: 'Correct Horse Battery Staple 42!',
  }).expect(200);
  assert.equal(login.body.data.user.role, 'customer');
  const sessionCookie = login.headers['set-cookie'].find((cookie) => cookie.startsWith('tl_session='));
  assert.match(sessionCookie, /HttpOnly/u);
  assert.match(sessionCookie, /Path=\/api\/v1/u);
  assert.equal(sessionCookie.includes(login.body.data.user.id), false);
  await browser.get('/api/v1/auth/me').set('Origin', origin).expect(200);
  await browser.get('/api/v1/admin/users').set('Origin', origin).expect(403);
  await browser.post('/api/v1/auth/logout').set('Origin', origin).set('X-CSRF-Token', csrf).send({}).expect(204);
  await browser.get('/api/v1/auth/me').set('Origin', origin).expect(401);

  const noCsrf = request.agent(app);
  await noCsrf.post('/api/v1/auth/login').set('Origin', origin).send({ email: 'an@example.test', password: 'wrong' }).expect(403);

  const blocked = await repository.createUser({
    name: 'Chi', emailNormalized: 'chi@example.test',
    passwordHash: await hashPassword('Correct Horse Battery Staple 42!'), role: 'customer', status: 'blocked',
    emailVerifiedAt: new Date(), authVersion: 1, version: 0,
  });
  const restrictedBrowser = request.agent(app);
  csrf = await tokenFor(restrictedBrowser);
  const blockedLogin = await restrictedBrowser.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf).send({
    email: blocked.emailNormalized, password: 'Correct Horse Battery Staple 42!',
  }).expect(403);
  assert.equal(blockedLogin.body.error.code, 'ACCOUNT_BLOCKED');
  const proofCookie = blockedLogin.headers['set-cookie'].find((cookie) => cookie.startsWith('tl_appeal='));
  assert.match(proofCookie, /HttpOnly/u);
  assert.equal(blockedLogin.body.data, undefined);
  await restrictedBrowser.get('/api/v1/account/appeals/current').set('Origin', origin).expect(200);
  await restrictedBrowser.get('/api/v1/auth/me').set('Origin', origin).expect(401);
  await restrictedBrowser.post('/api/v1/account/appeals').set('Origin', origin).set('X-CSRF-Token', csrf).send({ message: 'Xin xem xét.' }).expect(201);
});
