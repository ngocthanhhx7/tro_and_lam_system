import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createCatalogRouter } from '../../src/routes/catalog.routes.js';
import { ServiceError } from '../../src/utils/serviceError.js';

const actor = { id: '64f000000000000000000099', role: 'admin', status: 'active' };

function adminGate(req, _res, next) {
  req.actor = actor;
  next();
}

function appFor(service, options = {}) {
  return createApp({
    domainRouters: [{ prefix: '', router: createCatalogRouter({ service, requireAdmin: adminGate, ...options }) }],
  });
}

test('public list responses preserve the standard paginated envelope', async () => {
  const service = {
    listPublishedProducts: async () => ({
      items: [{ id: 'product-1', slug: 'cup', name: 'Cup' }],
      pagination: { page: 2, limit: 1, total: 3, totalPages: 3 },
    }),
  };

  const response = await request(appFor(service)).get('/api/v1/products?page=2&limit=1');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, [{ id: 'product-1', slug: 'cup', name: 'Cup' }]);
  assert.deepEqual(response.body.meta.pagination, { page: 2, limit: 1, total: 3, totalPages: 3 });
  assert.equal(response.headers['x-request-id'], response.body.meta.requestId);
});

test('admin routes deny access when no admin middleware is injected', async () => {
  const service = { listAdminProducts: async () => { throw new Error('must not execute'); } };
  const app = createApp({ domainRouters: [{ router: createCatalogRouter({ service }) }] });
  const response = await request(app).get('/api/v1/admin/products');

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('product PATCH passes expectedVersion to the service and returns its new version', async () => {
  let received;
  const service = {
    updateProduct: async (id, input, context) => {
      received = { id, input, context };
      return { id, name: input.name, version: 4 };
    },
  };

  const response = await request(appFor(service))
    .patch('/api/v1/admin/products/64f000000000000000000001')
    .send({ name: 'New name', expectedVersion: 3 });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.version, 4);
  assert.deepEqual(received.input, { name: 'New name', expectedVersion: 3 });
  assert.deepEqual(received.context.actor, actor);
});

test('multipart media upload accepts supported image signatures and rejects spoofed content types', async () => {
  let upload;
  const service = {
    createMediaAsset: async (input, context) => {
      upload = { input, context };
      return { id: 'media-1', url: 'https://media.example/image.png', alt: input.alt, status: 'ready' };
    },
  };
  const app = appFor(service);
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2]);

  const accepted = await request(app)
    .post('/api/v1/admin/media')
    .attach('file', png, { filename: 'ceramic.png', contentType: 'image/png' })
    .field('alt', 'Ceramic glaze');
  assert.equal(accepted.status, 201);
  assert.equal(upload.input.file.mimeType, 'image/png');
  assert.equal(upload.input.file.bytes, png.length);
  assert.equal(upload.context.actor, actor);

  const spoofed = await request(app)
    .post('/api/v1/admin/media')
    .attach('file', png, { filename: 'ceramic.jpg', contentType: 'image/jpeg' })
    .field('alt', 'Ceramic glaze');
  assert.equal(spoofed.status, 415);
  assert.equal(spoofed.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
});

test('multipart media upload enforces required alt text and the 5 MB file limit', async () => {
  const app = appFor({ createMediaAsset: async () => ({ id: 'unused' }) });
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const missingAlt = await request(app)
    .post('/api/v1/admin/media')
    .attach('file', png, { filename: 'ceramic.png', contentType: 'image/png' });
  assert.equal(missingAlt.status, 400);
  assert.equal(missingAlt.body.error.code, 'VALIDATION_ERROR');

  const oversized = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024 - png.length + 1)]);
  const tooLarge = await request(app)
    .post('/api/v1/admin/media')
    .attach('file', oversized, { filename: 'ceramic.png', contentType: 'image/png' })
    .field('alt', 'Ceramic glaze');
  assert.equal(tooLarge.status, 413);
  assert.equal(tooLarge.body.error.code, 'PAYLOAD_TOO_LARGE');
});

test('media provider unavailability keeps its explicit 503 contract envelope', async () => {
  const service = {
    createMediaAsset: async () => { throw new ServiceError(503, 'MEDIA_UNAVAILABLE', 'Media is unavailable'); },
  };
  const app = appFor(service);
  const response = await request(app)
    .post('/api/v1/admin/media')
    .attach('file', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), { filename: 'ceramic.png', contentType: 'image/png' })
    .field('alt', 'Ceramic glaze');

  assert.equal(response.status, 503);
  assert.equal(response.body.error.code, 'MEDIA_UNAVAILABLE');
  assert.equal(response.body.error.details[0].code, 'DRAFT_ONLY');
  assert.equal(response.body.meta.requestId, response.headers['x-request-id']);
});
