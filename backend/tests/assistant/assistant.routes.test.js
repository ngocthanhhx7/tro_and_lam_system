import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createAssistantRouter } from '../../src/assistant/assistant.routes.js';
import { ServiceError } from '../../src/utils/serviceError.js';

function appFor({ actor } = {}) {
  const calls = [];
  const identityMiddleware = {
    settings: { sessionCookieName: 'tl_session', secureCookies: false, sameSite: 'Lax', cookiePath: '/api/v1' },
    csrfProtection(req, _res, next) {
      if (req.get('origin') !== 'http://localhost:5173' || req.get('x-csrf-token') !== 'csrf-test') {
        return next(new ServiceError(403, 'CSRF_INVALID', 'CSRF failed'));
      }
      return next();
    },
    requireActor(req, _res, next) {
      if (!actor) return next(new ServiceError(401, 'AUTH_REQUIRED', 'Not authenticated'));
      req.actor = actor;
      return next();
    },
  };
  const assistantService = {
    async sendMessage(input) {
      calls.push(input);
      return { conversationId: '64f000000000000000000001', reply: 'Public answer.', sources: [], handoffSuggested: false };
    },
  };
  const router = createAssistantRouter({ ports: { identityMiddleware, assistantService } });
  const app = express();
  app.use(express.json());
  app.use(router);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: { code: error.code || 'INTERNAL' } }));
  return { app, calls };
}

test('guest message is CSRF-protected and receives a scoped HttpOnly assistant owner cookie', async () => {
  const { app, calls } = appFor();
  const response = await request(app).post('/assistant/messages')
    .set('Origin', 'http://localhost:5173')
    .set('X-CSRF-Token', 'csrf-test')
    .send({ message: 'Tìm hũ trà', consent: true });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.reply, 'Public answer.');
  assert.match(response.headers['set-cookie'][0], /^tl_assistant_guest=/u);
  assert.match(response.headers['set-cookie'][0], /HttpOnly/u);
  assert.match(response.headers['set-cookie'][0], /Path=\/api\/v1\/assistant/u);
  assert.match(response.headers['cache-control'], /no-store/u);
  assert.equal(calls[0].actor.role, 'guest');
  assert.match(calls[0].actor.assistantGuestHash, /^[a-f\d]{64}$/u);
  assert.equal(JSON.stringify(response.body).includes(calls[0].actor.assistantGuestHash), false);
});

test('authenticated user stays owner-scoped without receiving a guest identity cookie', async () => {
  const user = { id: '64f000000000000000000099', role: 'customer', status: 'active' };
  const { app, calls } = appFor({ actor: user });
  const response = await request(app).post('/assistant/messages')
    .set('Origin', 'http://localhost:5173')
    .set('X-CSRF-Token', 'csrf-test')
    .set('Cookie', 'tl_session=valid-session')
    .send({ message: 'Tìm hũ trà', consent: true });

  assert.equal(response.status, 200);
  assert.deepEqual(calls[0].actor, user);
  assert.equal(response.headers['set-cookie'], undefined);
});

test('refuses missing CSRF consent and unknown request fields', async () => {
  const { app, calls } = appFor();
  const csrfResponse = await request(app).post('/assistant/messages')
    .set('Origin', 'http://localhost:5173')
    .send({ message: 'Tìm hũ trà', consent: true });
  const extraFieldResponse = await request(app).post('/assistant/messages')
    .set('Origin', 'http://localhost:5173')
    .set('X-CSRF-Token', 'csrf-test')
    .send({ message: 'Tìm hũ trà', consent: true, orderId: '64f000000000000000000001' });

  assert.equal(csrfResponse.status, 403);
  assert.equal(extraFieldResponse.status, 422);
  assert.equal(calls.length, 0);
});
