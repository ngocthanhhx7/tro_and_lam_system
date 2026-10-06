import { expect, test } from '@playwright/test';
import argon2 from 'argon2';
import mongoose from 'mongoose';
import { OutboxEvent } from '../../backend/src/models/operations/outbox-event.model.js';
import { createOutboxPayloadCipher } from '../../backend/src/services/operations/outbox-payload-cipher.js';
import { SupportAttachment, Ticket, TicketMessage } from '../../backend/src/support/support.models.js';
import { User } from '../../backend/src/models/identity/user.model.js';
import { assertDedicatedLocalMongoUri, GUEST_ORDER_CODE, GUEST_ORDER_EMAIL } from './fixtures.js';

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
  await expect(page.getByRole('heading', { name: user.role === 'customer' ? 'Hồ sơ của tôi' : 'Bảng công việc', exact: true })).toBeVisible();
}

async function withP07Database(callback) {
  const { uri, databaseName } = assertDedicatedLocalMongoUri(process.env.P11_E2E_MONGODB_URI);
  const connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
  try {
    if (connection.name !== databaseName) throw new Error('P07 attachment fixture connected to an unexpected test database.');
    return await callback(connection);
  } finally { await connection.close(); }
}

async function seedSyntheticUsers() {
  return withP07Database(async (connection) => {
    const UserFixture = connection.model('P07AttachmentUserFixture', User.schema);
    const passwordHash = await argon2.hash(P07_PASSWORD);
    const fixtures = Object.values(P07_USERS);
    const existingEmails = new Set(await UserFixture.find({ emailNormalized: { $in: fixtures.map((user) => user.email) } })
      .distinct('emailNormalized').exec());
    await UserFixture.insertMany(fixtures.filter((user) => !existingEmails.has(user.email)).map((user) => ({
      ...user, emailNormalized: user.email, passwordHash, status: 'active', emailVerifiedAt: new Date(), authVersion: 0, version: 0,
    })));
  });
}

async function uploadBinary(page, upload, bytes) {
  const encoded = Buffer.from(bytes).toString('base64');
  return page.evaluate(async ({ uploadUrl, method, headers, encodedBytes }) => {
    const binary = Uint8Array.from(atob(encodedBytes), (character) => character.charCodeAt(0));
    const response = await fetch(uploadUrl, { method, headers, body: binary, credentials: 'omit' });
    return response.status;
  }, { uploadUrl: upload.uploadUrl, method: upload.method, headers: upload.headers, encodedBytes: encoded });
}

async function fetchAttachment(page, id) {
  return page.evaluate(async (attachmentId) => {
    const response = await fetch(`/api/v1/attachments/${encodeURIComponent(attachmentId)}/download`, { credentials: 'include' });
    const bytes = await response.arrayBuffer();
    return { status: response.status, contentType: response.headers.get('content-type'), bytes: bytes.byteLength };
  }, id);
}

async function readAttachmentAudit(ticketId) {
  return withP07Database(async (connection) => {
    const AttachmentRead = connection.model('P07AttachmentAudit', SupportAttachment.schema);
    return AttachmentRead.find({ ticketId }).sort({ storageKey: 1 }).lean().exec();
  });
}

async function readGuestOrderAccessCode() {
  const decrypt = createOutboxPayloadCipher({ key: process.env.P11_E2E_MAIL_ENCRYPTION_KEY }).decrypt;
  return withP07Database(async (connection) => {
    const OutboxRead = connection.model('P07OutboxRead', OutboxEvent.schema);
    const events = await OutboxRead.find({ type: 'operations.delivery', aggregateType: 'mail' }).sort({ createdAt: -1 }).lean().exec();
    const messages = events.flatMap((event) => event.payload.deliveries
      .filter((delivery) => delivery.encryptedMail)
      .map((delivery) => decrypt(delivery.encryptedMail)));
    return messages.find((message) => message.template === 'order_access_code' && message.recipient === GUEST_ORDER_EMAIL)?.data.code;
  });
}

test('P07 customer and staff upload, finalize, link, and download private attachments with owner privacy', async ({ page, browser }) => {
  const subject = 'P07 synthetic attachment storage acceptance';
  await seedSyntheticUsers();

  await login(page, P07_USERS.customer);
  await page.goto('/tai-khoan/ho-tro');
  const createForm = page.locator('.support-stack > form.support-card');
  await createForm.getByRole('combobox', { name: 'Chủ đề', exact: true }).selectOption('complaint');
  await createForm.getByRole('textbox', { name: 'Tiêu đề', exact: true }).fill(subject);
  await createForm.getByRole('textbox', { name: 'Nội dung', exact: true }).fill('Synthetic support message for attachment acceptance.');
  const ticketResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/tickets') && response.request().method() === 'POST');
  await createForm.getByRole('button', { name: 'Tạo yêu cầu', exact: true }).click();
  const ticketResponse = await ticketResponsePromise;
  expect(ticketResponse.status()).toBe(201);
  const ticketId = (await ticketResponse.json()).data.ticket.id;

  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const customerUploadResponse = await browserApi(page, '/api/v1/attachments/uploads', {
    method: 'POST', body: { purpose: 'ticket', ticketId, mimeType: 'image/png', bytes: pngSignature.length, visibility: 'customer' },
  });
  expect(customerUploadResponse.status).toBe(201);
  const customerUpload = customerUploadResponse.body.data;
  expect(customerUpload.state).toBe('pending_upload');
  expect(customerUpload.uploadUrl).toMatch(/^\/api\/v1\/attachments\/private\/uploads\//u);
  expect(await uploadBinary(page, customerUpload, pngSignature)).toBe(204);

  const staffContext = await browser.newContext();
  const otherCustomerContext = await browser.newContext();
  try {
    const otherCustomerPage = await otherCustomerContext.newPage();
    await login(otherCustomerPage, P07_USERS.otherCustomer);
    const nonOwnerFinalize = await browserApi(otherCustomerPage, `/api/v1/attachments/${customerUpload.id}/finalize`, { method: 'POST', body: {} });
    expect(nonOwnerFinalize.status).toBe(404);
    expect(nonOwnerFinalize.body.error?.code).toBe('NOT_FOUND');

    const customerFinalize = await browserApi(page, `/api/v1/attachments/${customerUpload.id}/finalize`, { method: 'POST', body: {} });
    expect(customerFinalize.status).toBe(200);
    expect(customerFinalize.body.data.state).toBe('ready');
    const customerMessage = await browserApi(page, `/api/v1/tickets/${ticketId}/messages`, {
      method: 'POST', body: { body: 'Synthetic customer message with a private image.', attachmentIds: [customerUpload.id], visibility: 'customer' },
    });
    expect(customerMessage.status).toBe(201);
    expect(customerMessage.body.data.attachmentIds).toContain(customerUpload.id);
    expect(await fetchAttachment(page, customerUpload.id)).toEqual({ status: 200, contentType: 'image/png', bytes: 8 });
    const nonOwnerDownload = await browserApi(otherCustomerPage, `/api/v1/attachments/${customerUpload.id}/download`);
    expect(nonOwnerDownload.status).toBe(404);
    expect(nonOwnerDownload.body.error?.code).toBe('NOT_FOUND');

    await page.goto(`/tai-khoan/ho-tro/${ticketId}`);
    const replyForm = page.locator('form.support-card.support-form');
    const picker = replyForm.locator('.support-attachment-picker');
    await picker.getByLabel('Chọn ảnh đính kèm', { exact: true }).setInputFiles({
      name: 'p07-customer-ui.png', mimeType: 'image/png', buffer: pngSignature,
    });
    await picker.getByRole('button', { name: 'Tải 1 ảnh lên', exact: true }).click();
    await expect(picker.getByRole('status')).toContainText('Đã tải 1 ảnh');
    await replyForm.getByLabel('Phản hồi', { exact: true }).fill('Synthetic customer reply sent from the attachment UI.');
    await replyForm.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click();
    await expect(page.getByText('Synthetic customer reply sent from the attachment UI.')).toBeVisible();

    const staffPage = await staffContext.newPage();
    await login(staffPage, P07_USERS.staff);
    await staffPage.goto(`/staff/support/${ticketId}`);
    await expect(staffPage.getByRole('heading', { name: subject, exact: true })).toBeVisible();

    const staffUploadResponse = await browserApi(staffPage, '/api/v1/attachments/uploads', {
      method: 'POST', body: { purpose: 'ticket', ticketId, mimeType: 'image/png', bytes: pngSignature.length, visibility: 'internal' },
    });
    expect(staffUploadResponse.status).toBe(201);
    const staffUpload = staffUploadResponse.body.data;
    expect(await uploadBinary(staffPage, staffUpload, pngSignature)).toBe(204);
    const staffFinalize = await browserApi(staffPage, `/api/v1/attachments/${staffUpload.id}/finalize`, { method: 'POST', body: {} });
    expect(staffFinalize.status).toBe(200);
    const internalMessage = await browserApi(staffPage, `/api/v1/tickets/${ticketId}/messages`, {
      method: 'POST', body: { body: 'Synthetic staff internal note with private evidence.', attachmentIds: [staffUpload.id], visibility: 'internal' },
    });
    expect(internalMessage.status).toBe(201);

    const customerInternalDownload = await browserApi(page, `/api/v1/attachments/${staffUpload.id}/download`);
    expect(customerInternalDownload.status).toBe(404);
    expect(customerInternalDownload.body.error?.code).toBe('NOT_FOUND');
    expect(await fetchAttachment(staffPage, staffUpload.id)).toEqual({ status: 200, contentType: 'image/png', bytes: 8 });

    await page.goto(`/tai-khoan/ho-tro/${ticketId}`);
    await expect(page.getByRole('link', { name: 'Mở ảnh đính kèm', exact: true })).toHaveCount(2);
    await expect(page.getByText('Synthetic staff internal note with private evidence.')).toHaveCount(0);

    const persisted = await readAttachmentAudit(ticketId);
    expect(persisted).toHaveLength(3);
    expect(persisted.every((attachment) => attachment.state === 'linked')).toBe(true);
    expect(persisted.every((attachment) => attachment.storageKey.startsWith('support/'))).toBe(true);
  } finally {
    await Promise.all([staffContext.close(), otherCustomerContext.close()]);
  }
});

test('P07 guest order owner can attach private evidence and continue the protected ticket thread', async ({ page, browser }) => {
  const subject = 'P07 synthetic guest order support with private evidence';
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  await seedSyntheticUsers();
  await page.goto('/tra-cuu-don-hang');
  await page.getByLabel('Mã đơn hàng', { exact: true }).fill(GUEST_ORDER_CODE);
  await page.getByLabel('Email đặt hàng', { exact: true }).fill(GUEST_ORDER_EMAIL);
  const challengeResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/order-access/challenges')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Gửi mã xác minh', exact: true }).click();
  const challengeResponse = await challengeResponsePromise;
  expect(challengeResponse.status()).toBe(202);
  expect((await challengeResponse.json()).data.accepted).toBe(true);
  const accessCode = await readGuestOrderAccessCode();
  expect(accessCode).toMatch(/^\d{6}$/u);
  await page.getByLabel('Mã xác minh gồm 6 chữ số', { exact: true }).fill(accessCode);
  await page.getByRole('button', { name: 'Xác minh và xem đơn', exact: true }).click();

  const orderId = process.env.P11_E2E_FIXTURE_GUEST_ORDER_ID;
  await expect(page).toHaveURL(new RegExp(`/don-hang/${orderId}$`, 'u'));
  await page.getByRole('link', { name: 'Gửi yêu cầu hỗ trợ đơn hàng', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/ho-tro-don-hang/${orderId}$`, 'u'));
  await page.getByRole('combobox', { name: 'Loại yêu cầu', exact: true }).selectOption('complaint');
  await page.getByRole('textbox', { name: 'Tiêu đề', exact: true }).fill(subject);
  await page.getByRole('textbox', { name: 'Nội dung', exact: true }).fill('Synthetic guest message tied to the verified order.');
  const picker = page.locator('.support-attachment-picker');
  await picker.getByLabel('Chọn ảnh đính kèm', { exact: true }).setInputFiles({
    name: 'p07-guest-order.png', mimeType: 'image/png', buffer: pngSignature,
  });
  await picker.getByRole('button', { name: 'Tải 1 ảnh lên', exact: true }).click();
  await expect(picker.getByRole('status')).toContainText('Đã tải 1 ảnh');

  const ticketResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/tickets')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click();
  const ticketResponse = await ticketResponsePromise;
  expect(ticketResponse.status()).toBe(201);
  const ticket = (await ticketResponse.json()).data.ticket;
  expect(ticket.orderId).toBe(orderId);
  await page.getByRole('link', { name: /Mở cuộc trao đổi/u }).click();
  await expect(page).toHaveURL(new RegExp(`/ho-tro/${ticket.id}$`, 'u'));
  await expect(page.getByRole('heading', { name: subject, exact: true })).toBeVisible();
  await expect(page.getByText('Synthetic guest message tied to the verified order.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mở ảnh đính kèm', exact: true })).toHaveCount(1);
  expect(await fetchAttachment(page, (await readAttachmentAudit(ticket.id))[0]._id.toString())).toEqual({
    status: 200, contentType: 'image/png', bytes: pngSignature.length,
  });

  const strangerContext = await browser.newContext();
  const staffContext = await browser.newContext();
  try {
    const strangerPage = await strangerContext.newPage();
    await strangerPage.goto('/');
    const anonymousRead = await browserApi(strangerPage, `/api/v1/tickets/${ticket.id}`);
    expect(anonymousRead.status).toBe(401);

    const staffPage = await staffContext.newPage();
    await login(staffPage, P07_USERS.staff);
    const publicReply = await browserApi(staffPage, `/api/v1/tickets/${ticket.id}/messages`, {
      method: 'POST', body: { body: 'Synthetic staff reply visible to the guest.', attachmentIds: [], visibility: 'customer' },
    });
    expect(publicReply.status).toBe(201);
    const internalNote = await browserApi(staffPage, `/api/v1/tickets/${ticket.id}/messages`, {
      method: 'POST', body: { body: 'Synthetic staff-only note must remain hidden.', attachmentIds: [], visibility: 'internal' },
    });
    expect(internalNote.status).toBe(201);

    await page.reload();
    await expect(page.getByText('Synthetic staff reply visible to the guest.')).toBeVisible();
    await expect(page.getByText('Synthetic staff-only note must remain hidden.')).toHaveCount(0);
    await page.getByLabel('Phản hồi', { exact: true }).fill('Synthetic guest follow-up through the protected thread.');
    await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click();
    await expect(page.getByText('Synthetic guest follow-up through the protected thread.')).toBeVisible();
  } finally {
    await Promise.all([strangerContext.close(), staffContext.close()]);
  }

  const persisted = await withP07Database(async (connection) => {
    const TicketRead = connection.model('P07GuestTicketAudit', Ticket.schema);
    const MessageRead = connection.model('P07GuestTicketMessageAudit', TicketMessage.schema);
    const AttachmentRead = connection.model('P07GuestAttachmentAudit', SupportAttachment.schema);
    const [storedTicket, messages, attachments] = await Promise.all([
      TicketRead.findById(ticket.id).lean().exec(),
      MessageRead.find({ ticketId: ticket.id }).sort({ createdAt: 1 }).lean().exec(),
      AttachmentRead.find({ ticketId: ticket.id }).lean().exec(),
    ]);
    return { storedTicket, messages, attachments };
  });
  expect(persisted.storedTicket.userId).toBeNull();
  expect(String(persisted.storedTicket.orderId)).toBe(orderId);
  expect(persisted.messages[0].authorRole).toBe('guest');
  expect(persisted.messages[0].attachmentIds).toHaveLength(1);
  expect(persisted.attachments).toHaveLength(1);
  expect(persisted.attachments[0].state).toBe('linked');
  expect(String(persisted.attachments[0].guestOrderId)).toBe(orderId);
});
