import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createOperationsController } from '../src/controllers/operations.controller.js';
import { createDashboardService } from '../src/services/operations/dashboard.service.js';
import { makeInMemoryUsageGuard } from '../src/assistant/assistant.service.js';
import { assertIdentityGuardIndex } from '../src/config/critical-indexes.js';

test('staff dashboard ignores query identity and scopes personal counts to the authenticated staff', async () => {
  const actor = '111111111111111111111111';
  const other = '222222222222222222222222';
  const filters = [];
  const count = { countDocuments: async filter => { filters.push(filter); return filter.assignedTo === other || filter.userId === other ? 99 : 1; } };
  const dashboardService = createDashboardService({ Order: count, Ticket: count, Contact: count, Notification: count });
  const controller = createOperationsController({ dashboardService });
  let response;
  await controller.getStaffDashboard({ actor: { id: actor }, query: { actorId: other, role: 'admin' } }, {
    locals: {}, status() { return this; }, json(value) { response = value; },
  });
  assert(response.data);
  assert(filters.some(filter => filter.assignedTo === actor));
  assert(filters.some(filter => filter.userId === actor));
  assert(!filters.some(filter => filter.assignedTo === other || filter.userId === other));
});

test('API responses including errors cannot be cached, while static media policy is separate', async () => {
  const router = express.Router();
  router.get('/private-fixture', (_req, res) => res.json({ data: { synthetic: true } }));
  const app = createApp({ domainRouters: [{ router }], isDatabaseReady: () => true });
  for (const path of ['/api/v1/private-fixture', '/api/v1/not-found', '/api/v1/health/ready']) {
    const response = await request(app).get(path);
    assert.equal(response.headers['cache-control'], 'private, no-store');
  }
});

test('rotating assistant keys cannot evict active limits or grow the guard beyond its configured bound', async () => {
  const guard = makeInMemoryUsageGuard({ maxKeys: 3 });
  const at = new Date('2026-10-23T00:00:00Z');
  const consume = (key, time = at) => guard.consumeRequest(key, { at: time, limit: 1, windowMs: 1000 });
  for (const key of ['a', 'b', 'c']) assert.equal(await consume(key), true);
  for (let i = 0; i < 100; i++) assert.equal(await consume(`rotated-${i}`), false);
  assert.equal(await consume('a'), false);
  assert.equal(await consume('new', new Date(at.getTime() + 1001)), true);
  assert.equal(await consume('a', new Date(at.getTime() + 1001)), true);
});

test('production cooldown prerequisite rejects missing, partial or sparse guard indexes', async () => {
  const model = indexes => ({ collection: { indexes: async () => indexes } });
  for (const indexes of [[], [{ key: { key: 1 } }], [{ key: { key: 1 }, unique: true, sparse: true }], [{ key: { key: 1 }, unique: true, partialFilterExpression: { version: 1 } }]]) {
    await assert.rejects(assertIdentityGuardIndex(model(indexes)), /unique index is missing/u);
  }
  await assertIdentityGuardIndex(model([{ key: { key: 1 }, unique: true }]));
});
