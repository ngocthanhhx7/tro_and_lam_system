import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createContentRouter } from '../../src/content/content.routes.js';
import { createPublishedContentPort } from '../../src/content/content.ports.js';
import { createContentService } from '../../src/content/content.service.js';
import { ServiceError } from '../../src/utils/serviceError.js';

const actor = { id: '64a000000000000000000001', role: 'admin', status: 'active' };
const productId = '64a000000000000000000101';
const publicId = 'b'.repeat(32);
const publishedProduct = Object.freeze({ id: productId, slug: 'ceramic-vase', name: 'Product fixture', line: 'lifestyle' });

class MemoryQuery {
  constructor(run) {
    this.run = run;
    this.sessionValue = undefined;
    this.sortValue = undefined;
    this.skipValue = 0;
    this.limitValue = Infinity;
  }
  session(value) { this.sessionValue = value; return this; }
  select() { return this; }
  sort(value) { this.sortValue = value; return this; }
  skip(value) { this.skipValue = value; return this; }
  limit(value) { this.limitValue = value; return this; }
  lean() { return Promise.resolve(this.run(this.sessionValue)); }
  then(resolve, reject) { return this.lean().then(resolve, reject); }
}

function makeTestModels() {
  const database = { current: { stories: new Map(), pages: new Map(), tags: new Map() }, nextId: 1 };
  const objectId = () => (database.nextId++).toString(16).padStart(24, '0');
  const connection = {
    mode: 'test',
    async transaction(work) {
      const before = structuredClone(database.current);
      try { return await work({ mode: 'test-session' }); }
      catch (error) { database.current = before; throw error; }
    },
  };

  function createModel(collection) {
    const store = () => database.current[collection];
    return {
      create: async (inputs, { session } = {}) => inputs.map((input) => {
        const id = objectId();
        const now = new Date('2026-10-06T00:00:00.000Z');
        const doc = { ...structuredClone(input), _id: id, createdAt: now, updatedAt: now };
        store(session).set(id, doc);
        return structuredClone(doc);
      }),
      findById: (id) => new MemoryQuery((session) => structuredClone(store(session).get(String(id)) || null)),
      findOne: (filter) => new MemoryQuery((session) => {
        const doc = [...store(session).values()].find((item) => matches(item, filter));
        return structuredClone(doc || null);
      }),
      find: (filter = {}) => {
        const query = new MemoryQuery(() => {
          let docs = [...store().values()].filter((item) => matches(item, filter));
          if (query.sortValue) {
            const [[field, direction]] = Object.entries(query.sortValue);
            docs = docs.sort((left, right) => direction * String(left[field] ?? '').localeCompare(String(right[field] ?? '')));
          }
          return structuredClone(docs.slice(query.skipValue, query.skipValue + query.limitValue));
        });
        return query;
      },
      countDocuments: async (filter = {}) => [...store().values()].filter((item) => matches(item, filter)).length,
      findOneAndUpdate: (filter, update, { session } = {}) => new MemoryQuery(() => {
        const doc = [...store(session).values()].find((item) => matches(item, filter));
        if (!doc) return null;
        Object.assign(doc, structuredClone(update.$set || {}));
        for (const [field, amount] of Object.entries(update.$inc || {})) doc[field] = (doc[field] || 0) + amount;
        doc.updatedAt = new Date('2026-10-06T00:01:00.000Z');
        return structuredClone(doc);
      }),
    };
  }

  return {
    Story: createModel('stories'),
    Page: createModel('pages'),
    NfcTag: createModel('tags'),
    connection,
    database,
    fakeLabel: 'P08 memory Mongo models; mode=test',
  };
}

function matches(document, filter) {
  return Object.entries(filter).every(([key, value]) => String(document[key]) === String(value));
}

function makeHarness({ productStatus = 'published', role = 'admin', csrf = true } = {}) {
  const models = makeTestModels();
  const auditEvents = [];
  const productPort = {
    mode: 'test',
    async getPublishedProductsByIds(ids) {
      return productStatus === 'published' && ids.includes(productId) ? [publishedProduct] : [];
    },
    async getAdminProductReferencesByIds(ids) {
      return ['published', 'archived', 'draft'].includes(productStatus) && ids.includes(productId) ? [publishedProduct] : [];
    },
  };
  const auditPort = {
    mode: 'test',
    async appendAudit(event, { session } = {}) {
      assert.equal(session?.mode, 'test-session');
      auditEvents.push(structuredClone(event));
    },
  };
  const requireCapability = (capability) => (req, _res, next) => {
    assert.equal(capability, 'content.manage');
    if (role !== 'admin') return next(new ServiceError(403, 'FORBIDDEN', 'Forbidden fixture'));
    req.actor = actor;
    return next();
  };
  const csrfProtection = (req, _res, next) => {
    if (!csrf || req.get('X-CSRF-Token') !== 'test-csrf') return next(new ServiceError(403, 'CSRF_INVALID', 'CSRF fixture'));
    return next();
  };
  const router = createContentRouter({
    ...models,
    models,
    productPort,
    auditPort,
    requireCapability,
    csrfProtection,
    idGenerator: () => publicId,
  });
  const contentService = createContentService({ ...models, productPort, auditPort, idGenerator: () => publicId });
  const publishedPort = createPublishedContentPort(contentService);
  const app = createApp({ isDatabaseReady: () => true, domainRouters: [{ prefix: '', router }] });
  const api = request(app);
  const adminRequest = (method, path) => api[method](path).set('X-CSRF-Token', 'test-csrf').set('X-Test-Role', role);
  return { api, adminRequest, models, auditEvents, publishedPort, fakeLabel: `${models.fakeLabel}; fake P02/P04/P09 ports: mode=test` };
}

const storyInput = (overrides = {}) => ({
  slug: 'source-required-story',
  title: 'Story draft fixture',
  locale: 'vi',
  origin: '',
  motifs: [],
  sections: [],
  media: [],
  productIds: [],
  status: 'draft',
  ...overrides,
});

test('AC-CONTENT-01: drafts stay private; published safe text is locale-specific and keeps product history', async () => {
  const harness = makeHarness();
  const created = await harness.adminRequest('post', '/api/v1/admin/stories').send(storyInput({
    sections: [{ heading: 'Safe heading', body: [{ type: 'paragraph', text: '<script>alert(1)</script>Verified copy' }] }],
    productIds: [productId],
  }));
  assert.equal(created.status, 201, harness.fakeLabel);
  const storyId = created.body.data.id;
  assert.equal(created.body.data.status, 'draft');
  assert.equal(created.body.data.sections[0].body[0].text, 'Verified copy');

  const draftRead = await harness.api.get('/api/v1/stories/source-required-story?locale=vi');
  assert.equal(draftRead.status, 404, harness.fakeLabel);

  const published = await harness.adminRequest('patch', `/api/v1/admin/stories/${storyId}`).send({
    ...storyInput({
      origin: 'Owner supplied source reference',
      sections: [{ heading: 'Safe heading', body: [{ type: 'paragraph', text: '<img src=x onerror=alert(1)>Public content' }] }],
      productIds: [productId],
      status: 'published',
      expectedVersion: 0,
    }),
  });
  assert.equal(published.status, 200, harness.fakeLabel);
  assert.equal(published.body.data.version, 1);
  assert.equal(published.body.data.sections[0].body[0].text, 'Public content');

  const publicStory = await harness.api.get('/api/v1/stories/source-required-story?locale=vi');
  assert.equal(publicStory.status, 200);
  assert.deepEqual(publicStory.body.data.productIds, [productId]);
  assert.equal(publicStory.body.data.sections[0].body[0].text, 'Public content');
  assert.deepEqual(Object.keys(harness.publishedPort).sort(), ['getPublishedStory', 'resolveNfc']);
  assert.equal((await harness.publishedPort.getPublishedStory('source-required-story', 'vi')).status, 'published');
  await assert.rejects(harness.publishedPort.getPublishedStory('source-required-story', 'en'), (error) => error.status === 404);

  const unreviewedEnglish = await harness.api.get('/api/v1/stories/source-required-story?locale=en');
  assert.equal(unreviewedEnglish.status, 404, 'EN must not fall back to Vietnamese or invent a translation');

  const adminList = await harness.adminRequest('get', '/api/v1/admin/stories?status=published&page=1&limit=20');
  assert.equal(adminList.status, 200);
  assert.equal(adminList.body.data.length, 1);
  assert.equal(harness.auditEvents.length, 2);
  assert.equal(harness.auditEvents[0].changesRedacted.status, 'draft');

  const archived = await harness.adminRequest('delete', `/api/v1/admin/stories/${storyId}?expectedVersion=1`);
  assert.equal(archived.status, 204);
  assert.equal((await harness.api.get('/api/v1/stories/source-required-story?locale=vi')).status, 404);
  const archivedList = await harness.adminRequest('get', '/api/v1/admin/stories?status=archived');
  assert.equal(archivedList.body.data[0].productIds[0], productId, 'archive retains product linkage history');
});

test('AC-CONTENT-01: NFC routes active published content, hides revoked tags with 410, and links only published products', async () => {
  const harness = makeHarness();
  const created = await harness.adminRequest('post', '/api/v1/admin/stories').send(storyInput({
    slug: 'nfc-story',
    title: 'NFC fixture story',
    origin: 'Owner provided source',
    sections: [{ body: [{ type: 'paragraph', text: 'Published story fixture' }] }],
    productIds: [productId],
    status: 'published',
  }));
  assert.equal(created.status, 201, harness.fakeLabel);

  const createdTag = await harness.adminRequest('post', '/api/v1/admin/nfc-tags').send({ storyId: created.body.data.id, productId });
  assert.equal(createdTag.status, 201);
  assert.equal(createdTag.body.data.publicId, publicId);
  assert.equal(createdTag.body.data.publicUrl, `/nfc/${publicId}`);

  const active = await harness.api.get(`/api/v1/nfc/${publicId}?locale=vi`);
  assert.equal(active.status, 200);
  assert.deepEqual(Object.keys(active.body.data).sort(), ['product', 'story']);
  assert.equal(active.body.data.product.slug, 'ceramic-vase');

  const tagId = createdTag.body.data.id;
  const revoked = await harness.adminRequest('post', `/api/v1/admin/nfc-tags/${tagId}/revoke`).send({ reason: 'Tag replaced', expectedVersion: 0 });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.data.status, 'revoked');
  const revokedRead = await harness.api.get(`/api/v1/nfc/${publicId}?locale=vi`);
  assert.equal(revokedRead.status, 410);
  assert.equal(revokedRead.body.error.code, 'NFC_REVOKED');
  assert.equal('data' in revokedRead.body, false);

  const archivedProduct = makeHarness({ productStatus: 'archived' });
  const archivedStory = await archivedProduct.adminRequest('post', '/api/v1/admin/stories').send(storyInput({
    slug: 'product-link-history', title: 'Linked product history', origin: 'Owner supplied source',
    sections: [{ body: [{ type: 'paragraph', text: 'History fixture' }] }], productIds: [productId], status: 'draft',
  }));
  assert.equal(archivedStory.status, 201);
  assert.deepEqual(archivedStory.body.data.productIds, [productId], 'archiving a product never mutates stored story references');
});

test('P08 rejects unsafe block schema, archived products at publish, stale versions, staff access, and missing CSRF', async () => {
  const harness = makeHarness();
  const invalidBlock = await harness.adminRequest('post', '/api/v1/admin/pages').send({
    slug: 'unsafe-page', title: 'Unsafe', locale: 'vi', status: 'draft',
    blocks: [{ type: 'paragraph', text: 'Hello', onerror: 'alert(1)' }],
  });
  assert.equal(invalidBlock.status, 400);
  const unsafeHref = await harness.adminRequest('post', '/api/v1/admin/pages').send({
    slug: 'unsafe-link', title: 'Unsafe link', locale: 'vi', status: 'draft',
    blocks: [{ type: 'link', text: 'click', url: 'javascript:alert(1)' }],
  });
  assert.equal(unsafeHref.status, 400);

  const missingProduct = await harness.adminRequest('post', '/api/v1/admin/stories').send(storyInput({
    slug: 'archived-link', origin: 'Owner source', sections: [{ body: [{ type: 'paragraph', text: 'text' }] }],
    productIds: [productId], status: 'published',
  }));
  const noPublishedProducts = makeHarness({ productStatus: 'archived' });
  const rejectedPublish = await noPublishedProducts.adminRequest('post', '/api/v1/admin/stories').send(storyInput({
    slug: 'archived-link', origin: 'Owner source', sections: [{ body: [{ type: 'paragraph', text: 'text' }] }],
    productIds: [productId], status: 'published',
  }));
  assert.equal(rejectedPublish.status, 409);
  assert.equal(rejectedPublish.body.error.code, 'INVALID_TRANSITION');
  assert.equal(missingProduct.status, 201, 'the deterministic catalog test port returned a published summary');

  const draft = await harness.adminRequest('post', '/api/v1/admin/stories').send(storyInput({ slug: 'versioned-story' }));
  assert.equal(draft.status, 201);
  const update = (expectedVersion) => harness.adminRequest('patch', `/api/v1/admin/stories/${draft.body.data.id}`).send(storyInput({
    slug: 'versioned-story', expectedVersion,
  }));
  assert.equal((await update(0)).status, 200);
  const stale = await update(0);
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'VERSION_CONFLICT');

  const staffHarness = makeHarness({ role: 'staff' });
  const staffResponse = await staffHarness.api.get('/api/v1/admin/stories').set('X-Test-Role', 'staff');
  assert.equal(staffResponse.status, 403);
  const noCsrfHarness = makeHarness({ csrf: false });
  const csrfResponse = await noCsrfHarness.api.post('/api/v1/admin/stories').send(storyInput());
  assert.equal(csrfResponse.status, 403);
});

test('pages publish only per locale, sanitize stored text, and archive with the expected version', async () => {
  const harness = makeHarness();
  const draft = await harness.adminRequest('post', '/api/v1/admin/pages').send({
    slug: 'terms-fixture', title: 'Page fixture', locale: 'vi', status: 'draft',
    blocks: [{ type: 'paragraph', text: '<script>alert(1)</script>Approved fixture text' }],
  });
  assert.equal(draft.status, 201, harness.fakeLabel);
  assert.equal(draft.body.data.blocks[0].text, 'Approved fixture text');
  assert.equal((await harness.api.get('/api/v1/pages/terms-fixture?locale=vi')).status, 404);

  const published = await harness.adminRequest('patch', `/api/v1/admin/pages/${draft.body.data.id}`).send({
    slug: 'terms-fixture', title: 'Page fixture', locale: 'vi', status: 'published', expectedVersion: 0,
    blocks: [{ type: 'paragraph', text: 'Approved fixture text' }],
  });
  assert.equal(published.status, 200);
  assert.equal((await harness.api.get('/api/v1/pages/terms-fixture?locale=en')).status, 404);
  const english = await harness.adminRequest('post', '/api/v1/admin/pages').send({
    slug: 'terms-fixture', title: 'English test fixture', locale: 'en', status: 'published',
    blocks: [{ type: 'paragraph', text: 'Owner-provided translation fixture; mode=test' }],
  });
  assert.equal(english.status, 201);
  assert.equal((await harness.api.get('/api/v1/pages/terms-fixture?locale=en')).body.data.title, 'English test fixture');

  const archived = await harness.adminRequest('delete', `/api/v1/admin/pages/${draft.body.data.id}?expectedVersion=1`);
  assert.equal(archived.status, 204);
  assert.equal((await harness.api.get('/api/v1/pages/terms-fixture?locale=vi')).status, 404);
  assert.equal((await harness.adminRequest('get', '/api/v1/admin/pages?status=archived')).body.data[0].status, 'archived');
});
