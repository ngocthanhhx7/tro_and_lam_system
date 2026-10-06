import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import argon2 from 'argon2';
import mongoose from 'mongoose';
import { SupportAttachment } from '../../backend/src/support/support.models.js';
import { User } from '../../backend/src/models/identity/user.model.js';
import { assertDedicatedLocalMongoUri } from './fixtures.js';

const P07_PASSWORD = 'P07-only synthetic attachment password';
const P07_USERS = Object.freeze({
  customer: Object.freeze({ name: 'P07 Attachment Customer', email: 'attachment.customer.p07@example.test', role: 'customer' }),
  otherCustomer: Object.freeze({ name: 'P07 Other Attachment Customer', email: 'other.attachment.customer.p07@example.test', role: 'customer' }),
  staff: Object.freeze({ name: 'P07 Attachment Staff', email: 'attachment.staff.p07@example.test', role: 'staff' }),
});

async function browserApi(page, path, init = {}) {
  return page.evaluate(async ({ apiPath, requestInit }) => {
    const method = String(requestInit.method || 'GET').toUpperCase();
    const headers = new Headers(requestInit.headers || {});
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (mutating && !headers.has('X-CSRF-Token')) {
      const csrfResponse = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
      const csrfBody = await csrfResponse.json();
      headers.set('X-CSRF-Token', csrfBody.data.csrfToken);
    }
    const options = { credentials: 'include', ...requestInit, headers };
    if (requestInit.body && typeof requestInit.body === 'object') {
      options.body = JSON.stringify(requestInit.body);
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(apiPath, options);
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }, { apiPath: path, requestInit: init });
}

async function login(page, user) {
  await page.goto('/dang-nhap');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(P07_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const destination = user.role === 'customer' ? 'Hồ sơ của tôi' : 'Bảng công việc';
  await expect(page.getByRole('heading', { name: destination, exact: true })).toBeVisible();
}

async function withP07Database(callback) {
  const { uri, databaseName } = assertDedicatedLocalMongoUri(process.env.P11_E2E_MONGODB_URI);
  const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
  try {
    if (connection.name !== databaseName) throw new Error('P07 attachment fixture connected to an unexpected test database.');
    return await callback(connection);
  } finally {
    await connection.close();
  }
}

async function seedSyntheticUsers() {
  return withP07Database(async (connection) => {
    const UserFixture = connection.model('P07AttachmentUserFixture', User.schema);
    const passwordHash = await argon2.hash(P07_PASSWORD);
    const users = await UserFixture.create(Object.values(P07_USERS).map((user) => ({
      ...user,
      emailNormalized: user.email,
      passwordHash,
      status: 'active',
      emailVerifiedAt: new Date(),
      authVersion: 0,
      version: 0,
    })));
    return Object.fromEntries(users.map((user) => [user.emailNormalized, String(user._id)]));
  });
}

async function seedSyntheticAttachmentMetadata(ticketId, userIds) {
  return withP07Database(async (connection) => {
    const AttachmentFixture = connection.model('P07AttachmentFixture', SupportAttachment.schema);

    const ids = {
      pending: new mongoose.Types.ObjectId(),
      customerReady: new mongoose.Types.ObjectId(),
      internalLinked: new mongoose.Types.ObjectId(),
    };
    const fixtureKey = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await AttachmentFixture.create([
      {
        _id: ids.pending,
        storageKey: `p07-e2e-fixture/${fixtureKey}/pending-no-object`,
        uploadedByUserId: userIds[P07_USERS.customer.email],
        purpose: 'ticket',
        mimeType: 'image/png',
        bytes: 8,
        state: 'pending_upload',
        visibility: 'customer',
        expiresAt,
        version: 0,
      },
      {
        _id: ids.customerReady,
        storageKey: `p07-e2e-fixture/${fixtureKey}/ready-no-object`,
        uploadedByUserId: userIds[P07_USERS.customer.email],
        purpose: 'ticket',
        mimeType: 'image/png',
        bytes: 8,
        state: 'ready',
        visibility: 'customer',
        expiresAt,
        version: 0,
      },
      {
        _id: ids.internalLinked,
        storageKey: `p07-e2e-fixture/${fixtureKey}/internal-no-object`,
        uploadedByUserId: userIds[P07_USERS.staff.email],
        purpose: 'ticket',
        ticketId,
        mimeType: 'image/png',
        bytes: 8,
        state: 'linked',
        visibility: 'internal',
        expiresAt,
        version: 1,
      },
    ]);
    return Object.fromEntries(Object.entries(ids).map(([key, value]) => [key, String(value)]));
  });
}

async function readAttachmentAudit(ticketId) {
  return withP07Database(async (connection) => {
    const AttachmentRead = connection.model('P07AttachmentAudit', SupportAttachment.schema);
    return await AttachmentRead.find({ $or: [{ ticketId }, { storageKey: /^p07-e2e-fixture\// }] })
      .sort({ storageKey: 1 }).lean().exec();
  });
}

function expectUnavailable(response) {
  expect(response.status).toBe(503);
  expect(response.body.error?.code).toBe('MEDIA_UNAVAILABLE');
  expect(response.body.data).toBeUndefined();
  expect(JSON.stringify(response.body)).not.toContain('https://');
}

test('P07 customer and staff attachment routes fail closed and preserve owner privacy without storage', async ({ page, browser }) => {
  const subject = 'P07 synthetic attachment storage acceptance';
  const initialMessage = 'Synthetic support message for attachment storage acceptance.';
  const userIds = await seedSyntheticUsers();

  await login(page, P07_USERS.customer);
  await page.goto('/tai-khoan/ho-tro');
  const createForm = page.locator('.support-stack > form.support-card');
  await expect(createForm).toHaveCount(1);
  await createForm.getByRole('combobox', { name: 'Chủ đề', exact: true }).selectOption('complaint');
  await createForm.getByRole('textbox', { name: 'Tiêu đề', exact: true }).fill(subject);
  await createForm.getByRole('textbox', { name: 'Nội dung', exact: true }).fill(initialMessage);
  const createTicketResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/tickets')
    && response.request().method() === 'POST');
  await createForm.getByRole('button', { name: 'Tạo yêu cầu', exact: true }).click();
  const createTicketResponse = await createTicketResponsePromise;
  const createTicketBody = await createTicketResponse.json();
  expect(createTicketResponse.status(), JSON.stringify(createTicketBody)).toBe(201);
  const ticketId = createTicketBody.data.ticket.id;

  const customerUpload = await browserApi(page, '/api/v1/attachments/uploads', {
    method: 'POST',
    body: { purpose: 'ticket', ticketId, mimeType: 'image/png', bytes: 8, visibility: 'customer' },
  });
  expectUnavailable(customerUpload);

  const staffContext = await browser.newContext();
  const otherCustomerContext = await browser.newContext();
  try {
    const staffPage = await staffContext.newPage();
    await login(staffPage, P07_USERS.staff);
    await staffPage.goto('/staff/support');
    const ticketLink = staffPage.locator('.support-ticket-list').getByRole('link').filter({ hasText: subject });
    await expect(ticketLink).toBeVisible();
    await ticketLink.click();
    await expect(staffPage.getByRole('heading', { name: subject, exact: true })).toBeVisible();

    const staffUpload = await browserApi(staffPage, '/api/v1/attachments/uploads', {
      method: 'POST',
      body: { purpose: 'ticket', ticketId, mimeType: 'image/png', bytes: 8, visibility: 'internal' },
    });
    expectUnavailable(staffUpload);

    const beforeSeed = await readAttachmentAudit(ticketId);
    expect(beforeSeed).toEqual([]);
    const ids = await seedSyntheticAttachmentMetadata(ticketId, userIds);
    const otherCustomerPage = await otherCustomerContext.newPage();
    await login(otherCustomerPage, P07_USERS.otherCustomer);

    const ownerFinalize = await browserApi(page, `/api/v1/attachments/${ids.pending}/finalize`, {
      method: 'POST', body: {},
    });
    expectUnavailable(ownerFinalize);
    const nonOwnerFinalize = await browserApi(otherCustomerPage, `/api/v1/attachments/${ids.pending}/finalize`, {
      method: 'POST', body: {},
    });
    expect(nonOwnerFinalize.status).toBe(404);
    expect(nonOwnerFinalize.body.error?.code).toBe('NOT_FOUND');

    const ownerDownload = await browserApi(page, `/api/v1/attachments/${ids.customerReady}/download`);
    expectUnavailable(ownerDownload);

    const nonOwnerDownload = await browserApi(otherCustomerPage, `/api/v1/attachments/${ids.customerReady}/download`);
    expect(nonOwnerDownload.status).toBe(404);
    expect(nonOwnerDownload.body.error?.code).toBe('NOT_FOUND');

    const customerInternalDownload = await browserApi(page, `/api/v1/attachments/${ids.internalLinked}/download`);
    expect(customerInternalDownload.status).toBe(404);
    expect(customerInternalDownload.body.error?.code).toBe('NOT_FOUND');
    const staffInternalDownload = await browserApi(staffPage, `/api/v1/attachments/${ids.internalLinked}/download`);
    expectUnavailable(staffInternalDownload);

    const persisted = await readAttachmentAudit(ticketId);
    expect(persisted).toHaveLength(3);
    expect(persisted.map((attachment) => attachment.state).sort()).toEqual(['linked', 'pending_upload', 'ready']);
    expect(persisted.every((attachment) => attachment.storageKey.startsWith('p07-e2e-fixture/'))).toBe(true);
    expect(persisted.every((attachment) => attachment.storageKey.includes('-no-object'))).toBe(true);
  } finally {
    await Promise.all([staffContext.close(), otherCustomerContext.close()]);
  }
});
