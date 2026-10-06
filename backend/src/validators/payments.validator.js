import { ServiceError } from '../utils/serviceError.js';

const REFUND_STATUSES = new Set(['requested', 'approved', 'rejected', 'processing', 'completed', 'failed']);
const OBJECT_ID = /^[a-f0-9]{24}$/iu;

function invalid(field, message = 'Trường dữ liệu chưa hợp lệ') {
  throw new ServiceError(400, 'VALIDATION_ERROR', 'Yêu cầu chưa hợp lệ', [{ field, code: 'INVALID', message }]);
}

export function validatePaymentId(req, _res, next) {
  if (!OBJECT_ID.test(String(req.params.id || ''))) return next(new ServiceError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên'));
  return next();
}

export function validatePaymentBody(kind) {
  return (req, _res, next) => {
    try {
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('body');
      if (kind === 'refundRequest') {
        const allowed = new Set(['amountVnd', 'reason', 'expectedVersion']);
        if (Object.keys(body).some((key) => !allowed.has(key))) invalid('body');
        if (!Number.isSafeInteger(body.amountVnd) || body.amountVnd < 1) invalid('amountVnd');
        if (typeof body.reason !== 'string' || body.reason.trim().length < 1 || body.reason.length > 1000) invalid('reason');
        if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0) invalid('expectedVersion');
      } else if (kind === 'refundDecision') {
        const allowed = new Set(['decision', 'reason', 'expectedVersion']);
        if (Object.keys(body).some((key) => !allowed.has(key))) invalid('body');
        if (!['approved', 'rejected'].includes(body.decision)) invalid('decision');
        if (typeof body.reason !== 'string' || body.reason.trim().length < 1 || body.reason.length > 1000) invalid('reason');
        if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0) invalid('expectedVersion');
      } else if (kind === 'refundComplete') {
        const allowed = new Set(['externalReference', 'evidenceReference', 'expectedVersion']);
        if (Object.keys(body).some((key) => !allowed.has(key))) invalid('body');
        for (const field of ['externalReference', 'evidenceReference']) {
          if (typeof body[field] !== 'string' || body[field].trim().length < 1 || body[field].length > 500) invalid(field);
        }
        if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0) invalid('expectedVersion');
      } else {
        throw new TypeError(`Unknown payment DTO: ${kind}`);
      }
      req.validatedBody = body;
      return next();
    } catch (error) { return next(error); }
  };
}

export function validateRefundFilters(req, _res, next) {
  const { status } = req.query;
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
  if (status !== undefined && !REFUND_STATUSES.has(status)) return next(new ServiceError(400, 'VALIDATION_ERROR', 'Bộ lọc trạng thái không hợp lệ'));
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return next(new ServiceError(400, 'VALIDATION_ERROR', 'Bộ lọc phân trang không hợp lệ'));
  }
  req.paymentFilters = { ...(status ? { status } : {}), page, limit };
  return next();
}

export function validateIdempotencyKey(req, _res, next) {
  const value = req.get('Idempotency-Key');
  if (typeof value !== 'string' || value.length < 22 || value.length > 200 || /[\r\n]/u.test(value)) {
    return next(new ServiceError(400, 'VALIDATION_ERROR', 'Thiếu khóa chống lặp hợp lệ'));
  }
  req.idempotencyKey = value;
  return next();
}
