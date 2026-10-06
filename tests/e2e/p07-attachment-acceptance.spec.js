import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { SupportAttachment } from '../../backend/src/support/support.models.js';
import { User } from '../../backend/src/models/identity/user.model.js';
import { FIXTURE_PASSWORD, USERS, assertDedicatedLocalMongoUri } from './fixtures.js';

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
  await page.getByLabel('Mật khẩu', { exact: true }).fill(FIXTURE_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const destination = user.role === 'customer' ? 'Hồ sơ của tôi' : 'Bảng công việc';
  await expect(page.getByRole('heading', { name: destination, exact: true })).toBeVisible();
}

async function seedSyntheticAttachmentMetadata(ticketId) {
  const { uri, databaseName } = assertDedicatedLocalMongoUri(process.env.P11_E2E_MONGODB_URI);
  const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
  try {
    if (connection.name !== databaseName) throw new Error('P07 attachment fixture connected to an unexpected test database.');
    const UserRead = connection.model('P07AttachmentUserRead', User.schema);
    const AttachmentFixture = connection.model('P07AttachmentFixture', SupportAttachment.schema);
    const [customer, otherCustomer, staff] = await Promise.all([
      UserRead.findOne({ emailNormalized: USERS.customer.email }).exec(),
      UserRead.findOne({ emailNormalized: USERS.otherCustomer.email }).exec(),
      UserRead.findOne({ emailNormalized: USERS.staff.email }).exec(),
    ]);
    if (!customer || !otherCustomer || !staff) throw new Error('P07 synthetic owner fixture users are missing.');

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
        uploadedByUserId: customer._id,
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
        uploadedByUserId: customer._id,
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
        uploadedByUserId: staff._id,
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
  } finally {
    await connection.close();
  }
}

async function readAttachmentAudit(ticketId) {
  const { uri, databaseName } = assertDedicatedLocalMongoUri(process.env.P11_E2E_MONGODB_URI);
  const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
  try {
    if (connection.name !== databaseName) throw new Error('P07 attachment audit connected to an unexpected test database.');
    const AttachmentRead = connection.model('P07AttachmentAudit', SupportAttachment.schema);
    return await AttachmentRead.find({ $or: [{ ticketId }, { storageKey: /^p07-e2e-fixture\// }] })
      .sort({ storageKey: 1 }).lean().exec();
  } finally {
    await connection.close();
  }
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
  const orderId = process.env.P11_E2E_FIXTURE_STAFF_ORDER_ID;

  await login(page, USERS.customer);
  await page.goto('/tai-khoan/ho-tro');
  const createForm = page.locator('.support-stack > form.support-card');
  await expect(createForm).toHaveCount(1);
  await createForm.getByRole('combobox', { name: 'Chủ đề', exact: true }).selectOption('complaint');
  await createForm.getByRole('textbox', { name: 'Tiêu đề', exact: true }).fill(subject);
  await createForm.getByRole('textbox', { name: /Mã đơn hàng/u }).fill(orderId);
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
    await login(staffPage, USERS.staff);
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
    const ids = await seedSyntheticAttachmentMetadata(ticketId);
    const otherCustomerPage = await otherCustomerContext.newPage();
    await login(otherCustomerPage, USERS.otherCustomer);

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
