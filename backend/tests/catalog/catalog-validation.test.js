import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSafePublicImageUrl,
  validateCategoryWrite,
  validateProductQuery,
  validateProductWrite,
} from '../../src/services/catalog/catalog-validation.js';

const productWrite = {
  name: 'Cup',
  slug: 'chu-dau-cup',
  sku: 'CD-CUP-01',
  line: 'lifestyle',
  categoryId: '64f000000000000000000001',
  description: 'Ceramic cup',
  material: 'Ceramic',
  images: [],
  saleMode: 'quote',
  status: 'draft',
  featured: false,
};

test('product and category slugs use the route-safe lowercase format', () => {
  assert.equal(validateProductWrite(productWrite).slug, 'chu-dau-cup');
  assert.equal(validateCategoryWrite({ slug: 'viet-tay', name: 'Việt tay' }).slug, 'viet-tay');
  assert.throws(() => validateProductWrite({ ...productWrite, slug: 'Chu Đậu / Cup' }), (error) => error.code === 'VALIDATION_ERROR');
  assert.throws(() => validateCategoryWrite({ slug: 'two--words', name: 'Category' }), (error) => error.code === 'VALIDATION_ERROR');
});

test('admin product edits can clear an optional story reference', () => {
  const patch = validateProductWrite({ expectedVersion: 1, storyId: '' }, { partial: true });
  assert.equal(patch.storyId, null);
});

test('image URLs allow HTTPS and same-site paths while rejecting credentials, traversal, and protocol-relative paths', () => {
  assert.equal(isSafePublicImageUrl('https://media.example/products/cup.webp'), true);
  assert.equal(isSafePublicImageUrl('/assets/products/cup.webp'), true);
  assert.equal(isSafePublicImageUrl('https://user:secret@media.example/cup.webp'), false);
  assert.equal(isSafePublicImageUrl('/assets/../private.webp'), false);
  assert.equal(isSafePublicImageUrl('//media.example/cup.webp'), false);
  assert.equal(isSafePublicImageUrl('/assets\\private.webp'), false);
});

test('catalog query validation rejects object-shaped query values and unsupported sorts', () => {
  assert.throws(() => validateProductQuery({ q: { $ne: '' } }), (error) => error.code === 'VALIDATION_ERROR');
  assert.throws(() => validateProductQuery({ sort: { $where: 'sleep(1)' } }), (error) => error.code === 'VALIDATION_ERROR');
  assert.equal(validateProductQuery({ available: 'false' }).available, false);
});
