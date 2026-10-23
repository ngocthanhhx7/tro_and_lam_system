import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createAccountRouter } from '../../src/routes/account/account.routes.js';
import { csrfValue } from '../../src/services/identity/identity.security.js';
import { ServiceError } from '../../src/utils/serviceError.js';

const SECRET = 'test-only-csrf-secret-that-is-long-enough-123456';
const ORIGIN = 'http://localhost:5173';
const USER_A = '111111111111111111111111';
const USER_B = '222222222222222222222222';
const SESSION_A = 'session-a';
const SESSION_B = 'session-b';
const GUEST_TOKEN = 'guest-cart-token-secret-value-0123456789';

test('reverse geocoding limits one customer without consuming another customer allowance', async () => {
  const { app, csrf, accountService } = makeApp();
  let calls = 0;
  accountService.reverseGeocode = async () => { calls += 1; return { suggestedAddress: { line1: 'Synthetic address' } }; };
  const locate = token => request(app).post('/api/v1/locations/reverse')
    .set('Origin', ORIGIN).set('Cookie', `tl_session=${token}; tl_csrf=${encodeURIComponent(csrf)}`)
    .set('X-CSRF-Token', csrf).send({ lat: 21, lng: 105 });
  await locate(SESSION_A).expect(200);
  await locate(SESSION_A).expect(429);
  await locate(SESSION_B).expect(200);
  assert.equal(calls, 2);
});

function makeApp() {
  const csrf = csrfValue('n'.repeat(32), SECRET);
  const merges = [];
  const owners = new Map([[USER_A, new Map()], [USER_B, new Map()]]);
  const identityService = {
    async authenticateSession(token) {
      if (token === SESSION_A) return { id: USER_A, role: 'customer', status: 'active' };
      if (token === SESSION_B) return { id: USER_B, role: 'customer', status: 'active' };
      throw new ServiceError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập');
    },
  };
  const accountService = {
    async guestCartWasMerged() { return false; },
    async getCart(actor) {
      const owner = actor.kind === 'guest' ? actor.guestTokenHash : actor.id;
      return { owner, version: 0, items: [] };
    },
    async mergeGuestCart(actor, tokenHash, expectedVersion) {
      merges.push({ actor, tokenHash, expectedVersion });
      return { owner: actor.id, version: 1, items: [], adjustments: [] };
    },
    async listAddresses(actor) { return [...owners.get(actor.id).values()]; },
    async updateAddress(actor, id) {
      const address = owners.get(actor.id).get(id);
      if (!address) throw new ServiceError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên');
      return address;
    },
    async createAddress(actor, input) {
      const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
      const address = { ...input, id, version: 0, isDefault: true };
      owners.get(actor.id).set(id, address);
      return address;
    },
    async deleteAddress() {},
    async setDefaultAddress() {},
    async reverseGeocode() { throw new ServiceError(503, 'GEO_UNAVAILABLE', 'Chưa cấu hình'); },
  };
  const router = createAccountRouter({ ports: { identityService, accountService }, config: { csrfSecret: SECRET, secureCookies: false } });
  const app = express();
  app.use(express.json());
  app.use('/api/v1', router);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: { code: error.code, message: error.message } }));
  return { app, csrf, merges, owners, accountService };
}

test('guest cart cookies are opaque, HttpOnly and isolate two guest actors', async () => {
  const { app } = makeApp();
  const guestA = request.agent(app);
  const guestB = request.agent(app);
  const firstA = await guestA.get('/api/v1/cart').expect(200);
  const firstB = await guestB.get('/api/v1/cart').expect(200);
  assert.notEqual(firstA.body.data.owner, firstB.body.data.owner);
  assert.match(firstA.headers['set-cookie'][0], /HttpOnly/);
  assert.doesNotMatch(firstA.headers['set-cookie'][0], /Secure/);
  const secondA = await guestA.get('/api/v1/cart').expect(200);
  assert.equal(secondA.body.data.owner, firstA.body.data.owner);
});

test('mutations require valid CSRF and login merge consumes the opaque guest cookie', async () => {
  const { app, csrf, merges } = makeApp();
  await request(app).put('/api/v1/cart/items/aaaaaaaaaaaaaaaaaaaaaaaa').send({ quantity: 1, expectedVersion: 0 }).expect(403);
  const response = await request(app).post('/api/v1/cart/merge')
    .set('Origin', ORIGIN)
    .set('Cookie', `tl_session=${SESSION_A}; tl_csrf=${encodeURIComponent(csrf)}; tl_guest_cart=${GUEST_TOKEN}`)
    .set('X-CSRF-Token', csrf)
    .send({ expectedVersion: 0 })
    .expect(200);
  assert.equal(response.body.data.owner, USER_A);
  assert.equal(merges.length, 1);
  assert.notEqual(merges[0].tokenHash, GUEST_TOKEN);
  assert.match(response.headers['set-cookie'].join(';'), /tl_guest_cart=;/);
  assert.match(response.headers['set-cookie'].join(';'), /Path=\/api\/v1/);
  assert.match(response.headers['set-cookie'].join(';'), /Max-Age=0/);
});

test('address routes do not allow another signed-in owner to update a resource', async () => {
  const { app, csrf, owners } = makeApp();
  owners.get(USER_A).set('aaaaaaaaaaaaaaaaaaaaaaaa', { id: 'aaaaaaaaaaaaaaaaaaaaaaaa', version: 0 });
  await request(app).patch('/api/v1/account/addresses/aaaaaaaaaaaaaaaaaaaaaaaa')
    .set('Origin', ORIGIN)
    .set('Cookie', `tl_session=${SESSION_B}; tl_csrf=${encodeURIComponent(csrf)}`)
    .set('X-CSRF-Token', csrf)
    .send({ label: 'Địa chỉ khác', expectedVersion: 0 })
    .expect(404);
});

test('cart reads indicate a merge only for an authenticated customer with a guest cookie', async () => {
  const { app } = makeApp();
  assert.equal((await request(app).get('/api/v1/cart').expect(200)).body.data.guestMergeRequired, false);
  assert.equal((await request(app).get('/api/v1/cart').set('Cookie', `tl_session=${SESSION_A}`).expect(200)).body.data.guestMergeRequired, false);
  assert.equal((await request(app).get('/api/v1/cart').set('Cookie', `tl_session=${SESSION_A}; tl_guest_cart=${GUEST_TOKEN}`).expect(200)).body.data.guestMergeRequired, true);
});

test('cart DELETE passes the checked guest snapshot once and rotates consumed tokens', async () => {
  const { app, csrf, accountService } = makeApp();
  let reads = 0;
  let snapshot = { version: 2, items: [] };
  let received;
  accountService.guestCartWasMerged = async () => { throw new Error('Repeated lookup'); };
  accountService.getGuestCartSnapshot = async hash => { reads += 1; return { ...snapshot, guestTokenHash: hash }; };
  accountService.removeCartItem = async (actor, id, version, options) => {
    received = { actor, id, version, options };
    return { version: 3, items: [] };
  };
  const send = () => request(app).delete('/api/v1/cart/items/aaaaaaaaaaaaaaaaaaaaaaaa?expectedVersion=2')
    .set('Origin', ORIGIN).set('Cookie', `tl_csrf=${encodeURIComponent(csrf)}; tl_guest_cart=${GUEST_TOKEN}`)
    .set('X-CSRF-Token', csrf);
  await send().expect(200);
  assert.equal(reads, 1);
  assert.equal(received.options.guestCartSnapshot.version, 2);
  assert.equal(received.options.guestCartSnapshot.guestTokenHash, received.actor.guestTokenHash);
  snapshot = { ...snapshot, mergedAt: new Date() };
  const rotated = await send().expect(200);
  assert.equal(reads, 2);
  assert.equal(received.options.guestCartSnapshot, null);
  assert.doesNotMatch(rotated.headers['set-cookie'].join(';'), new RegExp(`tl_guest_cart=${GUEST_TOKEN}`));
  await request(app).delete('/api/v1/cart/items/aaaaaaaaaaaaaaaaaaaaaaaa?expectedVersion=2').expect(403);
  assert.equal(reads, 2, 'invalid CSRF must not reach database resolution');
});
