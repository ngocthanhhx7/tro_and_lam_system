import { AuditLog as DefaultAuditLog } from '../../models/operations/audit-log.model.js';
import { badRequest } from '../../utils/serviceError.js';
import { parseDateRange } from '../../validators/operations.validator.js';

const REDACTED = '[REDACTED]';
const SECRET_FIELD = /(password|passwd|otp|verification.?code|token|secret|signature|authorization|cookie|api.?key|credential|email|phone|address|message|transcript|webhook.?body|headers?)/i;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const LONG_DIGITS = /(?:\+?\d[\s().-]*){8,}/;
const UUID_REQUEST_ID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/iu;
const MONGO_OBJECT_ID = /^[a-f\d]{24}$/iu;
const SAFE_KEY = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/;

function auditError(field) {
  return badRequest('VALIDATION_ERROR', 'Audit event không hợp lệ', [{ field, code: 'INVALID', message: 'Giá trị audit không hợp lệ' }]);
}

function cleanText(value, maxLength = 500) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || EMAIL_VALUE.test(trimmed) || LONG_DIGITS.test(trimmed) || /\b(?:bearer\s+)[a-z0-9._~+/-]+=*/i.test(trimmed)) return REDACTED;
  return trimmed.slice(0, maxLength);
}

function safeChangeValue(value, key, depth = 0) {
  if (SECRET_FIELD.test(key)) return REDACTED;
  if (depth > 5) return REDACTED;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : REDACTED;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? REDACTED : value.toISOString();
  if (typeof value === 'string') return cleanText(value);
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => safeChangeValue(item, key, depth + 1));
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return REDACTED;
  return Object.fromEntries(Object.entries(value).slice(0, 50).map(([childKey, childValue]) => [
    SAFE_KEY.test(childKey) ? childKey : 'invalid_key', safeChangeValue(childValue, childKey, depth + 1),
  ]));
}

export function redactAuditEvent(event = {}) {
  const action = cleanText(event.action, 100);
  const targetType = cleanText(event.targetType, 80);
  const requestId = typeof event.requestId === 'string' && UUID_REQUEST_ID.test(event.requestId.trim())
    ? event.requestId.trim()
    : cleanText(event.requestId, 120);
  const outcome = cleanText(event.outcome, 24);
  if (!action || action === REDACTED || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(action)) throw auditError('action');
  if (!targetType || targetType === REDACTED || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(targetType)) throw auditError('targetType');
  if (!requestId || requestId === REDACTED || !/^[A-Za-z0-9._:-]+$/.test(requestId)) throw auditError('requestId');
  if (!outcome || outcome === REDACTED || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(outcome)) throw auditError('outcome');
  const actorRole = ['customer', 'staff', 'admin', 'system'].includes(event.actorRole) ? event.actorRole : null;
  const rawTargetId = typeof event.targetId === 'string' ? event.targetId.trim() : '';
  const targetId = MONGO_OBJECT_ID.test(rawTargetId) ? rawTargetId : cleanText(event.targetId, 120);
  const reasonCode = typeof event.reasonCode === 'string' && /^[A-Z0-9_.-]{1,80}$/.test(event.reasonCode)
    ? event.reasonCode : null;
  const changesRedacted = event.changesRedacted && typeof event.changesRedacted === 'object' && !Array.isArray(event.changesRedacted)
    ? safeChangeValue(event.changesRedacted, 'changesRedacted') : null;

  return {
    actorId: event.actorId || null,
    actorRole,
    requestId,
    action,
    targetType,
    targetId: targetId === REDACTED ? null : targetId,
    outcome,
    reasonCode,
    changesRedacted,
  };
}

export function encodeAuditCursor(row) {
  return Buffer.from(JSON.stringify({ createdAt: new Date(row.createdAt).toISOString(), id: String(row._id) })).toString('base64url');
}

export function decodeAuditCursor(cursor) {
  if (cursor === undefined) return null;
  if (typeof cursor !== 'string' || cursor.length > 512) throw auditError('cursor');
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const createdAt = new Date(value.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || typeof value.id !== 'string' || !/^[a-f\d]{24}$/i.test(value.id)) throw new Error('invalid');
    return { createdAt, id: value.id };
  } catch {
    throw auditError('cursor');
  }
}

export function createAuditService({ AuditLog = DefaultAuditLog, now = () => new Date() } = {}) {
  async function append(event, { session } = {}) {
    const safeEvent = redactAuditEvent(event);
    const [created] = await AuditLog.create([safeEvent], session ? { session } : undefined);
    return created;
  }

  async function list(filters = {}) {
    const { from, to } = parseDateRange(filters);
    const limit = filters.limit === undefined ? 20 : Number(filters.limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw auditError('limit');
    const query = {};
    for (const key of ['action', 'actorId', 'targetType', 'targetId']) {
      if (filters[key] !== undefined) {
        const value = String(filters[key]).trim();
        if (!value || value.length > (key === 'action' ? 100 : 120)) throw auditError(key);
        if (key === 'actorId' && !/^[a-f\d]{24}$/i.test(value)) throw auditError(key);
        query[key] = key === 'action' || key === 'targetType' ? value : value;
      }
    }
    if (from || to) query.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const cursor = decodeAuditCursor(filters.cursor);
    const clauses = [query];
    if (cursor) clauses.push({ $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ] });
    const mongoQuery = clauses.length > 1 ? { $and: clauses } : query;
    const rows = await AuditLog.find(mongoQuery).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const items = pageRows.map((row) => {
      const redacted = redactAuditEvent(row);
      return {
        id: String(row._id),
        ...redacted,
        createdAt: row.createdAt,
      };
    });
    return { items, nextCursor: hasMore ? encodeAuditCursor(pageRows.at(-1)) : null, generatedAt: now() };
  }

  return Object.freeze({ append, list });
}
