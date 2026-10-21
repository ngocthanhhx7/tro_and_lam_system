import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewService } from '../../src/reviews/review.service.js';

const PRODUCT = '64f000000000000000000081';
test('public reviews use the existence gate without loading a product DTO and preserve pagination', async () => {
  const calls = [];
  const service = createReviewService({
    ports: { catalog: {
      hasPublishedProduct: async id => { calls.push(['gate', id]); return true; },
      getPublishedProductsByIds: async () => { throw new Error('Full product and stock must not be loaded'); },
    } },
    repository: { listPublished: async (id, filters) => {
      calls.push(['reviews', id, filters.page, filters.limit]);
      return { items: [{ _id: '64f000000000000000000082', productId: PRODUCT, rating: 5, comment: 'Local review', orderId: 'private-order', userId: 'private-owner', moderationReason: 'private-note', attachmentIds: [] }], total: 3 };
    } },
  });
  const result = await service.listPublishedProductReviews(PRODUCT, { page: '2', limit: '1' });
  assert.deepEqual(calls, [['gate', PRODUCT], ['reviews', PRODUCT, 2, 1]]);
  assert.deepEqual(result.pagination, { page: 2, limit: 1, total: 3, totalPages: 3 });
  assert.equal(result.items[0].comment, 'Local review');
  assert.equal(result.items[0].orderId, undefined);
  assert.equal(result.items[0].userId, undefined);
  assert.equal(result.items[0].moderationReason, undefined);
});

test('public reviews fail closed on a hidden product without querying reviews or trying legacy fallback', async () => {
  const service = createReviewService({
    ports: { catalog: {
      hasPublishedProduct: async () => false,
      getPublishedProductsByIds: async () => { throw new Error('Do not bypass the gate'); },
    } },
    repository: { listPublished: async () => { throw new Error('Hidden product must not be queried'); } },
  });
  await assert.rejects(service.listPublishedProductReviews(PRODUCT), error => error.status === 404);
});

test('public reviews retain compatibility with legacy product ports', async () => {
  const service = createReviewService({
    ports: { catalog: { getPublishedProductsByIds: async ids => ids.map(id => ({ id })) } },
    repository: { listPublished: async () => ({ items: [], total: 0 }) },
  });
  const result = await service.listPublishedProductReviews(PRODUCT);
  assert.deepEqual(result.items, []);
  assert.equal(result.pagination.total, 0);
});
