import { ServiceError } from '../utils/serviceError.js';

export function notFound(_req, _res, next) {
  next(new ServiceError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên'));
}

export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return;
  const parserStatus = error?.type === 'entity.too.large' ? 413
    : error?.type === 'entity.parse.failed' ? 400
      : undefined;
  const candidate = parserStatus ?? error?.status;
  const status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
  const knownCodes = new Set([
    'VALIDATION_ERROR', 'BAD_REQUEST', 'AUTH_REQUIRED', 'SESSION_EXPIRED', 'FORBIDDEN',
    'ACCOUNT_BLOCKED', 'CSRF_INVALID', 'NOT_FOUND', 'VERSION_CONFLICT', 'OUT_OF_STOCK',
    'IDEMPOTENCY_CONFLICT', 'REQUEST_IN_PROGRESS', 'INVALID_TRANSITION',
    'PENDING_APPEAL_EXISTS', 'ALREADY_REVIEWED', 'LINK_EXPIRED', 'NFC_REVOKED',
    'PAYLOAD_TOO_LARGE', 'UNSUPPORTED_MEDIA_TYPE', 'CHECKOUT_NOT_ALLOWED',
    'REVIEW_NOT_ELIGIBLE', 'PARTIAL_OPERATION_DISABLED', 'RATE_LIMITED', 'DATABASE_UNAVAILABLE', 'PAYMENT_UNAVAILABLE',
    'MAIL_UNAVAILABLE', 'AI_UNAVAILABLE', 'GEO_UNAVAILABLE', 'MEDIA_UNAVAILABLE', 'CORS_ORIGIN_DENIED',
    'INTERNAL_ERROR',
  ]);
  const code = parserStatus === 413 ? 'PAYLOAD_TOO_LARGE'
    : parserStatus === 400 ? 'BAD_REQUEST'
      : knownCodes.has(error?.code) ? error.code
        : status >= 500 ? 'INTERNAL_ERROR'
          : status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST';
  const message = status >= 500
    ? (code === 'INTERNAL_ERROR' ? 'Lỗi máy chủ' : error.message)
    : parserStatus === 413 ? 'Dữ liệu vượt giới hạn cho phép'
      : parserStatus === 400 ? 'JSON không hợp lệ'
        : error.message || 'Yêu cầu không hợp lệ';
  const body = { error: { code, message }, meta: { requestId: res.locals.requestId } };
  if (status < 500 && Array.isArray(error?.details)) {
    body.error.details = error.details.map(({ field, code: detailCode, message: detailMessage }) => ({
      field: String(field ?? '').slice(0, 120),
      code: String(detailCode ?? 'INVALID').slice(0, 80),
      message: String(detailMessage ?? 'Giá trị không hợp lệ').slice(0, 240),
    }));
  }
  return res.status(status).json(body);
}
