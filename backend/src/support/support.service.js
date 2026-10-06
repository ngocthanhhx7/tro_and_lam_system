import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SupportRepository } from './support.repository.js';
import {
  validateAssistantHandoff,
  validateAttachmentUploadCreate,
  validateContactCreate,
  validateListQuery,
  validateObjectId,
  validateReasonVersion,
  validateReturnDecision,
  validateReturnInspection,
  validateReturnRequestCreate,
  validateStaffContactWrite,
  validateStaffTicketWrite,
  validateTicketCreate,
  validateTicketMessageCreate,
  validateCursorQuery,
} from './support.validators.js';
import { conflict, notFound, ServiceError, unavailable } from '../utils/serviceError.js';

const DEFAULT_RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const TICKET_TRANSITIONS = Object.freeze({
  open: new Set(['assigned', 'in_progress']),
  assigned: new Set(['in_progress']),
  in_progress: new Set(['waiting_customer', 'resolved']),
  waiting_customer: new Set(['in_progress', 'resolved']),
  resolved: new Set(['in_progress', 'closed']),
  closed: new Set(),
});
const CONTACT_TRANSITIONS = Object.freeze({
  new: new Set(['assigned', 'contacted', 'closed']),
  assigned: new Set(['contacted', 'closed']),
  contacted: new Set(['closed']),
  closed: new Set(),
});

const idOf = (value) => String(value?._id ?? value?.id ?? value ?? '');
const plain = (value) => value && typeof value.toObject === 'function' ? value.toObject({ depopulate: true }) : value;
const errorMissing = (code, message) => unavailable(code, message);

function iso(value) {
  return value ? new Date(value).toISOString() : undefined;
}

function assertFunction(value, code, message) {
  if (typeof value !== 'function') throw errorMissing(code, message);
  return value;
}

function pageResult(page) {
  return { page: page.page, limit: page.limit, total: page.total, totalPages: Math.ceil(page.total / page.limit) };
}

function ticketDto(value, { staff = false } = {}) {
  const row = plain(value);
  if (!row) return null;
  return {
    id: idOf(row), code: row.code, kind: row.kind, subject: row.subject, status: row.status,
    priority: row.priority,
    ...(row.orderId ? { orderId: idOf(row.orderId) } : {}),
    ...(staff && row.assignedTo ? { assignedTo: idOf(row.assignedTo) } : {}),
    ...(staff && row.returnRequestId ? { returnRequestId: idOf(row.returnRequestId) } : {}),
    ...(row.latestMessageAt ? { latestMessageAt: iso(row.latestMessageAt) } : {}),
    version: row.version, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
  };
}

function ticketMessageDto(value) {
  const row = plain(value);
  return {
    id: idOf(row), authorRole: row.authorRole, visibility: row.visibility,
    body: row.body, attachmentIds: (row.attachmentIds || []).map(idOf), createdAt: iso(row.createdAt),
  };
}

function contactDto(value) {
  const row = plain(value);
  return {
    id: idOf(row), name: row.name, email: row.email,
    ...(row.phone ? { phone: row.phone } : {}), kind: row.kind,
    ...(row.productId ? { productId: idOf(row.productId) } : {}),
    ...(row.quantity ? { quantity: row.quantity } : {}), ...(row.company ? { company: row.company } : {}),
    message: row.message, status: row.status,
    ...(row.assignedTo ? { assignedTo: idOf(row.assignedTo) } : {}),
    ...(row.note ? { note: row.note } : {}), version: row.version,
    createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
  };
}

function returnDto(value, { staff = false } = {}) {
  const row = plain(value);
  return {
    id: idOf(row), orderId: idOf(row.orderId), ticketId: idOf(row.ticketId),
    items: (row.items || []).map((item) => ({
      productId: idOf(item.productId), quantity: item.quantity, reason: item.reason,
      ...(item.receivedQuantity === undefined ? {} : { receivedQuantity: item.receivedQuantity }),
      ...(item.resellableQuantity === undefined ? {} : { resellableQuantity: item.resellableQuantity }),
    })),
    message: row.message, status: row.status,
    ...(row.decisionReason ? { decisionReason: row.decisionReason } : {}),
    ...(staff && row.inspectionEvidence ? { evidenceReference: row.inspectionEvidence } : {}),
    version: row.version, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
  };
}

function attachmentDto(value) {
  const row = plain(value);
  return {
    id: idOf(row), purpose: row.purpose, mimeType: row.mimeType, bytes: row.bytes,
    state: row.state, visibility: row.visibility, expiresAt: iso(row.expiresAt), version: row.version,
  };
}

function actorRole(actor) {
  if (actor?.role === 'guest' || actor?.kind === 'guest' || (!actor?.id && actor?.orderId)) return 'guest';
  if (['customer', 'staff', 'admin'].includes(actor?.role)) return actor.role;
  throw new ServiceError(401, 'AUTH_REQUIRED', 'Cần đăng nhập hoặc xác minh quyền đơn hàng');
}

function actorOrderId(actor) {
  return actor?.orderId ? idOf(actor.orderId) : null;
}

function checkTicketAccess(actor, ticket) {
  const role = actorRole(actor);
  if (role === 'staff' || role === 'admin') return;
  if (role === 'customer' && idOf(ticket.userId) === idOf(actor.id)) return;
  if (role === 'guest' && ticket.orderId && actorOrderId(actor) === idOf(ticket.orderId)) return;
  throw notFound();
}

function isDuplicate(error) { return error?.code === 11000 || error?.code === '11000'; }

function hashValue(value) {
  return createHash('sha256').update(value).digest('hex');
}

function imageMime(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function safeHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

function orderItems(order) {
  return (order?.items ?? order?.itemsSnapshot ?? []).map((item) => ({
    productId: idOf(item.productId), quantity: item.quantity,
  }));
}

function deliveredAt(order) {
  if (order?.deliveredAt) return new Date(order.deliveredAt);
  const event = [...(order?.statusHistory || [])].reverse().find((entry) => entry.toStatus === 'delivered');
  return event?.createdAt ? new Date(event.createdAt) : null;
}

export function createSupportService({ ports = {}, repository, config = {} } = {}) {
  const repo = repository || ports.repository || new SupportRepository(ports.models, ports.connection);
  const commerce = ports.commerce || ports.order || ports.commerceService || {};
  const operations = ports.operations || ports.outbox || {};
  const audit = ports.audit || operations;
  const storage = ports.storage || null;
  const clock = typeof ports.clock?.now === 'function' ? ports.clock : { now: () => Date.now() };
  const now = () => new Date(clock.now());
  const returnWindowMs = Number.isSafeInteger(config.returnWindowMs) && config.returnWindowMs > 0
    ? config.returnWindowMs : DEFAULT_RETURN_WINDOW_MS;
  const reopenWindowMs = Number.isSafeInteger(config.ticketReopenWindowMs) && config.ticketReopenWindowMs >= 0
    ? config.ticketReopenWindowMs : 7 * 24 * 60 * 60 * 1000;
  const supportInbox = config.supportInbox || '';

  async function transaction(callback) {
    if (typeof repo.transaction !== 'function') throw errorMissing('DATABASE_UNAVAILABLE', 'Transaction của yêu cầu hỗ trợ chưa sẵn sàng');
    return repo.transaction(callback);
  }

  async function appendAudit(actor, requestId, action, targetType, targetId, changesRedacted, session) {
    const append = audit.appendAudit || audit.append;
    if (typeof append !== 'function') throw errorMissing('DATABASE_UNAVAILABLE', 'Ghi nhật ký thao tác chưa sẵn sàng');
    return append.call(audit, {
      actorId: actor?.id || null, actorRole: actor?.role || 'system',
      requestId: requestId || `support:${randomUUID()}`, action, targetType,
      targetId: targetId ? idOf(targetId) : null, outcome: 'success', changesRedacted,
    }, { session });
  }

  async function appendNotification({ eventKey, aggregateType, aggregateId, aggregateVersion, recipients, title, body, href }, { session } = {}) {
    if (!recipients?.length) return null;
    const append = assertFunction(operations.appendOutbox, 'DATABASE_UNAVAILABLE', 'Hàng đợi thông báo chưa sẵn sàng');
    return append.call(operations, {
      eventKey, type: 'operations.delivery', aggregateType, aggregateId: idOf(aggregateId), aggregateVersion,
      payload: { deliveries: [{ notification: {
        recipients: [...new Set(recipients.map(idOf))], category: 'support', title, body, href,
      } }] },
    }, { session });
  }

  async function activeStaffIds(session) {
    if (typeof repo.listActiveStaffIds !== 'function') return [];
    return repo.listActiveStaffIds({ session });
  }

  async function assertOrderActor(actor, id) {
    const getOwnedOrder = assertFunction(commerce.getOwnedOrder, 'DATABASE_UNAVAILABLE', 'Xác minh quyền sở hữu đơn hàng chưa sẵn sàng');
    try { return await getOwnedOrder.call(commerce, actor, id); } catch (error) {
      if (error?.status === 404 || error?.code === 'NOT_FOUND') throw notFound();
      throw error;
    }
  }

  async function assertAttachments(actor, ids, { purpose, orderId, visibility, session, target } = {}) {
    if (!ids?.length) return [];
    const records = await repo.findAttachmentsByIds(ids, { session });
    if (records.length !== ids.length) throw notFound();
    const role = actorRole(actor);
    for (const record of records) {
      const ownerMatches = role === 'guest'
        ? idOf(record.guestOrderId) === actorOrderId(actor)
        : idOf(record.uploadedByUserId) === idOf(actor.id);
      if (!ownerMatches || record.purpose !== purpose || record.state !== 'ready'
        || record.visibility !== visibility
        || (orderId && idOf(record.orderId) !== idOf(orderId))
        || (target?.ticketId && record.ticketId && idOf(record.ticketId) !== idOf(target.ticketId))
        || (target?.reviewId && record.reviewId && idOf(record.reviewId) !== idOf(target.reviewId))) throw notFound();
    }
    return records;
  }

  async function linkTicketAttachments(actor, attachmentIds, ticketId, visibility, session) {
    if (!attachmentIds.length) return;
    const records = await assertAttachments(actor, attachmentIds, { purpose: 'ticket', visibility, session, target: { ticketId } });
    if (records.some((record) => record.ticketId)) throw conflict('VERSION_CONFLICT', 'Tệp đã được gắn vào yêu cầu khác');
    const ownerFilter = actorRole(actor) === 'guest'
      ? { guestOrderId: actorOrderId(actor) }
      : { uploadedByUserId: actor.id };
    const result = await repo.linkAttachments(attachmentIds, ownerFilter, { ticketId }, { session });
    if (result.modifiedCount !== attachmentIds.length) throw conflict('VERSION_CONFLICT', 'Tệp đã được sử dụng hoặc thay đổi');
  }

  async function newTicket(actor, input, { orderId, returnRequestId, session, requestId, staffMessage = false } = {}) {
    const role = actorRole(actor);
    const createdAt = now();
    const code = `TL-${randomBytes(6).toString('hex').toUpperCase()}`;
    const ticket = await repo.createTicket({
      code,
      userId: role === 'guest' ? null : actor.id,
      orderId: orderId || null,
      kind: input.kind, subject: input.subject,
      status: 'open', priority: 'normal',
      ...(returnRequestId ? { returnRequestId } : {}), latestMessageAt: createdAt, version: 0,
    }, { session });
    const message = await repo.createTicketMessage({
      ticketId: ticket._id ?? ticket.id, authorId: role === 'guest' ? null : actor.id,
      authorRole: role, visibility: 'customer', body: input.body,
      attachmentIds: input.attachmentIds || [],
    }, { session });
    await linkTicketAttachments(actor, input.attachmentIds || [], ticket._id ?? ticket.id, 'customer', session);
    const recipients = await activeStaffIds(session);
    await appendNotification({
      eventKey: `support.ticket.created:${idOf(ticket)}`, aggregateType: 'ticket', aggregateId: ticket._id ?? ticket.id,
      aggregateVersion: ticket.version, recipients, title: 'Yêu cầu hỗ trợ mới', body: 'Có yêu cầu mới trong hàng đợi hỗ trợ.', href: `/staff/support/${idOf(ticket)}`,
    }, { session });
    return { ticket: ticketDto(ticket, { staff: false }), initialMessage: ticketMessageDto(message), requestId, staffMessage };
  }

  async function customerEmail(ticket, session) {
    if (ticket.userId && typeof repo.findUserEmail === 'function') return repo.findUserEmail(ticket.userId, { session });
    if (ticket.orderId && typeof commerce.getOperationalOrder === 'function') {
      const order = await commerce.getOperationalOrder(idOf(ticket.orderId), { session });
      return order?.recipient?.email || order?.recipientSnapshot?.email || null;
    }
    return null;
  }

  async function queueTicketMail(ticket, session) {
    const recipient = await customerEmail(ticket, session);
    if (!recipient) return null;
    const enqueue = assertFunction(operations.enqueueMail, 'MAIL_UNAVAILABLE', 'Email cập nhật yêu cầu chưa sẵn sàng');
    return enqueue.call(operations, 'ticket_reply', recipient, { ticketCode: ticket.code }, { session });
  }

  async function transitionOrderForReturn(actor, orderId, toStatus, reason, session) {
    const getOrder = assertFunction(commerce.getOperationalOrder, 'DATABASE_UNAVAILABLE', 'Đọc trạng thái đơn đổi trả chưa sẵn sàng');
    const transition = assertFunction(commerce.transitionReturnOrder, 'DATABASE_UNAVAILABLE', 'Chuyển trạng thái đơn đổi trả chưa sẵn sàng');
    const order = await getOrder.call(commerce, idOf(orderId), { session });
    return transition.call(commerce, actor, idOf(orderId), toStatus, reason, order.version, { session });
  }

  return Object.freeze({
    async createContact(actor, input, _context = {}) {
      const data = validateContactCreate(input);
      if (!supportInbox) throw errorMissing('MAIL_UNAVAILABLE', 'Hộp thư tiếp nhận yêu cầu chưa được cấu hình');
      const enqueue = assertFunction(operations.enqueueMail, 'MAIL_UNAVAILABLE', 'Hàng đợi email chưa sẵn sàng');
      return transaction(async (session) => {
        const contact = await repo.createContact({
          ...(actor?.id ? { userId: actor.id } : {}), name: data.name, email: data.email,
          ...(data.phone ? { phone: data.phone } : {}), kind: data.kind,
          ...(data.productId ? { productId: data.productId } : {}), ...(data.quantity ? { quantity: data.quantity } : {}),
          ...(data.company ? { company: data.company } : {}), message: data.message,
          consentAt: now(), status: 'new', version: 0,
        }, { session });
        const contactId = idOf(contact);
        const recipients = await activeStaffIds(session);
        await appendNotification({
          eventKey: `support.contact.created:${contactId}`, aggregateType: 'contact', aggregateId: contact._id ?? contact.id,
            aggregateVersion: contact.version, recipients, title: 'Yêu cầu tư vấn mới', body: 'Có yêu cầu liên hệ mới trong hàng đợi.', href: '/staff/contacts',
        }, { session });
        await enqueue.call(operations, 'new_lead', supportInbox, { reference: contactId }, { session, eventKey: `contact.new_lead:${contactId}` });
        return { id: contactId, deliveryStatus: 'queued' };
      });
    },

    async createTicket(actor, input, context = {}) {
      const data = validateTicketCreate(input);
      const role = actorRole(actor);
      if (role === 'guest') {
        if (!data.orderId || idOf(data.orderId) !== actorOrderId(actor)) throw notFound();
      } else if (data.orderId) {
        await assertOrderActor(actor, data.orderId);
      }
      return transaction(async (session) => {
        try {
          return await newTicket(actor, data, { orderId: data.orderId, session, requestId: context.requestId });
        } catch (error) {
          if (isDuplicate(error)) throw conflict('VERSION_CONFLICT', 'Không thể tạo yêu cầu trùng lặp');
          throw error;
        }
      });
    },

    async listOwnTickets(actor, filters = {}) {
      if (!actor?.id) throw new ServiceError(401, 'AUTH_REQUIRED', 'Cần đăng nhập để xem yêu cầu của bạn');
      const query = validateListQuery(filters, { statusValues: ['open', 'assigned', 'in_progress', 'waiting_customer', 'resolved', 'closed'] });
      const result = await repo.listOwnTickets(actor.id, query);
      return { items: result.items.map((item) => ticketDto(item)), pagination: pageResult({ ...query, total: result.total }) };
    },

    async listStaffTickets(filters = {}) {
      const query = validateListQuery(filters, {
        statusValues: ['open', 'assigned', 'in_progress', 'waiting_customer', 'resolved', 'closed'],
        kindValues: ['support', 'complaint', 'return'],
      });
      const result = await repo.listStaffTickets(query);
      return { items: result.items.map((item) => ticketDto(item, { staff: true })), pagination: pageResult({ ...query, total: result.total }) };
    },

    async getTicket(actor, id) {
      validateObjectId(id);
      const ticket = await repo.findTicketById(id);
      if (!ticket) throw notFound();
      checkTicketAccess(actor, ticket);
      return ticketDto(ticket, { staff: ['staff', 'admin'].includes(actor.role) });
    },

    async listTicketMessages(actor, id, filters = {}) {
      validateObjectId(id);
      const ticket = await repo.findTicketById(id);
      if (!ticket) throw notFound();
      checkTicketAccess(actor, ticket);
      const query = validateCursorQuery(filters);
      const staff = ['staff', 'admin'].includes(actor.role);
      const result = await repo.listTicketMessages(id, { ...query, includeInternal: staff });
      return { items: result.items.map(ticketMessageDto), nextCursor: result.nextCursor };
    },

    async createTicketMessage(actor, id, input, context = {}) {
      validateObjectId(id);
      const data = validateTicketMessageCreate(input);
      const role = actorRole(actor);
      if ((role === 'customer' || role === 'guest') && data.visibility !== 'customer') {
        throw new ServiceError(403, 'FORBIDDEN', 'Khách hàng không thể gửi ghi chú nội bộ');
      }
      return transaction(async (session) => {
        const ticket = await repo.findTicketById(id, { session });
        if (!ticket) throw notFound();
        checkTicketAccess(actor, ticket);
        if (ticket.status === 'closed') throw conflict('INVALID_TRANSITION', 'Yêu cầu đã đóng; hãy tạo yêu cầu mới');
        if (ticket.status === 'resolved' && role !== 'staff' && role !== 'admin'
          && (!ticket.latestMessageAt || now().getTime() - new Date(ticket.latestMessageAt).getTime() > reopenWindowMs)) {
          throw conflict('INVALID_TRANSITION', 'Thời hạn phản hồi yêu cầu đã kết thúc; hãy tạo yêu cầu mới');
        }
        await assertAttachments(actor, data.attachmentIds, {
          purpose: 'ticket', visibility: data.visibility, session, target: { ticketId: id },
        });
        const message = await repo.createTicketMessage({
          ticketId: id, authorId: role === 'guest' ? null : actor.id, authorRole: role,
          visibility: data.visibility, body: data.body, attachmentIds: data.attachmentIds,
        }, { session });
        await appendAudit(actor, context.requestId, 'support.ticket.message.created', 'ticket', id, {
          visibility: data.visibility, attachmentCount: data.attachmentIds.length,
        }, session);
        if (data.attachmentIds.length) {
          const ownerFilter = role === 'guest' ? { guestOrderId: actorOrderId(actor) } : { uploadedByUserId: actor.id };
          const linked = await repo.linkAttachments(data.attachmentIds, ownerFilter, { ticketId: id }, { session });
          if (linked.modifiedCount !== data.attachmentIds.length) throw conflict('VERSION_CONFLICT', 'Tệp đã được sử dụng hoặc thay đổi');
        }
        const nextStatus = role === 'staff' || role === 'admin'
          ? (data.visibility === 'customer' ? 'waiting_customer' : ticket.status)
          : 'in_progress';
        const changed = await repo.updateTicket(id, ticket.version, {
          latestMessageAt: now(), ...(ticket.status === 'resolved' ? { status: 'in_progress' } : {}),
          ...(nextStatus !== ticket.status && ticket.status !== 'resolved' ? { status: nextStatus } : {}),
        }, { session });
        if (!changed) throw conflict('VERSION_CONFLICT', 'Yêu cầu đã được cập nhật ở nơi khác');
        if ((role === 'staff' || role === 'admin') && data.visibility === 'customer') {
          await queueTicketMail(ticket, session);
          const owner = ticket.userId ? [idOf(ticket.userId)] : [];
          await appendNotification({
            eventKey: `support.ticket.message:${idOf(message)}`, aggregateType: 'ticket', aggregateId: id,
            aggregateVersion: changed.version, recipients: owner,
            title: 'Yêu cầu hỗ trợ có cập nhật', body: 'Nhân viên đã phản hồi yêu cầu của bạn.', href: `/tai-khoan/ho-tro/${id}`,
          }, { session });
        } else {
          const recipients = ticket.assignedTo ? [idOf(ticket.assignedTo)] : await activeStaffIds(session);
          await appendNotification({
            eventKey: `support.ticket.message:${idOf(message)}`, aggregateType: 'ticket', aggregateId: id,
            aggregateVersion: changed.version, recipients,
            title: 'Khách hàng đã phản hồi', body: 'Có phản hồi mới trong yêu cầu hỗ trợ.', href: `/staff/support/${id}`,
          }, { session });
        }
        return ticketMessageDto(message);
      });
    },

    async updateStaffTicket(actor, id, input, context = {}) {
      const patch = validateStaffTicketWrite(input);
      return transaction(async (session) => {
        const ticket = await repo.findTicketById(validateObjectId(id), { session });
        if (!ticket) throw notFound();
        if (ticket.status === 'closed') throw conflict('INVALID_TRANSITION', 'Yêu cầu đã đóng; trạng thái này không thể thay đổi');
        if (ticket.version !== patch.expectedVersion) throw conflict('VERSION_CONFLICT');
        if (patch.status && patch.status !== ticket.status && !TICKET_TRANSITIONS[ticket.status].has(patch.status)) {
          throw new ServiceError(409, 'INVALID_TRANSITION', 'Trạng thái yêu cầu không thể chuyển theo luồng hiện tại');
        }
        const nextAssigned = patch.assignedTo !== undefined ? patch.assignedTo : ticket.assignedTo;
        if (patch.assignedTo !== undefined && nextAssigned) {
          if (actor.role !== 'admin' && idOf(nextAssigned) !== idOf(actor.id)) throw new ServiceError(403, 'FORBIDDEN', 'Nhân viên chỉ có thể nhận yêu cầu về mình');
          if (!await repo.hasActiveStaffUser(nextAssigned, { session })) throw new ServiceError(422, 'VALIDATION_ERROR', 'Chỉ có thể phân công cho nhân viên đang hoạt động');
        }
        if ((patch.status === 'assigned' || (!patch.status && nextAssigned)) && !nextAssigned) {
          throw new ServiceError(422, 'VALIDATION_ERROR', 'Cần chọn nhân viên nhận yêu cầu');
        }
        const changes = { ...patch };
        delete changes.expectedVersion;
        if (changes.assignedTo === null) changes.assignedTo = null;
        const updated = await repo.updateTicket(id, patch.expectedVersion, changes, { session });
        if (!updated) throw conflict('VERSION_CONFLICT');
        await appendAudit(actor, context.requestId, 'support.ticket.updated', 'ticket', id, {
          status: updated.status, assigned: Boolean(updated.assignedTo), priority: updated.priority,
        }, session);
        return ticketDto(updated, { staff: true });
      });
    },

    async listOwnReturnRequests(actor, id) {
      const orderId = validateObjectId(id);
      await assertOrderActor(actor, orderId);
      const rows = await repo.listReturnsForOwner(orderId, actor.id || null);
      return rows.map((row) => returnDto(row));
    },

    async createReturnRequest(actor, id, input, context = {}) {
      const orderId = validateObjectId(id, 'orderId');
      const data = validateReturnRequestCreate(input);
      const idempotencyKey = context.idempotencyKey;
      if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 22 || idempotencyKey.length > 200 || /[\r\n]/.test(idempotencyKey)) {
        throw new ServiceError(400, 'VALIDATION_ERROR', 'Thiếu hoặc sai khóa Idempotency-Key');
      }
      const idempotencyKeyHash = hashValue(idempotencyKey.trim());
      const requestHash = hashValue(JSON.stringify(data));
      const role = actorRole(actor);
      if (role === 'guest' && actorOrderId(actor) !== orderId) throw notFound();
      if (role === 'customer') await assertOrderActor(actor, orderId);
      const orderPort = assertFunction(commerce.getOwnedOrder, 'DATABASE_UNAVAILABLE', 'Xác minh đơn đổi trả chưa sẵn sàng');
      const ownedOrder = await orderPort.call(commerce, actor, orderId);
      const existing = await repo.findReturnByIdempotency(orderId, idempotencyKeyHash);
      if (existing) {
        if (existing.requestHash !== requestHash) throw conflict('IDEMPOTENCY_CONFLICT', 'Khóa đã được sử dụng với yêu cầu khác');
        return returnDto(existing);
      }
      if (!ownedOrder) throw notFound();
      if (ownedOrder.version !== data.expectedVersion) throw conflict('VERSION_CONFLICT');
      if (ownedOrder.status !== 'delivered') throw new ServiceError(422, 'INVALID_TRANSITION', 'Chỉ có thể yêu cầu đổi trả cho đơn đã giao');
      const whenDelivered = deliveredAt(ownedOrder);
      if (!whenDelivered || Number.isNaN(whenDelivered.getTime()) || now().getTime() - whenDelivered.getTime() > returnWindowMs) {
        throw new ServiceError(422, 'INVALID_TRANSITION', 'Thời hạn yêu cầu đổi trả đã kết thúc hoặc chưa xác định được ngày giao');
      }
      const purchased = orderItems(ownedOrder);
      if (purchased.length !== data.items.length || purchased.some((item) => {
        const requested = data.items.find((candidate) => candidate.productId === item.productId);
        return !requested || requested.quantity !== item.quantity;
      })) throw new ServiceError(422, 'PARTIAL_OPERATION_DISABLED', 'Hiện chỉ tiếp nhận yêu cầu đổi trả toàn bộ sản phẩm trong đơn');
      try {
        return await transaction(async (session) => {
          const replay = await repo.findReturnByIdempotency(orderId, idempotencyKeyHash, { session });
          if (replay) {
            if (replay.requestHash !== requestHash) throw conflict('IDEMPOTENCY_CONFLICT', 'Khóa đã được sử dụng với yêu cầu khác');
            return returnDto(replay);
          }
          if (await repo.findActiveReturnByOrder(orderId, { session })) throw conflict('INVALID_TRANSITION', 'Đơn đã có yêu cầu đổi trả đang xử lý');
          const reason = data.items.map((item) => item.reason).join('; ').slice(0, 1000);
          const requestReturn = assertFunction(commerce.requestReturn, 'DATABASE_UNAVAILABLE', 'Luồng đơn đổi trả chưa sẵn sàng');
          await requestReturn.call(commerce, actor, orderId, reason, { session });
          const createdAt = now();
          const ticket = await repo.createTicket({
            code: `TL-${randomBytes(6).toString('hex').toUpperCase()}`,
            userId: role === 'guest' ? null : actor.id, orderId,
            kind: 'return', subject: 'Yêu cầu đổi trả đơn hàng', status: 'open', priority: 'normal',
            latestMessageAt: createdAt, version: 0,
          }, { session });
          const request = await repo.createReturnRequest({
            orderId, ticketId: ticket._id ?? ticket.id,
            userId: role === 'guest' ? null : actor.id, items: data.items, message: data.message,
            status: 'requested', active: true, previousFulfillmentStatus: 'delivered',
            idempotencyKeyHash, requestHash, version: 0,
          }, { session });
          const changedTicket = await repo.updateTicket(idOf(ticket), ticket.version, { returnRequestId: request._id ?? request.id }, { session });
          if (!changedTicket) throw conflict('VERSION_CONFLICT');
          await repo.createTicketMessage({
            ticketId: ticket._id ?? ticket.id, authorId: role === 'guest' ? null : actor.id,
            authorRole: role, visibility: 'customer', body: data.message, attachmentIds: [],
          }, { session });
          const recipients = await activeStaffIds(session);
          await appendNotification({
            eventKey: `support.return.requested:${idOf(request)}`, aggregateType: 'return_request', aggregateId: request._id ?? request.id,
            aggregateVersion: request.version, recipients, title: 'Có yêu cầu đổi trả mới', body: 'Một yêu cầu đổi trả cần được xem xét.', href: '/staff/support',
          }, { session });
          await appendAudit(actor, context.requestId, 'support.return.requested', 'return_request', request._id ?? request.id, { status: 'requested', itemCount: data.items.length }, session);
          return returnDto(request);
        });
      } catch (error) {
        const replay = await repo.findReturnByIdempotency(orderId, idempotencyKeyHash).catch(() => null);
        if (replay) {
          if (replay.requestHash !== requestHash) throw conflict('IDEMPOTENCY_CONFLICT', 'Khóa đã được sử dụng với yêu cầu khác');
          return returnDto(replay);
        }
        if (isDuplicate(error)) throw conflict('INVALID_TRANSITION', 'Đơn đã có yêu cầu đổi trả đang xử lý');
        throw error;
      }
    },

    async listStaffReturnRequests(filters = {}) {
      const query = validateListQuery(filters, { statusValues: ['requested', 'approved', 'rejected', 'received', 'closed'] });
      const result = await repo.listStaffReturns(query);
      return { items: result.items.map((row) => returnDto(row, { staff: true })), pagination: pageResult({ ...query, total: result.total }) };
    },

    async decideReturn(actor, id, input, context = {}) {
      const decision = validateReturnDecision(input);
      return transaction(async (session) => {
        const request = await repo.findReturnById(validateObjectId(id), { session });
        if (!request) throw notFound();
        if (request.status !== 'requested' || request.version !== decision.expectedVersion) throw conflict('VERSION_CONFLICT');
        const nextStatus = decision.decision === 'approved' ? 'approved' : 'rejected';
        const updated = await repo.updateReturn(id, decision.expectedVersion, {
          status: nextStatus, active: nextStatus !== 'rejected', reviewedBy: actor.id, decisionReason: decision.reason,
        }, { session });
        if (!updated) throw conflict('VERSION_CONFLICT');
        if (decision.decision === 'rejected') await transitionOrderForReturn(actor, request.orderId, 'delivered', decision.reason, session);
        const customerBody = decision.decision === 'approved'
          ? 'Yêu cầu đổi trả đã được duyệt. Vui lòng làm theo hướng dẫn của nhân viên.'
          : 'Yêu cầu đổi trả chưa được chấp thuận. Mở yêu cầu hỗ trợ nếu bạn cần trao đổi thêm.';
        const ticket = await repo.findTicketById(request.ticketId, { session });
        if (ticket) {
          const message = await repo.createTicketMessage({
            ticketId: request.ticketId, authorId: actor.id, authorRole: actor.role,
            visibility: 'customer', body: `${customerBody} Lý do: ${decision.reason}`, attachmentIds: [],
          }, { session });
          await repo.updateTicket(request.ticketId, ticket.version, { latestMessageAt: now(), status: 'waiting_customer' }, { session });
          if (ticket.userId) await appendNotification({
            eventKey: `support.return.decision:${idOf(message)}`, aggregateType: 'return_request', aggregateId: id,
            aggregateVersion: updated.version, recipients: [idOf(ticket.userId)], title: 'Cập nhật yêu cầu đổi trả', body: 'Nhân viên đã cập nhật trạng thái yêu cầu đổi trả.', href: `/tai-khoan/ho-tro/${idOf(ticket._id)}`,
          }, { session });
          await queueTicketMail(ticket, session);
        }
        await appendAudit(actor, context.requestId, 'support.return.decision', 'return_request', id, { status: updated.status, reasonCode: 'STAFF_DECISION' }, session);
        return returnDto(updated, { staff: true });
      });
    },

    async inspectReturn(actor, id, input, context = {}) {
      const inspection = validateReturnInspection(input);
      return transaction(async (session) => {
        const request = await repo.findReturnById(validateObjectId(id), { session });
        if (!request) throw notFound();
        if (request.status !== 'approved' || request.version !== inspection.expectedVersion) throw conflict('VERSION_CONFLICT');
        const requestItems = new Map(request.items.map((item) => [idOf(item.productId), item]));
        if (requestItems.size !== inspection.items.length || inspection.items.some((item) => {
          const requested = requestItems.get(item.productId);
          return !requested || item.receivedQuantity > requested.quantity;
        })) throw new ServiceError(422, 'VALIDATION_ERROR', 'Số lượng kiểm nhận không khớp yêu cầu đã duyệt');
        const changed = await repo.updateReturn(id, inspection.expectedVersion, {
          status: 'received', items: request.items.map((item) => {
            const match = inspection.items.find((line) => line.productId === idOf(item.productId));
            return { ...item, receivedQuantity: match.receivedQuantity, resellableQuantity: match.resellableQuantity };
          }), inspectionEvidence: inspection.evidenceReference, reviewedBy: actor.id,
        }, { session });
        if (!changed) throw conflict('VERSION_CONFLICT');
        const completeReturn = assertFunction(commerce.completeReturn, 'DATABASE_UNAVAILABLE', 'Xử lý tồn kho hàng trả chưa sẵn sàng');
        const getOperationalOrder = assertFunction(commerce.getOperationalOrder, 'DATABASE_UNAVAILABLE', 'Đọc phiên bản đơn hàng chưa sẵn sàng');
        const order = await getOperationalOrder.call(commerce, idOf(request.orderId), { session });
        await completeReturn.call(commerce, actor, {
          orderId: idOf(request.orderId), returnId: id,
          items: inspection.items, reason: inspection.evidenceReference,
          expectedOrderVersion: order.version,
        }, { session });
        await appendAudit(actor, context.requestId, 'support.return.inspected', 'return_request', id, {
          status: 'received', itemCount: inspection.items.length,
          resellableQuantity: inspection.items.reduce((sum, item) => sum + item.resellableQuantity, 0),
        }, session);
        return returnDto(changed, { staff: true });
      });
    },

    async closeReturn(actor, id, input, context = {}) {
      const payload = validateReasonVersion(input);
      return transaction(async (session) => {
        const request = await repo.findReturnById(validateObjectId(id), { session });
        if (!request) throw notFound();
        if (request.status !== 'received' || request.version !== payload.expectedVersion) throw conflict('INVALID_TRANSITION');
        const updated = await repo.updateReturn(id, payload.expectedVersion, {
          status: 'closed', active: false, decisionReason: payload.reason,
        }, { session });
        if (!updated) throw conflict('VERSION_CONFLICT');
        await appendAudit(actor, context.requestId, 'support.return.closed', 'return_request', id, { status: 'closed' }, session);
        return returnDto(updated, { staff: true });
      });
    },

    async listStaffContacts(filters = {}) {
      const query = validateListQuery(filters, { statusValues: ['new', 'assigned', 'contacted', 'closed'], kindValues: ['general', 'corporate', 'quote'] });
      const result = await repo.listContacts(query);
      return { items: result.items.map(contactDto), pagination: pageResult({ ...query, total: result.total }) };
    },

    async updateStaffContact(actor, id, input, context = {}) {
      const patch = validateStaffContactWrite(input);
      return transaction(async (session) => {
        const current = await repo.findContactById(validateObjectId(id), { session });
        if (!current) throw notFound();
        if (current.version !== patch.expectedVersion) throw conflict('VERSION_CONFLICT');
        if (patch.status && patch.status !== current.status && !CONTACT_TRANSITIONS[current.status].has(patch.status)) {
          throw new ServiceError(409, 'INVALID_TRANSITION', 'Trạng thái liên hệ không thể chuyển theo luồng hiện tại');
        }
        const changes = { ...patch, ...(patch.note === undefined ? {} : { noteBy: actor.id }) };
        delete changes.expectedVersion;
        const nextAssigned = patch.assignedTo !== undefined ? patch.assignedTo : current.assignedTo;
        if (patch.assignedTo) {
          if (actor.role !== 'admin' && idOf(patch.assignedTo) !== idOf(actor.id)) throw new ServiceError(403, 'FORBIDDEN', 'Nhân viên chỉ có thể nhận yêu cầu về mình');
          if (!await repo.hasActiveStaffUser(patch.assignedTo, { session })) throw new ServiceError(422, 'VALIDATION_ERROR', 'Chỉ có thể phân công cho nhân viên đang hoạt động');
          if (!patch.status && current.status === 'new') changes.status = 'assigned';
        }
        if (patch.status === 'assigned' && !nextAssigned) throw new ServiceError(422, 'VALIDATION_ERROR', 'Cần chọn nhân viên nhận liên hệ');
        const updated = await repo.updateContact(id, patch.expectedVersion, changes, { session });
        if (!updated) throw conflict('VERSION_CONFLICT');
        await appendAudit(actor, context.requestId, 'support.contact.updated', 'contact', id, {
          status: updated.status, assigned: Boolean(updated.assignedTo), noteChanged: patch.note !== undefined,
        }, session);
        return contactDto(updated);
      });
    },

    async createAttachmentUpload(actor, input) {
      const data = validateAttachmentUploadCreate(input);
      const role = actorRole(actor);
      if (data.visibility === 'internal' && !['staff', 'admin'].includes(role)) {
        throw new ServiceError(403, 'FORBIDDEN', 'Chỉ nhân viên được tải tệp nội bộ lên');
      }
      if (data.purpose === 'refund' && !['staff', 'admin'].includes(role)) {
        throw new ServiceError(403, 'FORBIDDEN', 'Chứng từ hoàn tiền chỉ dành cho nhân viên');
      }
      if (data.purpose === 'review' && role !== 'customer') {
        throw new ServiceError(403, 'FORBIDDEN', 'Ảnh đánh giá chỉ dành cho khách hàng đã đăng nhập');
      }
      if (role === 'guest' && (!data.orderId || actorOrderId(actor) !== data.orderId)) throw notFound();
      if (data.orderId && role === 'customer') await assertOrderActor(actor, data.orderId);
      if (data.orderId && ['staff', 'admin'].includes(role) && data.purpose === 'refund') {
        const getOperationalOrder = assertFunction(commerce.getOperationalOrder, 'DATABASE_UNAVAILABLE', 'Xác minh đơn hàng cần chứng từ chưa sẵn sàng');
        try { await getOperationalOrder.call(commerce, data.orderId); } catch (error) {
          if (error?.status === 404 || error?.code === 'NOT_FOUND') throw notFound();
          throw error;
        }
      }
      if (data.ticketId) {
        const ticket = await repo.findTicketById(data.ticketId);
        if (!ticket) throw notFound();
        checkTicketAccess(actor, ticket);
      }
      if (data.reviewId && role !== 'customer') throw new ServiceError(403, 'FORBIDDEN', 'Ảnh đánh giá chỉ dành cho khách hàng đã đăng nhập');
      if (data.purpose === 'review') {
        const order = await assertOrderActor(actor, data.orderId);
        if (order.status !== 'delivered' || !orderItems(order).length) throw new ServiceError(422, 'REVIEW_NOT_ELIGIBLE', 'Chỉ có thể đính kèm ảnh cho đơn đã giao');
      }
      if (!storage || typeof storage.createUpload !== 'function') throw errorMissing('MEDIA_UNAVAILABLE', 'Kho tệp hỗ trợ chưa được cấu hình');
      const expiresAt = new Date(now().getTime() + 10 * 60 * 1000);
      const storageKey = `support/${randomUUID()}`;
      let upload;
      try { upload = await storage.createUpload({ storageKey, mimeType: data.mimeType, bytes: data.bytes, expiresAt }); } catch { throw errorMissing('MEDIA_UNAVAILABLE', 'Không thể tạo đường tải tệp an toàn'); }
      if (!safeHttpsUrl(upload?.uploadUrl) || !upload?.headers || typeof upload.headers !== 'object' || Array.isArray(upload.headers)) {
        throw errorMissing('MEDIA_UNAVAILABLE', 'Kho tệp chưa trả về URL tải riêng hợp lệ');
      }
      const row = await repo.createAttachment({
        storageKey,
        ...(role === 'guest' ? { guestOrderId: actorOrderId(actor) } : { uploadedByUserId: actor.id }),
        purpose: data.purpose, ...(data.orderId ? { orderId: data.orderId } : {}),
        ...(data.ticketId ? { ticketId: data.ticketId } : {}), ...(data.reviewId ? { reviewId: data.reviewId } : {}),
        mimeType: data.mimeType, bytes: data.bytes, state: 'pending_upload', visibility: data.visibility,
        expiresAt, version: 0,
      });
      return {
        ...attachmentDto(row), uploadUrl: upload.uploadUrl,
        headers: upload.headers, method: 'PUT',
      };
    },

    async finalizeAttachment(actor, id) {
      const attachment = await repo.findAttachmentById(validateObjectId(id));
      if (!attachment) throw notFound();
      const role = actorRole(actor);
      const ownerMatches = role === 'guest'
        ? idOf(attachment.guestOrderId) === actorOrderId(actor)
        : idOf(attachment.uploadedByUserId) === idOf(actor.id);
      if (!ownerMatches && role !== 'staff' && role !== 'admin') throw notFound();
      if (attachment.state === 'ready' || attachment.state === 'linked') return attachmentDto(attachment);
      if (attachment.state !== 'pending_upload' || !attachment.expiresAt || new Date(attachment.expiresAt) <= now()) {
        throw new ServiceError(410, 'LINK_EXPIRED', 'Thời hạn tải tệp đã kết thúc');
      }
      if (!storage || typeof storage.readPrivateObject !== 'function') throw errorMissing('MEDIA_UNAVAILABLE', 'Kho tệp hỗ trợ chưa thể xác minh nội dung');
      let buffer;
      try { buffer = await storage.readPrivateObject(attachment.storageKey, { maxBytes: MAX_ATTACHMENT_BYTES }); } catch { throw errorMissing('MEDIA_UNAVAILABLE', 'Không thể đọc tệp riêng tư để kiểm tra'); }
      const mimeType = imageMime(buffer);
      if (!mimeType || mimeType !== attachment.mimeType || buffer.length !== attachment.bytes || buffer.length > MAX_ATTACHMENT_BYTES) {
        await repo.updateAttachment(id, attachment.version, { state: 'rejected' });
        if (typeof storage.deletePrivateObject === 'function') await storage.deletePrivateObject(attachment.storageKey).catch(() => {});
        throw new ServiceError(422, 'VALIDATION_ERROR', 'Nội dung tệp không khớp kiểu hoặc kích thước khai báo');
      }
      const updated = await repo.updateAttachment(id, attachment.version, {
        state: 'ready', hash: createHash('sha256').update(buffer).digest('hex'),
      });
      if (!updated) throw conflict('VERSION_CONFLICT');
      return attachmentDto(updated);
    },

    async downloadAttachment(actor, id) {
      const attachment = await repo.findAttachmentById(validateObjectId(id));
      if (!attachment) throw notFound();
      const role = actorRole(actor);
      const privileged = role === 'staff' || role === 'admin';
      let allowed = privileged;
      if (!privileged && attachment.visibility !== 'internal') {
        if (role === 'guest') allowed = idOf(attachment.guestOrderId) === actorOrderId(actor);
        else if (role === 'customer') allowed = idOf(attachment.uploadedByUserId) === idOf(actor.id);
      }
      if (attachment.ticketId && !allowed && (privileged || attachment.visibility !== 'internal')) {
        const ticket = await repo.findTicketById(idOf(attachment.ticketId));
        if (ticket) {
          try { checkTicketAccess(actor, ticket); allowed = true; } catch { /* Keep the owner check failed. */ }
        }
      }
      if (!allowed) throw notFound();
      if (!['ready', 'linked'].includes(attachment.state)) throw notFound();
      if (!storage || typeof storage.createDownload !== 'function') throw errorMissing('MEDIA_UNAVAILABLE', 'Kho tệp hỗ trợ chưa sẵn sàng');
      const url = await storage.createDownload(attachment.storageKey, { expiresInSeconds: 60 });
      if (!safeHttpsUrl(url)) throw errorMissing('MEDIA_UNAVAILABLE', 'Kho tệp không trả về liên kết riêng hợp lệ');
      return url;
    },

    async createHandoff(actor, input, context = {}) {
      const data = validateAssistantHandoff(input);
      const role = actor ? actorRole(actor) : 'guest';
      const assertConversationOwner = assertFunction(
        ports.assistantTranscript?.assertConversationOwner,
        'AI_UNAVAILABLE', 'Không thể xác minh quyền sở hữu cuộc trò chuyện',
      );
      await assertConversationOwner.call(ports.assistantTranscript, data.conversationId, actor);
      if (data.shareTranscript && typeof ports.assistantTranscript?.getSharedTranscript !== 'function') {
        throw errorMissing('AI_UNAVAILABLE', 'Không thể lấy bản hội thoại đã được bạn cho phép chia sẻ');
      }
      const transcript = data.shareTranscript
        ? await ports.assistantTranscript.getSharedTranscript(data.conversationId, actor)
        : null;
      if (data.orderId) {
        if (role === 'guest' && actorOrderId(actor) !== data.orderId) throw notFound();
        if (role !== 'guest') await assertOrderActor(actor, data.orderId);
        const result = await this.createTicket(actor, {
          kind: 'support', subject: 'Tiếp tục tư vấn cùng nhân viên',
          body: transcript ? `${transcript}\n\nKhách yêu cầu nhân viên tiếp tục tư vấn.` : 'Khách yêu cầu nhân viên tiếp tục tư vấn từ cuộc trò chuyện trợ lý.',
          orderId: data.orderId,
        }, context);
        return { targetType: 'ticket', id: result.ticket.id, reference: result.ticket.code };
      }
      if (!data.contact?.name || !data.contact?.email) throw new ServiceError(400, 'VALIDATION_ERROR', 'Để nhân viên liên hệ, cần tên và email');
      const message = transcript
        ? `Yêu cầu tư vấn tiếp nối cuộc trò chuyện ${data.conversationId}.\n\n${transcript}`
        : `Yêu cầu nhân viên liên hệ để tiếp tục cuộc trò chuyện ${data.conversationId}.`;
      const result = await this.createContact(actor, {
        name: data.contact.name, email: data.contact.email,
        ...(data.contact.phone ? { phone: data.contact.phone } : {}),
        kind: 'general', message, consent: true,
      }, context);
      return { targetType: 'contact', id: result.id, reference: result.id };
    },
  });
}

export function createSupportHandoffPort(supportService) {
  if (typeof supportService?.createHandoff !== 'function') throw new TypeError('Support service must implement createHandoff');
  return Object.freeze({ createHandoff: (actor, input, context) => supportService.createHandoff(actor, input, context) });
}
