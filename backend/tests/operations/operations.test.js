import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createNotificationService } from '../../src/services/operations/notification.service.js';
import { redactAuditEvent, createAuditService } from '../../src/services/operations/audit.service.js';
import { createOutboxWorker, RETRY_DELAY_MS, startOutboxWorker } from '../../src/jobs/operations/outbox.worker.js';
import { createSmtpProvider, renderMailTemplate } from '../../src/services/integrations/smtp/smtp.provider.js';
import { createOperationsRouter } from '../../src/routes/operations.routes.js';
import { createOutboxPayloadCipher } from '../../src/services/operations/outbox-payload-cipher.js';
import { createDashboardService } from '../../src/services/operations/dashboard.service.js';
import { parseAdminStatisticsRange, validateBusinessSettingsWrite, validateOutboxEvent } from '../../src/validators/operations.validator.js';
import { createBusinessSettingsService } from '../../src/services/operations/business-settings.service.js';
import { sanitizeBusinessSettingsValues } from '../../src/validators/operations.validator.js';
import { createOperationsPorts } from '../../src/services/operations/index.js';

class MemoryNotifications {
  static rows = [];

  static async bulkWrite(operations) {
    for (const operation of operations) {
      const { filter, update } = operation.updateOne;
      if (!this.rows.some((entry) => entry.userId === filter.userId && entry.eventKey === filter.eventKey)) {
        this.rows.push({ ...update.$setOnInsert, _id: `${this.rows.length + 1}` });
      }
    }
    return { upsertedCount: operations.length };
  }

  static async updateOne(filter, update) {
    let row = this.rows.find((entry) => entry.userId === filter.userId && entry.eventKey === filter.eventKey);
    if (!row) {
      row = { ...update.$setOnInsert, _id: `${this.rows.length + 1}` };
      this.rows.push(row);
    }
    return { upsertedCount: 1, matchedCount: 0 };
  }

  static async countDocuments(filter) {
    return this.rows.filter((row) => row.userId === filter.userId && (!Object.hasOwn(filter, 'readAt') || row.readAt === filter.readAt)).length;
  }

  static find(filter) {
    const rows = this.rows.filter((row) => {
      const categoryMatches = !filter.category
        || (Array.isArray(filter.category.$in) ? filter.category.$in.includes(row.category) : row.category === filter.category);
      return row.userId === filter.userId
        && (!Object.hasOwn(filter, 'readAt') || row.readAt === filter.readAt)
        && categoryMatches;
    });
    return query(rows);
  }

  static findOne(filter) {
    const row = this.rows.find((entry) => entry._id === filter._id && entry.userId === filter.userId) || null;
    return query(row);
  }

  static async findOneAndUpdate(filter, update) {
    const row = this.rows.find((entry) => entry._id === filter._id && entry.userId === filter.userId);
    if (!row) return null;
    Object.assign(row, update.$set);
    return row;
  }

  static async updateMany(filter, update) {
    const rows = this.rows.filter((entry) => entry.userId === filter.userId && entry.readAt === null);
    rows.forEach((row) => Object.assign(row, update.$set));
    return { modifiedCount: rows.length };
  }
}

function query(rows) {
  const chain = {
    sort() { return chain; },
    skip() { return chain; },
    limit() { return chain; },
    select() { return chain; },
    lean() { return chain; },
    session() { return chain; },
    then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); },
  };
  return chain;
}

test('notifications deduplicate by recipient/event and read operations stay owner-scoped', async () => {
  MemoryNotifications.rows = [];
  const service = createNotificationService({ Notification: MemoryNotifications, now: () => new Date('2026-10-06T00:00:00.000Z') });
  const event = {
    eventKey: 'order:123:confirmed:v1',
    recipients: ['user-a', 'user-b'],
    category: 'order',
    title: 'Đơn hàng được xác nhận',
    body: 'Đơn hàng TL-123 đang được chuẩn bị.',
    href: '/tai-khoan/don-hang/123',
  };

  await service.consume(event);
  await service.consume(event);

  assert.equal(MemoryNotifications.rows.length, 2);
  assert.equal((await service.unreadCount('user-a')).count, 1);
  await assert.rejects(() => service.markRead('user-b', '1'), { code: 'NOT_FOUND' });
  assert.equal((await service.markRead('user-a', '1')).readAt.toISOString(), '2026-10-06T00:00:00.000Z');
  assert.equal((await service.unreadCount('user-a')).count, 0);
});

test('customer notification filters group legacy account/support notices under system and keep promotions separate', async () => {
  MemoryNotifications.rows = [];
  const service = createNotificationService({ Notification: MemoryNotifications });
  for (const [eventKey, category] of [
    ['group-order', 'order'],
    ['group-promotion', 'promotion'],
    ['group-system', 'system'],
    ['group-support', 'support'],
    ['group-account', 'account'],
  ]) {
    await service.consume({
      eventKey, recipients: ['group-owner'], category, title: `Notice ${category}`, body: 'Synthetic notice.', href: '/tai-khoan',
    });
  }

  const all = (await service.list('group-owner')).items;
  assert.deepEqual(all.map((item) => item.category).sort(), ['order', 'promotion', 'system', 'system', 'system']);
  assert.deepEqual((await service.list('group-owner', { category: 'promotion' })).items.map((item) => item.eventKey), ['group-promotion']);
  assert.deepEqual((await service.list('group-owner', { category: 'system' })).items.map((item) => item.eventKey).sort(), ['group-account', 'group-support', 'group-system']);
  assert.deepEqual((await service.list('group-owner', { category: 'order' })).items.map((item) => item.eventKey), ['group-order']);
});

test('notification hrefs reject external or protocol-relative destinations', async () => {
  const service = createNotificationService({ Notification: MemoryNotifications });
  await assert.rejects(() => service.consume({
    eventKey: 'bad-href', recipients: ['user-a'], category: 'system', title: 'Alert', body: 'Alert', href: '//outside.example',
  }), { code: 'VALIDATION_ERROR' });
});

test('audit redaction strips credential, contact, message, and provider payload fields', () => {
  const safe = redactAuditEvent({
    actorId: '507f1f77bcf86cd799439011', actorRole: 'admin', requestId: 'req-123', action: 'user.block',
    targetType: 'user', targetId: '507f1f77bcf86cd799439022', outcome: 'success', reasonCode: 'POLICY_VIOLATION',
    changesRedacted: {
      status: { before: 'active', after: 'blocked' },
      password: 'hash-value', email: 'private@example.test',
      nested: { accessToken: 'secret', messageBody: 'private message', amountVnd: 5000 },
    },
  });

  assert.equal(safe.changesRedacted.status.before, 'active');
  assert.equal(safe.changesRedacted.password, '[REDACTED]');
  assert.equal(safe.changesRedacted.email, '[REDACTED]');
  assert.equal(safe.changesRedacted.nested.accessToken, '[REDACTED]');
  assert.equal(safe.changesRedacted.nested.messageBody, '[REDACTED]');
  assert.equal(safe.changesRedacted.nested.amountVnd, 5000);
});

test('audit redaction preserves generated UUID request IDs that resemble phone numbers', () => {
  const requestId = '85819549-bf6f-4133-bc53-a9673811274e';
  const targetId = '6ac4faa7be88434980559e8f';
  const safe = redactAuditEvent({
    actorRole: 'staff', requestId, action: 'order.transition', targetType: 'order',
    targetId, outcome: 'success',
    changesRedacted: { fromStatus: 'processing', toStatus: 'shipped' },
  });

  assert.equal(safe.requestId, requestId);
  assert.equal(safe.targetId, targetId);
  assert.deepEqual(safe.changesRedacted, { fromStatus: 'processing', toStatus: 'shipped' });
});

test('admin audit listing uses stable opaque cursors and bounds date filters', async () => {
  const rows = [
    { _id: '507f1f77bcf86cd799439022', requestId: 'req-1', outcome: 'success', action: 'user.block', targetType: 'user', actorId: '507f1f77bcf86cd799439011', createdAt: new Date('2026-10-06T00:00:00.000Z'), changesRedacted: { token: '[REDACTED]' } },
    { _id: '507f1f77bcf86cd799439023', requestId: 'req-2', outcome: 'success', action: 'user.role', targetType: 'user', actorId: '507f1f77bcf86cd799439011', createdAt: new Date('2026-10-05T00:00:00.000Z'), changesRedacted: {} },
  ];
  const AuditLog = {
    find(filter) {
      const found = rows.filter((row) => (!filter.action || row.action === filter.action)
        && (!filter.actorId || row.actorId === filter.actorId)
        && (!filter.createdAt?.$gte || row.createdAt >= filter.createdAt.$gte)
        && (!filter.createdAt?.$lte || row.createdAt <= filter.createdAt.$lte));
      return query(found);
    },
    countDocuments: async () => rows.length,
  };
  const service = createAuditService({ AuditLog });

  const first = await service.list({ from: '2026-10-05T00:00:00.000Z', to: '2026-10-06T00:00:00.000Z', limit: 1 });
  assert.equal(first.items.length, 1);
  assert.ok(first.nextCursor);
  assert.equal(first.items[0].changesRedacted.token, '[REDACTED]');
  await assert.rejects(() => service.list({ from: 'tomorrow', to: 'yesterday' }), { code: 'VALIDATION_ERROR' });
  await assert.rejects(() => service.list({ from: '2026-10-07T00:00:00.000Z', to: '2026-10-06T00:00:00.000Z' }), { code: 'VALIDATION_ERROR' });
});

test('SMTP adapter keeps stable Message-ID and fails unavailable without a real transport', async () => {
  const provider = createSmtpProvider({ transporter: null, from: 'shop@example.test' });
  await assert.rejects(() => provider.send({ eventId: 'mail:1', to: 'guest@example.test', templateKey: 'order_confirmation', variables: { orderCode: 'TL-1' } }), { code: 'MAIL_UNAVAILABLE' });

  const sent = [];
  const configured = createSmtpProvider({
    from: 'TRO & LAM <shop@example.test>',
    transporter: {
      sendMail: async (message) => {
        sent.push(message);
        return { messageId: message.messageId, accepted: [message.to], rejected: [] };
      },
    },
  });
  const first = await configured.send({ eventId: 'mail:1', to: 'guest@example.test', templateKey: 'order_confirmation', variables: { orderCode: '<TL-1>' } });
  const second = await configured.send({ eventId: 'mail:1', to: 'guest@example.test', templateKey: 'order_confirmation', variables: { orderCode: '<TL-1>' } });
  assert.equal(first.accepted, true);
  assert.equal(first.messageId, second.messageId);
  assert.match(sent[0].html, /&lt;TL-1&gt;/);
  assert.throws(() => renderMailTemplate('order_confirmation', { orderCode: 'x\r\nBcc: attacker@example.test' }), { code: 'VALIDATION_ERROR' });
});

test('SMTP provider retries unresolved recipients when Nodemailer rejects or malforms its result', async () => {
  const recipient = 'guest@example.test';
  const unsuccessfulResults = [
    { accepted: [], rejected: [recipient] },
    { accepted: [], rejected: [] },
    { messageId: '<transport-returned-no-recipient-lists@example.test>' },
    { accepted: recipient, rejected: [] },
    { accepted: ['another@example.test'], rejected: [] },
    { accepted: [recipient], rejected: [recipient] },
  ];

  for (const response of unsuccessfulResults) {
    const provider = createSmtpProvider({
      from: 'TRO & LAM <shop@example.test>',
      transporter: { sendMail: async () => response },
    });
    await assert.rejects(() => provider.send({
      eventId: 'mail:recipient-check', to: recipient,
      templateKey: 'order_confirmation', variables: { orderCode: 'TL-1' },
    }), { code: 'MAIL_UNAVAILABLE' });
  }
});

test('SMTP templates validate same-origin account invitations and escape appeal review notes', () => {
  const invitation = renderMailTemplate('user_invitation', {
    actionUrl: 'https://shop.example.test/chap-nhan-loi-moi#token', name: '<Mai>', role: 'staff',
  }, { publicWebUrl: 'https://shop.example.test' });
  assert.match(invitation.html, /&lt;Mai&gt;/);
  assert.match(invitation.html, /https:\/\/shop\.example\.test\/chap-nhan-loi-moi#token/);
  assert.throws(() => renderMailTemplate('user_invitation', { actionUrl: 'https://outside.example.test/invite' }, { publicWebUrl: 'https://shop.example.test' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => renderMailTemplate('user-invitation', { actionUrl: 'https://shop.example.test/invite' }, { publicWebUrl: 'https://shop.example.test' }), { code: 'VALIDATION_ERROR' });
  const appeal = renderMailTemplate('appeal_update', { appealStatus: 'approved', reviewNote: '<Đã xem xét>' });
  assert.match(appeal.html, /&lt;Đã xem xét&gt;/);
  assert.throws(() => renderMailTemplate('appeal_update', { appealStatus: 'approved', reviewNote: 'x\u0001' }), { code: 'VALIDATION_ERROR' });
});

test('SMTP templates render appeal verification and account status without trusting input labels', () => {
  const appealCode = renderMailTemplate('appeal_access_code', {
    name: '<Lan>', verificationCode: '012345', expiresAt: '2026-10-06T00:00:00.000Z',
  });
  assert.match(appealCode.html, /&lt;Lan&gt;/);
  assert.match(appealCode.text, /012345/);
  assert.ok(appealCode.text.includes(new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date('2026-10-06T00:00:00.000Z'))));
  assert.throws(() => renderMailTemplate('appeal_access_code', {
    verificationCode: '1234567', expiresAt: '2026-10-06T00:00:00.000Z',
  }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => renderMailTemplate('appeal_access_code', {
    verificationCode: '012345', expiresAt: 'not-a-date',
  }), { code: 'VALIDATION_ERROR' });

  const accountStatus = renderMailTemplate('account_status_update', { name: 'Lan', role: 'customer', status: 'blocked' });
  assert.match(accountStatus.text, /khách hàng/);
  assert.match(accountStatus.text, /đã tạm khóa/);
  assert.throws(() => renderMailTemplate('account_status_update', { role: 'owner', status: 'blocked' }), { code: 'VALIDATION_ERROR' });
});

test('P02 identity mail aliases map to encrypted P09 allowlisted templates', async () => {
  const saved = [];
  const OutboxEvent = {
    async findOneAndUpdate(_filter, update) {
      const row = { _id: `mail-${saved.length + 1}`, ...update.$setOnInsert };
      saved.push(row);
      return row;
    },
    async findOne(filter) { return saved.find((row) => row.eventKey === filter.eventKey) || null; },
  };
  const cipher = createOutboxPayloadCipher({ key: Buffer.alloc(32, 9) });
  const ports = createOperationsPorts({
    models: { OutboxEvent, AuditLog: {} },
    encryptMailPayload: cipher.encrypt,
    uuid: (() => { let index = 0; return () => `identity-mail-${++index}`; })(),
  });
  const recipient = 'account@example.test';
  const source = [
    ['verify-email', { name: 'Lan', link: 'https://shop.example.test/#token', ignored: 'drop' }, 'verify_email', { name: 'Lan', actionUrl: 'https://shop.example.test/#token' }],
    ['reset-password', { name: 'Lan', link: 'https://shop.example.test/#reset' }, 'reset_password', { name: 'Lan', actionUrl: 'https://shop.example.test/#reset' }],
    ['user-invitation', { name: 'Lan', role: 'staff', link: 'https://shop.example.test/#invite' }, 'user_invitation', { name: 'Lan', role: 'staff', actionUrl: 'https://shop.example.test/#invite' }],
    ['appeal-access-code', { name: 'Lan', verificationCode: '012345', expiresAt: '2026-10-06T00:00:00.000Z' }, 'appeal_access_code', { name: 'Lan', verificationCode: '012345', expiresAt: '2026-10-06T00:00:00.000Z' }],
    ['appeal-decision', { name: 'Lan', decision: 'approved', reviewNote: 'Đã xác minh' }, 'appeal_update', { name: 'Lan', appealStatus: 'approved', reviewNote: 'Đã xác minh' }],
    ['account-status-update', { name: 'Lan', role: 'customer', status: 'blocked' }, 'account_status_update', { name: 'Lan', role: 'customer', status: 'blocked' }],
  ];

  for (const [identityTemplate, input, expectedTemplate, expectedData] of source) {
    await ports.outbox.enqueueMail(identityTemplate, recipient, input);
    const encrypted = saved.at(-1).payload.deliveries[0].encryptedMail;
    assert.deepEqual(cipher.decrypt(encrypted), { template: expectedTemplate, recipient, data: expectedData });
  }
  assert.throws(() => ports.outbox.enqueueMail('appeal-access-code', recipient, {
    verificationCode: 'bad', expiresAt: '2026-10-06T00:00:00.000Z',
  }), /Identity appeal access code is invalid/);
  assert.equal(saved.length, source.length);
});

test('P05, P06, and P07 mail keys map to supported templates and encrypt only rendered fields', async () => {
  const saved = [];
  const OutboxEvent = {
    async findOneAndUpdate(_filter, update) {
      const row = { _id: `mail-${saved.length + 1}`, ...update.$setOnInsert };
      saved.push(row);
      return row;
    },
    async findOne(filter) { return saved.find((row) => row.eventKey === filter.eventKey) || null; },
  };
  const cipher = createOutboxPayloadCipher({ key: Buffer.alloc(32, 6) });
  const ports = createOperationsPorts({ models: { OutboxEvent, AuditLog: {} }, encryptMailPayload: cipher.encrypt });
  const source = [
    ['order-confirmation', {
      orderCode: 'TL-2026-1', recipientName: 'Lan', totalVnd: 150000, itemCount: 2,
    }, 'order_confirmation', { orderCode: 'TL-2026-1' }],
    ['guest-order-access-code', {
      orderCode: 'TL-2026-1', verificationCode: '012345', expiresAt: '2026-10-06T00:00:00.000Z',
    }, 'order_access_code', { code: '012345' }],
    ['order_update', { orderCode: 'TL-2026-1', status: 'shipped' }, 'order_update', { orderCode: 'TL-2026-1', status: 'shipped' }],
    ['ticket_reply', { ticketCode: 'TL-ABC' }, 'ticket_reply', { ticketCode: 'TL-ABC' }],
    ['new_lead', { reference: 'contact-1' }, 'new_lead', { reference: 'contact-1' }],
  ];

  for (const [sourceTemplate, data, expectedTemplate, expectedData] of source) {
    await ports.enqueueMail(sourceTemplate, 'buyer@example.test', data);
    const encrypted = saved.at(-1).payload.deliveries[0].encryptedMail;
    assert.deepEqual(cipher.decrypt(encrypted), {
      template: expectedTemplate, recipient: 'buyer@example.test', data: expectedData,
    });
  }
  assert.throws(
    () => ports.enqueueMail('guest-order-access-code', 'buyer@example.test', { verificationCode: '123' }),
    /Commerce order access code is invalid/,
  );
  assert.equal(saved.length, source.length);
});

test('mail payload encryption protects retry data and detects tampering', () => {
  const cipher = createOutboxPayloadCipher({ key: Buffer.alloc(32, 7) });
  const original = { template: 'order_access_code', recipient: 'guest@example.test', data: { code: '123456' } };
  const encrypted = cipher.encrypt(original);
  assert.notEqual(JSON.stringify(encrypted).includes('guest@example.test'), true);
  assert.deepEqual(cipher.decrypt(encrypted), original);
  assert.throws(() => cipher.decrypt({ ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA` }), { code: 'MAIL_UNAVAILABLE' });
});

test('settings accept only the documented business groups and reject provider secrets', () => {
  assert.deepEqual(validateBusinessSettingsWrite({
    values: { codEnabled: false, shippingZones: [{ id: 'mien-bac', provinceNames: ['Hà Nội', 'Hải Phòng'], feeVnd: 30000 }] },
    expectedVersion: 0,
    reason: 'Cập nhật cấu hình vận hành',
  }).values.codEnabled, false);
  assert.throws(() => validateBusinessSettingsWrite({ values: { smtpPassword: 'secret' }, expectedVersion: 0, reason: 'Cấu hình' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateBusinessSettingsWrite({ values: { codEnabled: true, unsupported: 1 }, expectedVersion: 0, reason: 'Cấu hình' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateBusinessSettingsWrite({ values: { checkoutLimits: { providerUrl: 'https://attacker.test' } }, expectedVersion: 0, reason: 'Cấu hình' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateBusinessSettingsWrite({ values: { codEnabled: 'yes' }, expectedVersion: 0, reason: 'Cấu hình' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateBusinessSettingsWrite({ values: { checkoutLimits: { lowStockThreshold: 2 } }, expectedVersion: 0, reason: 'Cấu hình' }), { code: 'VALIDATION_ERROR' });
  assert.deepEqual(validateBusinessSettingsWrite({ values: { checkoutLimits: {} }, expectedVersion: 0, reason: 'Cấu hình' }).values, { checkoutLimits: {} });
  assert.deepEqual(validateBusinessSettingsWrite({ values: { checkoutLimits: { maxPendingCodOrders: 3 } }, expectedVersion: 0, reason: 'Cấu hình' }).values, { checkoutLimits: { maxPendingCodOrders: 3 } });
  assert.throws(() => validateBusinessSettingsWrite({ values: { checkoutLimits: { maxPendingCodOrders: 0 } }, expectedVersion: 0, reason: 'Cấu hình' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateBusinessSettingsWrite({ values: { checkoutLimits: { maxPendingCodOrders: 3, maximumItems: 2 } }, expectedVersion: 0, reason: 'Cấu hình' }), { code: 'VALIDATION_ERROR' });
  assert.deepEqual(validateBusinessSettingsWrite({ values: { shippingZones: [] }, expectedVersion: 0, reason: 'Tắt checkout khi chưa có phí đã duyệt' }).values.shippingZones, []);
  assert.deepEqual(validateBusinessSettingsWrite({ values: { shippingZones: [{ id: 'mien-bac', provinceNames: ['Hà Nội'], feeVnd: 0 }] }, expectedVersion: 0, reason: 'Cấu hình' }).values.shippingZones[0].feeVnd, 0);
  assert.throws(() => validateBusinessSettingsWrite({ values: { shippingZones: [{ id: 'mien-bac', provinceNames: ['Hà Nội'], feeVnd: -1 }] }, expectedVersion: 0, reason: 'Cấu hình' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateBusinessSettingsWrite({ values: { shippingZones: [{ id: 'mien-bac', name: 'Miền Bắc', provinceNames: ['Hà Nội'], feeVnd: 30000 }] }, expectedVersion: 0, reason: 'Cấu hình' }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateBusinessSettingsWrite({ values: { shippingZones: [
    { id: 'mien-bac', provinceNames: ['Hà Nội'], feeVnd: 30000 },
    { id: 'mien-nam', provinceNames: ['Ha Noi'], feeVnd: 40000 },
  ] }, expectedVersion: 0, reason: 'Cấu hình' }), { code: 'VALIDATION_ERROR' });
  assert.deepEqual(sanitizeBusinessSettingsValues({ codEnabled: 'yes', smtpPassword: 'private', supportWindows: {} }), { supportWindows: {} });
});

function createMemorySettingsModel(initial) {
  class MemorySettings {
    static row = initial ? structuredClone(initial) : null;

    static db = {
      startSession: async () => ({ withTransaction: async (callback) => callback(), endSession: async () => {} }),
    };

    static findOne() {
      return memoryQuery(() => this.row ? structuredClone(this.row) : null);
    }

    static findOneAndUpdate(filter, update, options) {
      return memoryQuery(() => {
        if (this.row && (this.row.key !== filter.key || this.row.version !== filter.version)) return null;
        if (!this.row && !options.upsert) return null;
        const created = this.row || { key: update.$setOnInsert.key, values: {}, version: 0 };
        this.row = {
          ...created,
          ...update.$set,
          ...(!this.row ? update.$setOnInsert : {}),
          version: created.version + update.$inc.version,
        };
        return structuredClone(this.row);
      });
    }
  }
  return MemorySettings;
}

function memoryQuery(resolve) {
  return {
    session() { return this; },
    lean() { return Promise.resolve(resolve()); },
    then(onFulfilled, onRejected) { return Promise.resolve(resolve()).then(onFulfilled, onRejected); },
  };
}

test('business settings use optimistic versions, audit changes, and hide unsafe legacy values', async () => {
  const BusinessSetting = createMemorySettingsModel({
    key: 'business', version: 3, values: { smtpPassword: 'private', codEnabled: 'invalid', supportWindows: { weekdays: [] } },
  });
  const audit = [];
  const service = createBusinessSettingsService({
    BusinessSetting,
    auditService: { append: async (event, options) => audit.push({ event, options }) },
  });

  const visible = await service.get();
  assert.deepEqual(visible.values, { supportWindows: { weekdays: [] } });
  const updated = await service.update({ values: { codEnabled: true }, expectedVersion: 3, reason: 'Bật theo quyết định đã duyệt' }, {
    actorId: '507f1f77bcf86cd799439011', requestId: 'req-settings-1',
  });
  assert.equal(updated.version, 4);
  assert.deepEqual(updated.values, { codEnabled: true, supportWindows: { weekdays: [] } });
  assert.equal(audit.length, 1);
  assert.equal(audit[0].event.action, 'settings.business.update');
  assert.equal(audit[0].event.changesRedacted.version, 4);
  assert.equal(audit[0].event.changesRedacted.reason, 'Bật theo quyết định đã duyệt');
  await assert.rejects(() => service.update({ values: { codEnabled: false }, expectedVersion: 3, reason: 'Thử phiên bản cũ' }), { code: 'VERSION_CONFLICT' });
});

test('dashboard reports persisted queues and finance from their owning ledger port', async () => {
  const Order = {
    countDocuments: async (query) => query.status === 'pending' ? 2 : 1,
    aggregate: async (pipeline) => pipeline.some((stage) => stage.$unwind)
      ? [{ productId: '507f1f77bcf86cd799439011', sku: 'TL-1', name: 'Bình gốm', quantity: 3, orderCount: 2 }]
      : [{ _id: 'pending', count: 2 }, { _id: 'processing', count: 1 }],
  };
  const Ticket = { countDocuments: async (query) => query.assignedTo ? 4 : 5 };
  const Contact = { countDocuments: async () => 6 };
  const NotificationModel = { countDocuments: async () => 7 };
  const ledgerCalls = [];
  const dashboard = createDashboardService({
    Order,
    Ticket,
    Contact,
    Notification: NotificationModel,
    orderMetrics: { getStaffQueueMetrics: async () => ({ deliveryFailed: 1, assignedToMe: 2 }) },
    financeLedger: { getStatistics: async (range) => {
      ledgerCalls.push(range);
      if (range.from.toISOString() === '2026-09-27T17:00:00.000Z') {
        return {
          grossCollectedVnd: 600_000, refundedVnd: 100_000,
          daily: [
            { date: '2026-09-28', grossCollectedVnd: 200_000 },
            { date: '2026-09-30', grossCollectedVnd: 400_000 },
          ],
        };
      }
      return {
        grossCollectedVnd: 900_000, refundedVnd: 200_000,
        daily: [
          { date: '2026-10-01', grossCollectedVnd: 400_000 },
          { date: '2026-10-03', grossCollectedVnd: 500_000 },
        ],
      };
    } },
  });

  const staff = await dashboard.getStaffDashboard({ actorId: 'staff-1' });
  assert.equal(staff.orderQueues.pending, 2);
  assert.equal(staff.orderQueues.deliveryFailed, 1);
  assert.equal(staff.ticketQueues.assignedToMe, 4);
  assert.equal(staff.lowStock, null);
  const admin = await dashboard.getAdminStatistics({
    from: '2026-10-01T00:00:00+07:00', to: '2026-10-03T23:59:59.999+07:00',
  });
  assert.equal(admin.grossCollectedVnd, 900_000);
  assert.equal(admin.refundedVnd, 200_000);
  assert.equal(admin.netCollectedVnd, 700_000);
  assert.equal(admin.orderCounts.pending, 2);
  assert.equal(admin.topProducts[0].quantity, 3);
  assert.deepEqual(admin.comparison, {
    from: '2026-09-27T17:00:00.000Z',
    to: '2026-09-30T16:59:59.999Z',
    grossCollectedVnd: 600_000,
    deltaVnd: 300_000,
    changePercent: 50,
  });
  assert.deepEqual(admin.revenueTrend.daily, [
    { date: '2026-10-01', grossCollectedVnd: 400_000 },
    { date: '2026-10-02', grossCollectedVnd: 0 },
    { date: '2026-10-03', grossCollectedVnd: 500_000 },
  ]);
  assert.deepEqual(admin.revenueTrend.comparisonDaily, [
    { date: '2026-10-01', comparisonDate: '2026-09-28', grossCollectedVnd: 200_000 },
    { date: '2026-10-02', comparisonDate: '2026-09-29', grossCollectedVnd: 0 },
    { date: '2026-10-03', comparisonDate: '2026-09-30', grossCollectedVnd: 400_000 },
  ]);
  assert.equal(ledgerCalls.length, 2);
  assert.ok(ledgerCalls.every(({ timezone }) => timezone === 'Asia/Ho_Chi_Minh'));
});

test('admin statistics accept up to 367 Vietnam calendar days and reject broader ranges', async () => {
  assert.throws(() => parseAdminStatisticsRange({}), { code: 'VALIDATION_ERROR' });
  assert.doesNotThrow(() => parseAdminStatisticsRange({
    from: '2025-01-01T00:00:00+07:00', to: '2026-01-02T23:59:59.999+07:00',
  }));
  assert.throws(() => parseAdminStatisticsRange({
    from: '2025-01-01T00:00:00+07:00', to: '2026-01-03T00:00:00+07:00',
  }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => parseAdminStatisticsRange({
    from: '2025-01-01T00:00:00Z', to: '2026-01-04T00:00:00Z',
  }), { code: 'VALIDATION_ERROR' });
});

test('outbox contract rejects plain mail data before it can be persisted', () => {
  assert.throws(() => validateOutboxEvent({
    eventKey: 'mail:plain', type: 'operations.delivery', aggregateType: 'mail', aggregateId: 'mail:plain', aggregateVersion: 1,
    payload: { deliveries: [{ mail: { template: 'order_confirmation', recipient: 'guest@example.test', data: {} } }] },
  }), { code: 'VALIDATION_ERROR' });
});

class MemoryOutbox {
  static rows = [];
  static db = {
    startSession: async () => ({
      withTransaction: async (callback) => callback(),
      endSession: async () => {},
    }),
  };

  static async findOneAndUpdate(filter, update) {
    const eligible = this.rows.filter((row) => filter.type.$in.includes(row.type)
      && ((row.state === 'pending' && row.nextAttemptAt <= filter.$or[0].nextAttemptAt.$lte)
        || (row.state === 'processing' && row.leaseUntil <= filter.$or[1].leaseUntil.$lte)))
      .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt);
    const row = eligible[0];
    if (!row) return null;
    Object.assign(row, update.$set, { attempts: row.attempts + update.$inc.attempts });
    return structuredClone(row);
  }

  static async updateOne(filter, update) {
    const row = this.rows.find((entry) => entry._id === filter._id && entry.lockedBy === filter.lockedBy && entry.state === filter.state);
    if (!row) return { modifiedCount: 0 };
    Object.assign(row, update.$set);
    return { modifiedCount: 1 };
  }
}

test('outbox reclaims expired leases and retries until dead-letter with audit and admin alert', async () => {
  let now = new Date('2026-10-06T00:00:00.000Z');
  MemoryOutbox.rows = [{
    _id: 'event-1', eventKey: 'mail:retry-1', type: 'operations.delivery', state: 'processing', attempts: 1,
    nextAttemptAt: now, leaseUntil: new Date(now.getTime() - 1), lockedBy: 'crashed-worker',
    payload: { deliveries: [{ encryptedMail: {
      algorithm: 'aes-256-gcm', version: 1, fingerprint: 'a'.repeat(64), iv: 'aXY=', tag: 'dGFn', ciphertext: 'Y2lwaGVydGV4dA==',
    } }] },
  }];
  const audit = [];
  const alerts = [];
  const worker = createOutboxWorker({
    OutboxEvent: MemoryOutbox,
    Notification: { updateOne: async () => ({ upsertedCount: 1 }) },
    AuditLog: { create: async (rows) => { audit.push(...rows); return rows; } },
    decryptMailPayload: async () => ({ template: 'order_confirmation', recipient: 'guest@example.test', data: { orderCode: 'TL-1' } }),
    mailProvider: { send: async () => { throw Object.assign(new Error('credential-hidden'), { code: 'ECONNECTION' }); } },
    alertOperationsAdmins: async (event) => { alerts.push(event); },
    workerId: 'worker-2', now: () => now, random: () => 0,
  });

  const reclaimed = await worker.runOnce();
  assert.equal(reclaimed.state, 'pending');
  assert.equal(MemoryOutbox.rows[0].lockedBy, null);
  assert.ok(MemoryOutbox.rows[0].nextAttemptAt > now);
  now = new Date(MemoryOutbox.rows[0].nextAttemptAt.getTime() + 1);
  MemoryOutbox.rows[0].attempts = 5;
  MemoryOutbox.rows[0].state = 'pending';
  MemoryOutbox.rows[0].nextAttemptAt = now;
  await worker.runOnce();
  assert.equal(MemoryOutbox.rows[0].state, 'failed');
  assert.equal(audit.length, 1);
  assert.equal(audit[0].reasonCode, 'OUTBOX_DEAD_LETTER');
  assert.equal(alerts.length, 1);
  assert.deepEqual(RETRY_DELAY_MS.slice(0, 3), [60_000, 300_000, 900_000]);
});

test('outbox polling is serial, retries after worker errors, and stops cleanly', async () => {
  let calls = 0;
  const errors = [];
  const runner = startOutboxWorker({
    runOnce: async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('credential-hidden'), { code: 'DATABASE_UNAVAILABLE' });
      return { claimed: false };
    },
  }, { idlePollMs: 10, handledPollMs: 10, onError: (error) => errors.push(error) });

  await new Promise((resolve) => setTimeout(resolve, 45));
  await runner.stop();
  const callsAtStop = calls;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(callsAtStop >= 2);
  assert.equal(calls, callsAtStop);
  assert.deepEqual(errors, [{ code: 'DATABASE_UNAVAILABLE' }]);
});

test('operations router denies staff audit and returns only a user’s own notifications', async () => {
  MemoryNotifications.rows = [];
  const notificationService = createNotificationService({ Notification: MemoryNotifications });
  await notificationService.consume({ eventKey: 'evt-1', recipients: ['user-a'], category: 'system', title: 'Status', body: 'Updated', href: '/tai-khoan' });
  const auth = {
    authenticate: (req, _res, next) => { req.actor = { id: req.headers['x-user-id'] || 'user-a', role: req.headers['x-role'] || 'customer', status: 'active' }; next(); },
    requireCsrf: (_req, _res, next) => next(),
  };
  const router = createOperationsRouter({
    auth,
    notificationService,
    auditService: { list: async () => ({ items: [{ action: 'user.block', changesRedacted: { password: '[REDACTED]' } }], nextCursor: null }) },
    dashboardService: { getStaffDashboard: async () => ({ orderQueues: {}, ticketQueues: {}, lowStock: null, operationalCounts: {} }), getAdminStatistics: async () => ({ grossCollectedVnd: 0, refundedVnd: 0, netCollectedVnd: 0, orderCounts: {}, topProducts: [] }) },
    settingsService: { get: async () => ({ values: {}, version: 0 }) },
  });
  const app = express().use(express.json()).use(router);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: { code: error.code || 'INTERNAL_ERROR' } }));

  assert.equal((await request(app).get('/notifications')).body.data.length, 1);
  assert.equal((await request(app).get('/notifications').set('x-user-id', 'user-b')).body.data.length, 0);
  assert.equal((await request(app).get('/admin/audit-logs').set('x-role', 'staff')).status, 403);
  assert.equal((await request(app).get('/admin/audit-logs').set('x-role', 'admin')).body.data[0].changesRedacted.password, '[REDACTED]');
});
