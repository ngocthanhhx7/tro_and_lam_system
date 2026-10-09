import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { validateEnv } from '../src/validators/env.validator.js';
import { createDomainComposition } from '../src/composition.js';
import { createApp } from '../src/app.js';

test('server composition mounts domain routes and keeps unconfigured payment provider disabled', async () => {
  const env = validateEnv({ MONGODB_URI: 'mongodb://localhost:27017/tro_lam' });
  const composition = await createDomainComposition(env);

  assert.deepEqual(composition.domainRouters.map(({ prefix }) => prefix), Array(10).fill(''));
  assert.ok(composition.domainRouters.every(({ router }) => typeof router === 'function'));
  assert.equal(composition.services.paymentsService.isConfigured(), false);
  assert.equal(env.smtpConfigured, false);
  assert.equal(typeof composition.startWorkers, 'function');
  assert.equal(typeof composition.stopWorkers, 'function');

  const app = createApp({ ...env, domainRouters: composition.domainRouters });
  const response = await request(app).get('/api/v1/admin/products');
  assert.equal(response.status, 401, 'a mounted protected route must reject an anonymous request before database access');

  await composition.stopWorkers();
});
