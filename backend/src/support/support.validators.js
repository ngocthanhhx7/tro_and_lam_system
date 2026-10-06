import { badRequest } from '../utils/serviceError.js';

const ID = /^[a-f\d]{24}$/i;
const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const REVIEW_STATUSES = ['pending', 'published', 'hidden'];
const TICKET_KINDS = ['support', 'complaint', 'return'];
const TICKET_STATUSES = ['open', 'assigned', 'in_progress', 'waiting_customer', 'resolved', 'closed'];
const CONTACT_KINDS = ['general', 'corporate', 'quote'];
const CONTACT_STATUSES = ['new', 'assigned', 'contacted', 'closed'];
const RETURN_STATUSES = ['requested', 'approved', 'rejected', 'received', 'closed'];
const FAIL = (field, message = 'Giá trị không hợp lệ') => badRequest('VALIDATION_ERROR', 'Vui lòng kiểm tra lại thông tin', [{ field, code: 'INVALID_VALUE', message }]);

function plainObject(value, field = 'body') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw FAIL(field, 'Dữ liệu phải là một đối tượng');
}

function exact(value, allowed, field = 'body') {
  plainObject(value, field);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw FAIL(key, 'Trường này không được hỗ trợ');
}

function text(value, field, { min = 0, max = 5000, required = false } = {}) {
  if (typeof value !== 'string') throw FAIL(field, 'Giá trị phải là văn bản');
  // eslint-disable-next-line no-control-regex -- Public text inputs discard disallowed control characters.
  const result = value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (result.length < min || result.length > max || (required && !result)) throw FAIL(field, `Độ dài nội dung cần từ ${min || 1} đến ${max} ký tự`);
  return result;
}

export function validateObjectId(value, field = 'id') {
  if (typeof value !== 'string' || !ID.test(value)) throw FAIL(field, 'Mã tài nguyên không hợp lệ');
  return value;
}

function version(value, field = 'expectedVersion') {
  if (!Number.isSafeInteger(value) || value < 0) throw FAIL(field, 'Phiên bản dữ liệu không hợp lệ');
  return value;
}

function ids(value, field, maximum = 5) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximum || value.some((item) => typeof item !== 'string' || !ID.test(item))) throw FAIL(field, `Danh sách cần từ 0 đến ${maximum} mã hợp lệ`);
  if (new Set(value).size !== value.length) throw FAIL(field, 'Không được lặp lại mã');
  return [...value];
}

export function validateContactCreate(value) {
  exact(value, ['name', 'email', 'phone', 'kind', 'productId', 'quantity', 'company', 'message', 'consent']);
  const name = text(value.name, 'name', { min: 1, max: 120, required: true });
  const email = text(value.email, 'email', { min: 3, max: 254, required: true }).toLowerCase();
  if (!EMAIL.test(email) || /[\r\n]/.test(email)) throw FAIL('email', 'Email không hợp lệ');
  if (!CONTACT_KINDS.includes(value.kind)) throw FAIL('kind', 'Loại liên hệ không hợp lệ');
  if (value.consent !== true) throw FAIL('consent', 'Cần đồng ý để được liên hệ về yêu cầu này');
  const productId = value.productId === undefined ? undefined : validateObjectId(value.productId, 'productId');
  if (value.quantity !== undefined && (!Number.isSafeInteger(value.quantity) || value.quantity < 1 || value.quantity > 99)) throw FAIL('quantity');
  return {
    name, email,
    ...(value.phone === undefined ? {} : { phone: text(value.phone, 'phone', { max: 30 }) }),
    kind: value.kind,
    ...(productId ? { productId } : {}),
    ...(value.quantity === undefined ? {} : { quantity: value.quantity }),
    ...(value.company === undefined ? {} : { company: text(value.company, 'company', { max: 160 }) }),
    message: text(value.message, 'message', { min: 1, max: 5000, required: true }),
    consent: true,
  };
}

export function validateReviewCreate(value) {
  exact(value, ['orderId', 'productId', 'rating', 'comment', 'attachmentIds', 'consentToPublishAttachments']);
  if (!Number.isSafeInteger(value.rating) || value.rating < 1 || value.rating > 5) throw FAIL('rating', 'Chọn số sao từ 1 đến 5');
  if (value.consentToPublishAttachments !== undefined && typeof value.consentToPublishAttachments !== 'boolean') throw FAIL('consentToPublishAttachments');
  const attachmentIds = ids(value.attachmentIds, 'attachmentIds');
  if (attachmentIds.length && value.consentToPublishAttachments !== true) throw FAIL('consentToPublishAttachments', 'Cần đồng ý công bố ảnh đã kiểm duyệt');
  return {
    orderId: validateObjectId(value.orderId, 'orderId'),
    productId: validateObjectId(value.productId, 'productId'),
    rating: value.rating,
    comment: text(value.comment, 'comment', { max: 5000 }),
    attachmentIds,
    consentToPublishAttachments: value.consentToPublishAttachments === true,
  };
}

export function validateReviewWrite(value) {
  exact(value, ['rating', 'comment', 'expectedVersion']);
  if (!Number.isSafeInteger(value.rating) || value.rating < 1 || value.rating > 5) throw FAIL('rating');
  return { rating: value.rating, comment: text(value.comment, 'comment', { max: 5000 }), expectedVersion: version(value.expectedVersion) };
}

export function validateReviewModeration(value) {
  exact(value, ['status', 'reason', 'expectedVersion']);
  if (!['published', 'hidden'].includes(value.status)) throw FAIL('status', 'Chỉ có thể công bố hoặc ẩn đánh giá');
  return { status: value.status, reason: text(value.reason, 'reason', { min: 1, max: 1000, required: true }), expectedVersion: version(value.expectedVersion) };
}

export function validateTicketCreate(value) {
  exact(value, ['kind', 'subject', 'body', 'orderId', 'attachmentIds']);
  if (!TICKET_KINDS.includes(value.kind)) throw FAIL('kind', 'Loại yêu cầu không hợp lệ');
  return {
    kind: value.kind,
    subject: text(value.subject, 'subject', { min: 1, max: 200, required: true }),
    body: text(value.body, 'body', { min: 1, max: 10000, required: true }),
    ...(value.orderId === undefined ? {} : { orderId: validateObjectId(value.orderId, 'orderId') }),
    attachmentIds: ids(value.attachmentIds, 'attachmentIds'),
  };
}

export function validateTicketMessageCreate(value) {
  exact(value, ['body', 'attachmentIds', 'visibility']);
  if (!['customer', 'internal'].includes(value.visibility)) throw FAIL('visibility');
  return {
    body: text(value.body, 'body', { min: 1, max: 10000, required: true }),
    attachmentIds: ids(value.attachmentIds, 'attachmentIds'),
    visibility: value.visibility,
  };
}

export function validateStaffTicketWrite(value) {
  exact(value, ['status', 'assignedTo', 'priority', 'expectedVersion']);
  const result = { expectedVersion: version(value.expectedVersion) };
  if (value.status !== undefined) {
    if (!TICKET_STATUSES.includes(value.status)) throw FAIL('status');
    result.status = value.status;
  }
  if (value.assignedTo !== undefined) result.assignedTo = value.assignedTo === '' ? null : validateObjectId(value.assignedTo, 'assignedTo');
  if (value.priority !== undefined) {
    result.priority = text(value.priority, 'priority', { min: 1, max: 40, required: true });
  }
  if (Object.keys(result).length === 1) throw FAIL('body', 'Cần có ít nhất một thay đổi');
  return result;
}

export function validateStaffContactWrite(value) {
  exact(value, ['status', 'assignedTo', 'note', 'expectedVersion']);
  const result = { expectedVersion: version(value.expectedVersion) };
  if (value.status !== undefined) {
    if (!CONTACT_STATUSES.includes(value.status)) throw FAIL('status');
    result.status = value.status;
  }
  if (value.assignedTo !== undefined) result.assignedTo = value.assignedTo === '' ? null : validateObjectId(value.assignedTo, 'assignedTo');
  if (value.note !== undefined) result.note = text(value.note, 'note', { max: 5000 });
  if (Object.keys(result).length === 1) throw FAIL('body', 'Cần có ít nhất một thay đổi');
  return result;
}

export function validateReturnRequestCreate(value) {
  exact(value, ['items', 'message', 'expectedVersion']);
  if (!Array.isArray(value.items) || !value.items.length || value.items.length > 100) throw FAIL('items', 'Danh sách sản phẩm trả không hợp lệ');
  const items = value.items.map((item, index) => {
    exact(item, ['productId', 'quantity', 'reason'], `items.${index}`);
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw FAIL(`items.${index}.quantity`);
    return {
      productId: validateObjectId(item.productId, `items.${index}.productId`),
      quantity: item.quantity,
      reason: text(item.reason, `items.${index}.reason`, { min: 1, max: 1000, required: true }),
    };
  });
  if (new Set(items.map((item) => item.productId)).size !== items.length) throw FAIL('items', 'Không được lặp sản phẩm');
  return { items, message: text(value.message, 'message', { min: 1, max: 5000, required: true }), expectedVersion: version(value.expectedVersion) };
}

export function validateReturnDecision(value) {
  exact(value, ['decision', 'reason', 'expectedVersion']);
  if (!['approved', 'rejected'].includes(value.decision)) throw FAIL('decision');
  return { decision: value.decision, reason: text(value.reason, 'reason', { min: 1, max: 1000, required: true }), expectedVersion: version(value.expectedVersion) };
}

export function validateReturnInspection(value) {
  exact(value, ['items', 'evidenceReference', 'expectedVersion']);
  if (!Array.isArray(value.items) || !value.items.length || value.items.length > 100) throw FAIL('items');
  const items = value.items.map((item, index) => {
    exact(item, ['productId', 'receivedQuantity', 'resellableQuantity'], `items.${index}`);
    for (const key of ['receivedQuantity', 'resellableQuantity']) if (!Number.isSafeInteger(item[key]) || item[key] < 0) throw FAIL(`items.${index}.${key}`);
    if (item.resellableQuantity > item.receivedQuantity) throw FAIL(`items.${index}.resellableQuantity`);
    return { productId: validateObjectId(item.productId, `items.${index}.productId`), receivedQuantity: item.receivedQuantity, resellableQuantity: item.resellableQuantity };
  });
  if (new Set(items.map((item) => item.productId)).size !== items.length) throw FAIL('items');
  return { items, evidenceReference: text(value.evidenceReference, 'evidenceReference', { min: 1, max: 500, required: true }), expectedVersion: version(value.expectedVersion) };
}

export function validateReasonVersion(value) {
  exact(value, ['reason', 'expectedVersion']);
  return { reason: text(value.reason, 'reason', { min: 1, max: 1000, required: true }), expectedVersion: version(value.expectedVersion) };
}

export function validateAssistantHandoff(value) {
  exact(value, ['conversationId', 'shareTranscript', 'contact', 'orderId']);
  const conversationId = text(value.conversationId, 'conversationId', { min: 1, max: 240, required: true });
  if (typeof value.shareTranscript !== 'boolean') throw FAIL('shareTranscript');
  let contact;
  if (value.contact !== undefined) {
    exact(value.contact, ['name', 'email', 'phone'], 'contact');
    contact = {};
    if (value.contact.name !== undefined) contact.name = text(value.contact.name, 'contact.name', { max: 120 });
    if (value.contact.email !== undefined) {
      contact.email = text(value.contact.email, 'contact.email', { max: 254 }).toLowerCase();
      if (!EMAIL.test(contact.email)) throw FAIL('contact.email');
    }
    if (value.contact.phone !== undefined) contact.phone = text(value.contact.phone, 'contact.phone', { max: 30 });
  }
  return { conversationId, shareTranscript: value.shareTranscript, ...(contact ? { contact } : {}), ...(value.orderId === undefined ? {} : { orderId: validateObjectId(value.orderId, 'orderId') }) };
}

export function validateAttachmentUploadCreate(value) {
  exact(value, ['purpose', 'orderId', 'ticketId', 'reviewId', 'mimeType', 'bytes', 'visibility']);
  if (!['ticket', 'refund', 'review'].includes(value.purpose)) throw FAIL('purpose');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(value.mimeType)) throw FAIL('mimeType', 'Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP');
  if (!Number.isSafeInteger(value.bytes) || value.bytes < 1 || value.bytes > 5 * 1024 * 1024) throw FAIL('bytes', 'Ảnh không được vượt quá 5 MB');
  if (value.visibility !== undefined && !['customer', 'internal'].includes(value.visibility)) throw FAIL('visibility');
  const result = { purpose: value.purpose, mimeType: value.mimeType, bytes: value.bytes, visibility: value.visibility || 'customer' };
  for (const key of ['orderId', 'ticketId', 'reviewId']) if (value[key] !== undefined) result[key] = validateObjectId(value[key], key);
  if (result.purpose === 'refund' && !result.orderId) throw FAIL('orderId', 'Chứng từ hoàn tiền cần gắn với đơn');
  if (result.purpose === 'review' && !result.orderId) throw FAIL('orderId', 'Ảnh đánh giá cần gắn với đơn đã giao');
  if (result.purpose === 'review' && result.visibility !== 'customer') throw FAIL('visibility', 'Ảnh đánh giá chỉ có thể là nội dung khách hàng');
  return result;
}

function enumQuery(value, values, field) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !values.includes(value)) throw FAIL(field);
  return value;
}

export function validateListQuery(query = {}, { statusValues, kindValues } = {}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) throw FAIL('page');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw FAIL('limit');
  return {
    page, limit,
    ...(statusValues ? { status: enumQuery(query.status, statusValues, 'status') } : {}),
    ...(kindValues ? { kind: enumQuery(query.kind, kindValues, 'kind') } : {}),
    ...(query.assignedTo === undefined ? {} : { assignedTo: validateObjectId(query.assignedTo, 'assignedTo') }),
    ...(query.productId === undefined ? {} : { productId: validateObjectId(query.productId, 'productId') }),
  };
}

export function validateCursorQuery(query = {}) {
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw FAIL('limit');
  if (query.cursor === undefined) return { limit };
  if (typeof query.cursor !== 'string' || query.cursor.length > 512) throw FAIL('cursor');
  let value;
  try { value = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')); } catch { throw FAIL('cursor'); }
  const createdAt = new Date(value.createdAt);
  if (!Number.isFinite(createdAt.getTime()) || !ID.test(value.id)) throw FAIL('cursor');
  return { limit, cursor: { createdAt, id: value.id } };
}

export const supportValidationEnums = Object.freeze({
  reviewStatuses: REVIEW_STATUSES,
  ticketKinds: TICKET_KINDS,
  ticketStatuses: TICKET_STATUSES,
  contactKinds: CONTACT_KINDS,
  contactStatuses: CONTACT_STATUSES,
  returnStatuses: RETURN_STATUSES,
});
