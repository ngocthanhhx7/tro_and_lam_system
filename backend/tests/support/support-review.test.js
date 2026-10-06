import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createSupportRouter } from '../../src/support/support.routes.js';
import { createSupportService } from '../../src/support/support.service.js';
import { createReviewService } from '../../src/reviews/review.service.js';
import { validateAttachmentUploadCreate } from '../../src/support/support.validators.js';

const OWNER = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const ORDER = 'cccccccccccccccccccccccc';
const PRODUCT = 'dddddddddddddddddddddddd';
const TICKET = 'eeeeeeeeeeeeeeeeeeeeeeee';
const RETURN = 'ffffffffffffffffffffffff';
const REVIEW = '111111111111111111111111';
const FIXED_NOW = new Date('2026-10-06T00:00:00.000Z');

function errorWith(status, code) {
  return (error) => error?.status === status && error?.code === code;
}

function supportRepo(overrides = {}) {
  const rows = {
    tickets: new Map(), messages: [], contacts: [], returns: new Map(), attachments: new Map(),
  };
  const repo = {
    transaction: (work) => work({ transaction: true }),
    createTicket: async (value) => {
      const row = { _id: TICKET, createdAt: FIXED_NOW, updatedAt: FIXED_NOW, ...value };
      rows.tickets.set(String(row._id), row);
      return row;
    },
    findTicketById: async (id) => rows.tickets.get(String(id)) || null,
    listOwnTickets: async () => ({ items: [], total: 0 }),
    listStaffTickets: async () => ({ items: [], total: 0 }),
    createTicketMessage: async (value) => {
      const row = { _id: `${String(rows.messages.length).padStart(24, '0')}`, createdAt: FIXED_NOW, ...value };
      rows.messages.push(row);
      return row;
    },
    listTicketMessages: async (_id, { includeInternal }) => ({
      items: rows.messages.filter((message) => includeInternal || message.visibility === 'customer'),
      nextCursor: null,
    }),
    updateTicket: async (id, expectedVersion, changes) => {
      const current = rows.tickets.get(String(id));
      if (!current || current.version !== expectedVersion) return null;
      Object.assign(current, changes, { version: current.version + 1, updatedAt: FIXED_NOW });
      return current;
    },
    createContact: async (value) => {
      const row = { _id: '222222222222222222222222', createdAt: FIXED_NOW, updatedAt: FIXED_NOW, ...value };
      rows.contacts.push(row);
      return row;
    },
    listActiveStaffIds: async () => [],
    createReturnRequest: async (value) => {
      const row = { _id: RETURN, createdAt: FIXED_NOW, updatedAt: FIXED_NOW, ...value };
      rows.returns.set(String(row._id), row);
      return row;
    },
    findReturnById: async (id) => rows.returns.get(String(id)) || null,
    findReturnByIdempotency: async () => null,
    findActiveReturnByOrder: async () => null,
    listReturnsForOwner: async () => [],
    updateReturn: async (id, expectedVersion, changes) => {
      const current = rows.returns.get(String(id));
      if (!current || current.version !== expectedVersion) return null;
      Object.assign(current, changes, { version: current.version + 1, updatedAt: FIXED_NOW });
      return current;
    },
    listStaffReturns: async () => ({ items: [], total: 0 }),
    listContacts: async () => ({ items: [], total: 0 }),
    findContactById: async () => null,
    updateContact: async () => null,
    createAttachment: async (value) => {
      const row = { _id: '333333333333333333333333', createdAt: FIXED_NOW, ...value };
      rows.attachments.set(String(row._id), row);
      return row;
    },
    findAttachmentById: async (id) => rows.attachments.get(String(id)) || null,
    findAttachmentsByIds: async (ids) => ids.map((id) => rows.attachments.get(String(id))).filter(Boolean),
    updateAttachment: async (id, expectedVersion, changes) => {
      const current = rows.attachments.get(String(id));
      if (!current || current.version !== expectedVersion) return null;
      Object.assign(current, changes, { version: current.version + 1 });
      return current;
    },
    linkAttachments: async (ids, ownerFilter, link) => {
      let modifiedCount = 0;
      for (const id of ids) {
        const row = rows.attachments.get(String(id));
        if (!row || row.state !== 'ready' || Object.entries(ownerFilter).some(([key, value]) => String(row[key]) !== String(value))) continue;
        Object.assign(row, link, { state: 'linked', version: row.version + 1 });
        modifiedCount += 1;
      }
      return { modifiedCount };
    },
    ...overrides,
  };
  return { repo, rows };
}

function order(overrides = {}) {
  return {
    id: ORDER,
    userId: OWNER,
    status: 'delivered',
    version: 4,
    deliveredAt: new Date('2026-10-03T00:00:00.000Z'),
    items: [{ productId: PRODUCT, quantity: 2 }],
    ...overrides,
  };
}

function basePorts(overrides = {}) {
  return {
    clock: { now: () => FIXED_NOW.getTime() },
    operations: {
      appendOutbox: async () => ({}),
      appendAudit: async () => ({}),
      enqueueMail: async () => ({}),
    },
    ...overrides,
  };
}

test('guest ticket creation requires proof bound to the same order', async () => {
  const { repo } = supportRepo();
  const service = createSupportService({ repository: repo });
  await assert.rejects(service.createTicket(
    { role: 'guest', orderId: ORDER },
    { kind: 'complaint', subject: 'Đơn hàng', body: 'Cần hỗ trợ', orderId: OTHER },
  ), errorWith(404, 'NOT_FOUND'));
});

test('ticket ownership is hidden and staff can read customer plus internal messages', async () => {
  const { repo, rows } = supportRepo();
  rows.tickets.set(TICKET, { _id: TICKET, userId: OWNER, orderId: ORDER, status: 'in_progress', version: 0 });
  rows.messages.push(
    { _id: '000000000000000000000001', visibility: 'customer', authorRole: 'customer', body: 'Đã nhận' },
    { _id: '000000000000000000000002', visibility: 'internal', authorRole: 'staff', body: 'Gọi lại khách' },
  );
  const service = createSupportService({ repository: repo });

  await assert.rejects(service.getTicket({ id: OTHER, role: 'customer' }, TICKET), errorWith(404, 'NOT_FOUND'));
  assert.equal((await service.listTicketMessages({ id: OWNER, role: 'customer' }, TICKET)).items.length, 1);
  assert.equal((await service.listTicketMessages({ id: OTHER, role: 'staff' }, TICKET)).items.length, 2);
});

test('contact stores the lead and queues a server addressed mail event', async () => {
  const { repo, rows } = supportRepo();
  const queued = [];
  const service = createSupportService({
    repository: repo,
    ports: basePorts({ operations: {
      appendOutbox: async () => ({}),
      enqueueMail: async (...args) => { queued.push(args); },
    } }),
    config: { supportInbox: 'support@example.test' },
  });
  const result = await service.createContact(null, {
    name: 'Nguyễn An', email: 'an@example.test', kind: 'corporate',
    company: 'Đơn vị thử nghiệm', message: 'Xin tư vấn quà tặng.', consent: true,
  });

  assert.equal(result.deliveryStatus, 'queued');
  assert.equal(rows.contacts.length, 1);
  assert.equal(queued[0][0], 'new_lead');
  assert.equal(queued[0][1], 'support@example.test');
  assert.equal(queued[0][2].reference, result.id);
  await assert.rejects(service.createContact(null, {
    name: 'Nguyễn An', email: 'an@example.test', kind: 'general', message: 'Xin tư vấn.', consent: true,
    to: 'attacker@example.test',
  }), errorWith(400, 'VALIDATION_ERROR'));
});

test('review requires a delivered owned order and rejects duplicate order-product reviews', async () => {
  const rows = new Map();
  const repository = {
    transaction: (work) => work({ transaction: true }),
    create: async (value) => {
      if (rows.has(`${value.userId}:${value.orderId}:${value.productId}`)) throw Object.assign(new Error('duplicate'), { code: 11000 });
      const row = { _id: REVIEW, createdAt: FIXED_NOW, updatedAt: FIXED_NOW, ...value };
      rows.set(`${value.userId}:${value.orderId}:${value.productId}`, row);
      return row;
    },
  };
  const supportRepository = { listReviewAttachments: async () => [], linkAttachments: async () => ({ modifiedCount: 0 }) };
  const service = createReviewService({
    repository, supportRepository,
    ports: basePorts({ commerce: { getOwnedOrder: async (actor) => {
      if (actor.id !== OWNER) throw Object.assign(new Error('missing'), { status: 404, code: 'NOT_FOUND' });
      return order({ status: 'processing' });
    } } }),
  });
  const input = { orderId: ORDER, productId: PRODUCT, rating: 5, comment: 'Gốm đẹp.' };

  await assert.rejects(service.createReview({ id: OWNER, role: 'customer' }, input), errorWith(422, 'REVIEW_NOT_ELIGIBLE'));
  await assert.rejects(service.createReview({ id: OTHER, role: 'customer' }, input), errorWith(404, 'NOT_FOUND'));
  const eligibleService = createReviewService({
    repository, supportRepository,
    ports: basePorts({ commerce: { getOwnedOrder: async () => order() } }),
  });
  const created = await eligibleService.createReview({ id: OWNER, role: 'customer' }, input);
  assert.equal(created.status, 'pending');
  await assert.rejects(eligibleService.createReview({ id: OWNER, role: 'customer' }, input), errorWith(409, 'ALREADY_REVIEWED'));
});

test('review edits return to moderation and append a redacted audit in the same transaction', async () => {
  const row = {
    _id: REVIEW, userId: OWNER, orderId: ORDER, productId: PRODUCT,
    rating: 5, comment: 'Bình luận trước', moderationStatus: 'published',
    moderatedBy: OTHER, moderatedAt: FIXED_NOW, moderationReason: null,
    version: 1, createdAt: FIXED_NOW, updatedAt: FIXED_NOW,
  };
  const audits = [];
  const session = { transaction: true };
  const repository = {
    transaction: (work) => work(session),
    findById: async () => ({ ...row }),
    update: async (_id, expectedVersion, patch, options) => {
      assert.equal(options.session, session);
      if (row.version !== expectedVersion) return null;
      Object.assign(row, patch, { version: row.version + 1, updatedAt: FIXED_NOW });
      return { ...row };
    },
  };
  const service = createReviewService({
    repository, supportRepository: { listReviewAttachments: async () => [] },
    ports: basePorts({ operations: {
      appendAudit: async (event, options) => audits.push({ event, options }),
    } }),
  });

  const updated = await service.updateOwnReview({ id: OWNER, role: 'customer' }, REVIEW, {
    rating: 4, comment: 'Bình luận đã sửa', expectedVersion: 1,
  }, { requestId: 'request-review-edit' });

  assert.equal(updated.status, 'pending');
  assert.equal(updated.version, 2);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].event.requestId, 'request-review-edit');
  assert.equal(audits[0].event.action, 'review.edited');
  assert.deepEqual(audits[0].event.changesRedacted, {
    previousStatus: 'published', status: 'pending', ratingChanged: true, commentChanged: true,
  });
  assert.equal(audits[0].options.session, session);
});

test('return requests are full-only and delegate order changes in the same transaction', async () => {
  const { repo } = supportRepo();
  const sessions = [];
  const commerce = {
    getOwnedOrder: async () => order(),
    requestReturn: async (_actor, _id, _reason, options) => { sessions.push(options.session); },
  };
  const service = createSupportService({ repository: repo, ports: basePorts({ commerce }), config: { returnWindowMs: 14 * 24 * 60 * 60 * 1000 } });
  const actor = { id: OWNER, role: 'customer' };
  const partial = {
    items: [{ productId: PRODUCT, quantity: 1, reason: 'Nứt' }], message: 'Một sản phẩm bị nứt.', expectedVersion: 4,
  };
  await assert.rejects(service.createReturnRequest(actor, ORDER, partial, { idempotencyKey: 'return-request-key-0000000001' }), errorWith(422, 'PARTIAL_OPERATION_DISABLED'));
  assert.deepEqual(sessions, []);

  const full = { ...partial, items: [{ ...partial.items[0], quantity: 2 }] };
  const created = await service.createReturnRequest(actor, ORDER, full, { idempotencyKey: 'return-request-key-0000000002' });
  assert.equal(created.status, 'requested');
  assert.equal(sessions.length, 1);
  assert.deepEqual(sessions[0], { transaction: true });
});

test('return inspection delegates inventory and completion using the caller session', async () => {
  const { repo, rows } = supportRepo();
  rows.returns.set(RETURN, {
    _id: RETURN, orderId: ORDER, ticketId: TICKET, userId: OWNER, status: 'approved', version: 2,
    items: [{ productId: PRODUCT, quantity: 2, reason: 'Nứt' }], createdAt: FIXED_NOW, updatedAt: FIXED_NOW,
  });
  const calls = [];
  const commerce = {
    getOperationalOrder: async () => ({ version: 8 }),
    completeReturn: async (_actor, payload, options) => calls.push({ payload, session: options.session }),
  };
  const service = createSupportService({ repository: repo, ports: basePorts({ commerce }) });
  const result = await service.inspectReturn({ id: OWNER, role: 'staff' }, RETURN, {
    items: [{ productId: PRODUCT, receivedQuantity: 2, resellableQuantity: 1 }],
    evidenceReference: 'CASE-101', expectedVersion: 2,
  });

  assert.equal(result.status, 'received');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.expectedOrderVersion, 8);
  assert.deepEqual(calls[0].session, { transaction: true });
});

test('attachment validation and unavailable storage fail closed; internal uploads require staff', async () => {
  assert.throws(() => validateAttachmentUploadCreate({ purpose: 'ticket', mimeType: 'image/gif', bytes: 100 }), errorWith(400, 'VALIDATION_ERROR'));
  assert.throws(() => validateAttachmentUploadCreate({ purpose: 'ticket', mimeType: 'image/png', bytes: 5 * 1024 * 1024 + 1 }), errorWith(400, 'VALIDATION_ERROR'));

  const { repo } = supportRepo();
  const unavailableService = createSupportService({ repository: repo });
  await assert.rejects(unavailableService.createAttachmentUpload({ id: OWNER, role: 'customer' }, {
    purpose: 'ticket', mimeType: 'image/png', bytes: 100,
  }), errorWith(503, 'MEDIA_UNAVAILABLE'));

  const configuredService = createSupportService({
    repository: repo,
    ports: { storage: { createUpload: async () => ({ uploadUrl: 'https://storage.example.test/upload', headers: { 'Content-Type': 'image/png' } }) } },
  });
  await assert.rejects(configuredService.createAttachmentUpload({ id: OWNER, role: 'customer' }, {
    purpose: 'ticket', mimeType: 'image/png', bytes: 100, visibility: 'internal',
  }), errorWith(403, 'FORBIDDEN'));
});

test('attachment finalize and download enforce ownership and keep internal evidence private', async () => {
  const { repo, rows } = supportRepo();
  rows.tickets.set(TICKET, { _id: TICKET, userId: OWNER, orderId: ORDER, status: 'in_progress', version: 0 });
  rows.attachments.set('333333333333333333333333', {
    _id: '333333333333333333333333', storageKey: 'support/private-customer-upload',
    uploadedByUserId: OWNER, purpose: 'ticket', ticketId: TICKET, mimeType: 'image/png', bytes: 8,
    state: 'pending_upload', visibility: 'customer', expiresAt: new Date(FIXED_NOW.getTime() + 60_000), version: 0,
  });
  rows.attachments.set('444444444444444444444444', {
    _id: '444444444444444444444444', storageKey: 'support/private-internal-note',
    uploadedByUserId: OTHER, purpose: 'ticket', ticketId: TICKET, mimeType: 'image/png', bytes: 8,
    state: 'linked', visibility: 'internal', version: 1,
  });
  const reads = [];
  const downloads = [];
  const service = createSupportService({
    repository: repo,
    ports: { clock: { now: () => FIXED_NOW.getTime() }, storage: {
      readPrivateObject: async (key) => { reads.push(key); return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); },
      createDownload: async (key) => { downloads.push(key); return 'https://storage.example.test/private?sig=signed'; },
    } },
  });

  await assert.rejects(service.finalizeAttachment({ id: OTHER, role: 'customer' }, '333333333333333333333333'), errorWith(404, 'NOT_FOUND'));
  assert.equal(reads.length, 0);
  const finalized = await service.finalizeAttachment({ id: OWNER, role: 'customer' }, '333333333333333333333333');
  assert.equal(finalized.state, 'ready');
  assert.equal(reads[0], 'support/private-customer-upload');

  await assert.rejects(service.downloadAttachment({ id: OWNER, role: 'customer' }, '444444444444444444444444'), errorWith(404, 'NOT_FOUND'));
  const url = await service.downloadAttachment({ id: OWNER, role: 'customer' }, '333333333333333333333333');
  assert.equal(url, 'https://storage.example.test/private?sig=signed');
  assert.deepEqual(downloads, ['support/private-customer-upload']);
});

test('assistant handoff verifies conversation ownership before reading an opted-in transcript', async () => {
  const { repo } = supportRepo();
  let transcriptReads = 0;
  const service = createSupportService({
    repository: repo,
    ports: {
      assistantTranscript: {
        assertConversationOwner: async (_conversationId, actor) => {
          if (actor.id !== OWNER) throw Object.assign(new Error('missing'), { status: 404, code: 'NOT_FOUND' });
        },
        getSharedTranscript: async () => { transcriptReads += 1; return 'private conversation'; },
      },
    },
  });

  await assert.rejects(service.createHandoff({ id: OTHER, role: 'customer' }, {
    conversationId: 'conversation-1', shareTranscript: true, contact: { name: 'Test', email: 'test@example.test' },
  }), errorWith(404, 'NOT_FOUND'));
  assert.equal(transcriptReads, 0);
});

test('guest ticket route requires the guest.ticket.create proof scope and passes its order-bound actor', async (t) => {
  const seenScopes = [];
  const createdActors = [];
  const identity = {
    settings: { sessionCookieName: 'tl_session' },
    csrfProtection: (_req, _res, next) => next(),
    requireActor: (_req, res) => res.status(401).end(),
    requireCapability: () => (_req, res) => res.status(403).end(),
    requireGuestOrderProof: (scopes) => (req, res, next) => {
      seenScopes.push(scopes);
      if (req.get('x-guest-proof') !== 'valid-proof') return res.status(401).end();
      req.guestOrderActor = { orderId: ORDER };
      return next();
    },
  };
  const supportService = {
    createTicket: async (actor) => {
      createdActors.push(actor);
      return { ticket: { id: TICKET, code: 'TL-TEST' }, initialMessage: { id: 'message-id' } };
    },
    createHandoff: async () => ({ targetType: 'ticket', id: TICKET, reference: 'TL-TEST' }),
  };
  const router = createSupportRouter({ ports: { identityMiddleware: identity }, supportService, reviewService: {} });
  const app = express();
  app.use(express.json());
  app.use(router);
  app.use((error, _req, res, _next) => res.status(error?.status || 500).end());
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/tickets`;
  const body = { kind: 'complaint', subject: 'Đơn hàng', body: 'Cần hỗ trợ', orderId: ORDER };

  const denied = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(denied.status, 401);
  assert.equal(createdActors.length, 0);
  const allowed = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-guest-proof': 'valid-proof' }, body: JSON.stringify(body),
  });
  assert.equal(allowed.status, 201);
  assert.deepEqual(seenScopes, [['guest.ticket.create'], ['guest.ticket.create']]);
  assert.deepEqual(createdActors[0], { orderId: ORDER, role: 'guest', kind: 'guest' });
});

test('staff ticket message route checks support.operate and preserves internal note visibility', async (t) => {
  const seenCapabilities = [];
  const identity = {
    settings: { sessionCookieName: 'tl_session' },
    csrfProtection: (_req, _res, next) => next(),
    requireActor: (req, _res, next) => {
      const role = req.get('x-test-role');
      req.actor = { id: role === 'staff' ? OTHER : OWNER, role };
      next();
    },
    requireCapability: (capability) => (req, res, next) => {
      seenCapabilities.push(capability);
      const role = req.get('x-test-role');
      req.actor = { id: role === 'staff' ? OTHER : OWNER, role };
      if (role === 'staff' && capability !== 'support.operate') return res.status(403).end();
      return next();
    },
    requireGuestOrderProof: () => (_req, res) => res.status(403).end(),
  };
  const supportService = {
    listTicketMessages: async (actor) => ({ items: [{ visibility: actor.role === 'staff' ? 'internal' : 'customer' }], nextCursor: null }),
    createHandoff: async () => ({ targetType: 'ticket', id: TICKET, reference: 'TL-TEST' }),
  };
  const router = createSupportRouter({ ports: { identityMiddleware: identity }, supportService, reviewService: {} });
  const app = express();
  app.use(router);
  app.use((req, res, _next) => {
    res.statusCode = 404;
    res.end();
  });
  app.use((error, _req, res, _next) => {
    res.statusCode = error?.status || 404;
    res.end();
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/tickets/${TICKET}/messages`, {
    headers: { cookie: 'tl_session=session', 'x-test-role': 'staff' },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(seenCapabilities, ['support.operate']);
  assert.equal((await response.json()).data[0].visibility, 'internal');
});
