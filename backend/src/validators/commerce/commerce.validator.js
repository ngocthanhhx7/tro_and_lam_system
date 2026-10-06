import { ServiceError } from '../../utils/serviceError.js';

const OBJECT_ID = /^[a-f\d]{24}$/iu;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const ORDER_STATUSES = new Set(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned']);
const PAYMENT_STATUSES = new Set(['pending', 'paid', 'failed', 'expired', 'cancelled', 'refund_pending', 'refunded', 'partially_refunded']);

function invalid(field, message = 'Giá trị chưa hợp lệ') {
  throw new ServiceError(400, 'VALIDATION_ERROR', message, [{ field, code: 'INVALID', message }]);
}

function strict(value, allowed, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field, 'Nội dung phải là đối tượng JSON');
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new ServiceError(400, 'VALIDATION_ERROR', 'Dữ liệu có trường không được hỗ trợ', unknown.map((key) => ({ field: `${field}.${key}`, code: 'UNKNOWN_FIELD', message: 'Trường này không được hỗ trợ' })));
}

function required(value, fields, parent) {
  for (const field of fields) if (value[field] === undefined) invalid(`${parent}.${field}`, 'Trường này là bắt buộc');
}

function boundedString(value, field, { min = 0, max = 5000, optional = false, pattern } = {}) {
  if (value === undefined && optional) return;
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || (pattern && !pattern.test(value.trim()))) invalid(field);
}

function integer(value, field, { min = 0, optional = false } = {}) {
  if (value === undefined && optional) return;
  if (!Number.isSafeInteger(value) || value < min) invalid(field);
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) invalid('items');
  const ids = new Set();
  items.forEach((item, index) => {
    strict(item, ['productId', 'quantity'], `items.${index}`);
    required(item, ['productId', 'quantity'], `items.${index}`);
    boundedString(item.productId, `items.${index}.productId`, { min: 24, max: 24, pattern: OBJECT_ID });
    integer(item.quantity, `items.${index}.quantity`, { min: 1 });
    if (item.quantity > 99 || ids.has(item.productId)) invalid(`items.${index}`, 'Sản phẩm hoặc số lượng không hợp lệ');
    ids.add(item.productId);
  });
}

function validateRecipient(recipient) {
  const allowed = ['recipientName', 'email', 'phone', 'line1', 'line2', 'ward', 'province', 'countryCode', 'postalCode', 'formattedAddress', 'location'];
  strict(recipient, allowed, 'recipient');
  required(recipient, ['recipientName', 'email', 'phone', 'line1', 'countryCode', 'formattedAddress'], 'recipient');
  boundedString(recipient.recipientName, 'recipient.recipientName', { min: 1, max: 100 });
  boundedString(recipient.email, 'recipient.email', { min: 3, max: 254, pattern: EMAIL });
  boundedString(recipient.phone, 'recipient.phone', { min: 1, max: 30 });
  boundedString(recipient.line1, 'recipient.line1', { min: 1, max: 200 });
  boundedString(recipient.line2, 'recipient.line2', { max: 200, optional: true });
  boundedString(recipient.ward, 'recipient.ward', { max: 100, optional: true });
  boundedString(recipient.province, 'recipient.province', { max: 100, optional: true });
  if (recipient.countryCode !== 'VN') invalid('recipient.countryCode');
  boundedString(recipient.postalCode, 'recipient.postalCode', { max: 20, optional: true });
  boundedString(recipient.formattedAddress, 'recipient.formattedAddress', { min: 1, max: 500 });
  if (recipient.location !== undefined) {
    strict(recipient.location, ['lat', 'lng', 'accuracyMeters', 'capturedAt', 'source'], 'recipient.location');
    if (typeof recipient.location.lat !== 'number' || recipient.location.lat < -90 || recipient.location.lat > 90
      || typeof recipient.location.lng !== 'number' || recipient.location.lng < -180 || recipient.location.lng > 180) invalid('recipient.location');
    integer(recipient.location.accuracyMeters, 'recipient.location.accuracyMeters', { optional: true });
    boundedString(recipient.location.source, 'recipient.location.source', { optional: true, pattern: /^(device|manual)$/u });
    if (recipient.location.capturedAt !== undefined && !Number.isFinite(Date.parse(recipient.location.capturedAt))) invalid('recipient.location.capturedAt');
  }
}

function validateCheckout(body, { create = false } = {}) {
  const allowed = ['items', 'recipient', 'addressId', 'paymentMethod', ...(create ? ['note', 'consent'] : [])];
  strict(body, allowed, 'body');
  required(body, ['items', 'paymentMethod', ...(create ? ['consent'] : [])], 'body');
  validateItems(body.items);
  if (!['cod', 'payos'].includes(body.paymentMethod)) invalid('paymentMethod');
  if ((body.addressId === undefined) === (body.recipient === undefined)) invalid('recipient', 'Gửi địa chỉ đã lưu hoặc thông tin người nhận');
  if (body.addressId !== undefined) boundedString(body.addressId, 'addressId', { min: 24, max: 24, pattern: OBJECT_ID });
  if (body.recipient !== undefined) validateRecipient(body.recipient);
  if (create) {
    if (body.consent !== true) invalid('consent', 'Cần xác nhận điều khoản đặt hàng');
    boundedString(body.note, 'note', { max: 1000, optional: true });
  }
}

function validateBody(schema) {
  return (req, _res, next) => {
    try {
      const body = req.body;
      switch (schema) {
        case 'checkoutQuote': validateCheckout(body); break;
        case 'checkoutCreate': validateCheckout(body, { create: true }); break;
        case 'cancel':
          strict(body, ['reason', 'expectedVersion'], 'body'); required(body, ['reason', 'expectedVersion'], 'body');
          boundedString(body.reason, 'reason', { min: 1, max: 1000 }); integer(body.expectedVersion, 'expectedVersion'); break;
        case 'transition': {
          strict(body, ['toStatus', 'expectedVersion', 'reason', 'shipping'], 'body'); required(body, ['toStatus', 'expectedVersion'], 'body');
          if (!ORDER_STATUSES.has(body.toStatus)) invalid('toStatus'); integer(body.expectedVersion, 'expectedVersion');
          boundedString(body.reason, 'reason', { max: 1000, optional: true });
          if (body.shipping !== undefined) {
            strict(body.shipping, ['carrier', 'trackingNumber'], 'shipping');
            if (body.toStatus !== 'shipped') invalid('shipping');
            required(body.shipping, ['carrier', 'trackingNumber'], 'shipping');
            boundedString(body.shipping.carrier, 'shipping.carrier', { min: 1, max: 120 });
            boundedString(body.shipping.trackingNumber, 'shipping.trackingNumber', { min: 1, max: 100 });
          }
          if (body.toStatus === 'cancelled' && !body.reason) invalid('reason');
          if (body.toStatus === 'shipped' && !body.shipping && !body.reason) invalid('reason');
          break;
        }
        case 'shippingEvent':
          strict(body, ['status', 'message', 'occurredAt', 'trackingNumber', 'carrier', 'expectedVersion'], 'body');
          required(body, ['status', 'message', 'occurredAt', 'expectedVersion'], 'body');
          boundedString(body.status, 'status', { min: 1, max: 80 }); boundedString(body.message, 'message', { min: 1, max: 1000 });
          boundedString(body.trackingNumber, 'trackingNumber', { max: 100, optional: true }); boundedString(body.carrier, 'carrier', { max: 120, optional: true });
          if (!Number.isFinite(Date.parse(body.occurredAt))) invalid('occurredAt'); integer(body.expectedVersion, 'expectedVersion'); break;
        case 'codCollection':
          strict(body, ['amountVnd', 'evidenceReference', 'expectedVersion'], 'body'); required(body, ['amountVnd', 'evidenceReference', 'expectedVersion'], 'body');
          integer(body.amountVnd, 'amountVnd', { min: 1 }); boundedString(body.evidenceReference, 'evidenceReference', { min: 1, max: 500 });
          integer(body.expectedVersion, 'expectedVersion'); break;
        case 'inventoryAdjustment':
          strict(body, ['delta', 'reason', 'expectedVersion'], 'body'); required(body, ['delta', 'reason', 'expectedVersion'], 'body');
          if (!Number.isSafeInteger(body.delta) || body.delta === 0) invalid('delta'); boundedString(body.reason, 'reason', { min: 1, max: 1000 });
          integer(body.expectedVersion, 'expectedVersion'); break;
        case 'orderAccessChallenge':
          strict(body, ['code', 'email'], 'body'); required(body, ['code', 'email'], 'body');
          boundedString(body.code, 'code', { min: 1, max: 32 }); boundedString(body.email, 'email', { min: 3, max: 254, pattern: EMAIL }); break;
        case 'orderAccessVerify':
          strict(body, ['challengeId', 'verificationCode'], 'body'); required(body, ['challengeId', 'verificationCode'], 'body');
          boundedString(body.challengeId, 'challengeId', { min: 20, max: 128, pattern: /^[A-Za-z0-9_-]+$/u });
          boundedString(body.verificationCode, 'verificationCode', { min: 6, max: 6, pattern: /^\d{6}$/u }); break;
        case 'orderClaim':
          strict(body, ['orderId'], 'body'); required(body, ['orderId'], 'body'); boundedString(body.orderId, 'orderId', { min: 24, max: 24, pattern: OBJECT_ID }); break;
        default: throw new TypeError(`Unknown commerce body schema: ${schema}`);
      }
      req.validatedBody = body;
      next();
    } catch (error) { next(error); }
  };
}

function validateId(req, _res, next) {
  if (!OBJECT_ID.test(req.params.id)) return next(new ServiceError(400, 'VALIDATION_ERROR', 'Mã tài nguyên chưa hợp lệ'));
  return next();
}

function validateProductId(req, _res, next) {
  if (!OBJECT_ID.test(req.params.productId)) return next(new ServiceError(400, 'VALIDATION_ERROR', 'Mã sản phẩm chưa hợp lệ'));
  return next();
}

function pagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) invalid('query');
  if (query.status && !ORDER_STATUSES.has(query.status)) invalid('status');
  if (query.paymentStatus && !PAYMENT_STATUSES.has(query.paymentStatus)) invalid('paymentStatus');
  if (query.queue && !ORDER_STATUSES.has(query.queue)) invalid('queue');
  if (query.q !== undefined) boundedString(query.q, 'q', { max: 120 });
  for (const field of ['from', 'to']) {
    if (query[field] !== undefined && !Number.isFinite(Date.parse(query[field]))) invalid(field);
  }
  if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to)) invalid('query', 'Khoảng thời gian chưa hợp lệ');
  return {
    page, limit,
    ...(query.status ? { status: query.status } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    ...(query.queue ? { queue: query.queue } : {}),
    ...(query.q?.trim() ? { q: query.q.trim() } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  };
}

export { validateBody as validateCommerceBody, validateId as validateCommerceId, validateProductId as validateCommerceProductId, pagination as validateCommerceFilters };
