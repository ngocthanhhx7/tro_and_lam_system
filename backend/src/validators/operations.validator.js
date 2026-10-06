import { badRequest } from '../utils/serviceError.js';

const SETTING_KEYS = new Set(['shippingZones', 'codEnabled', 'checkoutLimits', 'supportWindows']);
const SENSITIVE_SETTING_KEY = /(secret|password|token|credential|smtp|payos|gemini|api.?key|webhook.?url|provider.?url)/i;
const INTERNAL_NOTIFICATION_PREFIXES = ['/tai-khoan', '/staff', '/admin', '/thanh-toan', '/tra-cuu-don-hang', '/lien-he'];
const MAX_SETTING_DEPTH = 5;
const MAX_SETTING_ITEMS = 100;

function invalid(field, message = 'Giá trị không hợp lệ') {
  return badRequest('VALIDATION_ERROR', 'Dữ liệu chưa hợp lệ', [{ field, code: 'INVALID', message }]);
}

function hasControlCharacters(value) {
  for (const character of value) {
    const codePoint = character.charCodeAt(0);
    if (codePoint < 0x20 || codePoint === 0x7f) return true;
  }
  return false;
}

export function parsePagination(query = {}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) throw invalid('page');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw invalid('limit', 'limit phải từ 1 đến 100');
  return { page, limit };
}

export function parseBooleanQuery(value, field) {
  if (value === undefined) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw invalid(field);
}

function validateJsonValue(value, field, depth = 0) {
  if (depth > MAX_SETTING_DEPTH) throw invalid(field, 'Cấu hình có cấu trúc quá sâu');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) throw invalid(field, 'Số cấu hình phải là số nguyên an toàn');
    return;
  }
  if (typeof value === 'string') {
    if (value.length > 1000 || /(?:https?:\/\/|\b(?:smtp|payos|gemini)[._-])/i.test(value)) {
      throw invalid(field, 'Không lưu URL hoặc cấu hình nhà cung cấp trong business settings');
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_SETTING_ITEMS) throw invalid(field, 'Danh sách cấu hình vượt giới hạn');
    value.forEach((item, index) => validateJsonValue(item, `${field}[${index}]`, depth + 1));
    return;
  }
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw invalid(field);
  const entries = Object.entries(value);
  if (entries.length > MAX_SETTING_ITEMS) throw invalid(field, 'Cấu hình có quá nhiều mục');
  for (const [key, child] of entries) {
    if (['__proto__', 'constructor', 'prototype'].includes(key) || SENSITIVE_SETTING_KEY.test(key) || /^low.?stock.?threshold$/i.test(key)) {
      throw invalid(`${field}.${key}`, 'Trường này không được lưu trong business settings');
    }
    validateJsonValue(child, `${field}.${key}`, depth + 1);
  }
}

function normalizeProvinceName(value) {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/đ/giu, 'd').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('vi-VN');
}

function validateShippingZones(zones) {
  if (!Array.isArray(zones) || zones.length > MAX_SETTING_ITEMS) throw invalid('values.shippingZones');
  const zoneIds = new Set();
  const provinceNames = new Set();
  zones.forEach((zone, index) => {
    const field = `values.shippingZones[${index}]`;
    if (!zone || typeof zone !== 'object' || Array.isArray(zone) || Object.getPrototypeOf(zone) !== Object.prototype) throw invalid(field);
    const keys = Object.keys(zone);
    if (keys.length !== 3 || keys.some((key) => !['id', 'provinceNames', 'feeVnd'].includes(key))) {
      throw invalid(field, 'Mỗi vùng chỉ gồm id, provinceNames và feeVnd');
    }
    if (typeof zone.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(zone.id) || zone.id.length > 80) {
      throw invalid(`${field}.id`, 'id cần là mã chữ/số duy nhất');
    }
    const normalizedId = zone.id.toLowerCase();
    if (zoneIds.has(normalizedId)) throw invalid(`${field}.id`, 'id vùng giao hàng bị trùng');
    zoneIds.add(normalizedId);
    if (!Array.isArray(zone.provinceNames) || zone.provinceNames.length < 1 || zone.provinceNames.length > MAX_SETTING_ITEMS) {
      throw invalid(`${field}.provinceNames`, 'Cần ít nhất một tên tỉnh/thành đã được xác nhận');
    }
    zone.provinceNames.forEach((name, nameIndex) => {
      const nameField = `${field}.provinceNames[${nameIndex}]`;
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw invalid(nameField);
      const normalizedName = normalizeProvinceName(name);
      if (provinceNames.has(normalizedName)) throw invalid(nameField, 'Tỉnh/thành đã được gán vào một vùng khác');
      provinceNames.add(normalizedName);
    });
    if (!Number.isSafeInteger(zone.feeVnd) || zone.feeVnd < 0) throw invalid(`${field}.feeVnd`, 'Phí cần là số nguyên VND không âm');
  });
}

export function validateBusinessSettingsWrite(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('body');
  const allowed = new Set(['values', 'expectedVersion', 'reason']);
  const extra = Object.keys(body).find((key) => !allowed.has(key));
  if (extra) throw invalid(extra, 'Trường không được hỗ trợ');
  if (!body.values || typeof body.values !== 'object' || Array.isArray(body.values)) throw invalid('values');
  if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0) throw invalid('expectedVersion');
  if (typeof body.reason !== 'string' || body.reason.trim().length < 1 || body.reason.length > 1000) throw invalid('reason');
  validateBusinessSettingsValues(body.values);
  if (Object.keys(body.values).length === 0) throw invalid('values', 'Cần ít nhất một giá trị để cập nhật');
  return { values: body.values, expectedVersion: body.expectedVersion, reason: body.reason.trim() };
}

function validateBusinessSettingsValues(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw invalid('values');
  for (const [key, value] of Object.entries(values)) {
    if (!SETTING_KEYS.has(key)) throw invalid(`values.${key}`, 'Cấu hình này không thuộc danh sách được phép');
    if (key === 'codEnabled' && typeof value !== 'boolean') throw invalid('values.codEnabled');
    if (key === 'shippingZones') validateShippingZones(value);
    if (['checkoutLimits', 'supportWindows'].includes(key)
      && (!value || typeof value !== 'object' || Array.isArray(value))) throw invalid(`values.${key}`);
    if (key === 'checkoutLimits') {
      const keys = Object.keys(value);
      if (keys.some((name) => name !== 'maxPendingCodOrders')) throw invalid('values.checkoutLimits', 'Chỉ hỗ trợ maxPendingCodOrders');
      if (value.maxPendingCodOrders !== undefined
        && (!Number.isSafeInteger(value.maxPendingCodOrders) || value.maxPendingCodOrders < 1)) {
        throw invalid('values.checkoutLimits.maxPendingCodOrders', 'Cần là số nguyên dương');
      }
    }
    validateJsonValue(value, `values.${key}`);
  }
  return values;
}

export function sanitizeBusinessSettingsValues(values = {}) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return {};
  const safe = {};
  for (const [key, value] of Object.entries(values)) {
    if (!SETTING_KEYS.has(key)) continue;
    try {
      validateBusinessSettingsValues({ [key]: value });
      safe[key] = value;
    } catch {
      // Hide invalid or legacy values rather than return provider or credential data.
    }
  }
  return safe;
}

const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

export function parseDateRange(query = {}) {
  const from = query.from === undefined ? undefined : parseDateTime(query.from, 'from');
  const to = query.to === undefined ? undefined : parseDateTime(query.to, 'to');
  if (from && to && from > to) throw invalid('from', 'from must be earlier than or equal to to');
  return { from, to };
}

export function parseDateTime(value, field = 'date') {
  const parts = typeof value === 'string' ? RFC3339.exec(value) : null;
  if (!parts) throw invalid(field, 'Use ISO 8601 date-time');
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offset] = parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = month === 2 ? (leapYear ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  const offsetHours = offset === 'Z' ? 0 : Number(offset.slice(1, 3));
  const offsetMinutes = offset === 'Z' ? 0 : Number(offset.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59
    || offsetHours > 23 || offsetMinutes > 59) throw invalid(field, 'Use a valid ISO 8601 date-time');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw invalid(field, 'Use a valid ISO 8601 date-time');
  return parsed;
}

export function safeInternalHref(href) {
  if (typeof href !== 'string' || href.length < 1 || href.length > 500 || !href.startsWith('/')
    || href.startsWith('//') || href.includes('\\') || hasControlCharacters(href)) {
    throw invalid('href', 'href phải là đường dẫn nội bộ');
  }
  let parsed;
  try { parsed = new URL(href, 'https://tro-lam.invalid'); } catch { throw invalid('href'); }
  if (parsed.origin !== 'https://tro-lam.invalid') throw invalid('href', 'href phải là đường dẫn nội bộ');
  if (!INTERNAL_NOTIFICATION_PREFIXES.some((prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`))) {
    throw invalid('href', 'href phải trỏ tới một khu vực được hỗ trợ');
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function validateNotificationText(value, field, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw invalid(`notification.${field}`);
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)
    || /(?:\+?\d[\s().-]*){8,}/.test(value)
    || /\b(?:bearer\s+)[a-z0-9._~+/-]+=*/i.test(value)) {
    throw invalid(`notification.${field}`, 'Không đưa email, phone hoặc credential vào thông báo');
  }
  return value.trim();
}

export function validateNotificationDelivery(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('notification');
  const category = ['order', 'support', 'account', 'system'];
  if (!category.includes(value.category)) throw invalid('notification.category');
  if (!Array.isArray(value.recipients) || value.recipients.length < 1 || value.recipients.length > 100) throw invalid('notification.recipients');
  if (value.recipients.some((id) => typeof id !== 'string' || !id.trim() || id.length > 80)) throw invalid('notification.recipients');
  if (new Set(value.recipients).size !== value.recipients.length) throw invalid('notification.recipients', 'Danh sách recipient bị trùng');
  return {
    recipients: value.recipients.map((id) => id.trim()),
    category: value.category,
    title: validateNotificationText(value.title, 'title', 160),
    body: validateNotificationText(value.body, 'body', 500),
    href: safeInternalHref(value.href),
  };
}

export function validateOutboxEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw invalid('event');
  const required = ['eventKey', 'type', 'aggregateType', 'aggregateId', 'aggregateVersion', 'payload'];
  for (const key of required) if (event[key] === undefined || event[key] === null) throw invalid(key);
  if (typeof event.eventKey !== 'string' || !event.eventKey.trim() || event.eventKey.length > 200) throw invalid('eventKey');
  if (typeof event.type !== 'string' || !event.type.trim() || event.type.length > 120) throw invalid('type');
  if (typeof event.aggregateType !== 'string' || !event.aggregateType.trim() || event.aggregateType.length > 80) throw invalid('aggregateType');
  if (typeof event.aggregateId !== 'string' || !event.aggregateId.trim() || event.aggregateId.length > 120) throw invalid('aggregateId');
  if (!Number.isSafeInteger(event.aggregateVersion) || event.aggregateVersion < 0) throw invalid('aggregateVersion');
  if (typeof event.payload !== 'object' || Array.isArray(event.payload)) throw invalid('payload');
  let payload = event.payload;
  if (event.type === 'operations.delivery') {
    if (!Array.isArray(event.payload.deliveries) || event.payload.deliveries.length < 1 || event.payload.deliveries.length > 100) throw invalid('payload.deliveries');
    payload = { deliveries: event.payload.deliveries.map((delivery, index) => {
      if (!delivery || typeof delivery !== 'object' || Array.isArray(delivery)) throw invalid(`payload.deliveries[${index}]`);
      if (delivery.notification) return { notification: validateNotificationDelivery(delivery.notification) };
      const encrypted = delivery.encryptedMail;
      if (encrypted && typeof encrypted === 'object' && encrypted.algorithm === 'aes-256-gcm' && encrypted.version === 1
        && typeof encrypted.fingerprint === 'string' && /^[a-f\d]{64}$/i.test(encrypted.fingerprint)
        && typeof encrypted.iv === 'string' && typeof encrypted.tag === 'string' && typeof encrypted.ciphertext === 'string') {
        return { encryptedMail: encrypted };
      }
      throw invalid(`payload.deliveries[${index}]`, 'Outbox chỉ nhận notification hoặc payload mail đã mã hóa');
    }) };
  }
  return {
    eventKey: event.eventKey.trim(), type: event.type.trim(), aggregateType: event.aggregateType.trim(),
    aggregateId: event.aggregateId.trim(), aggregateVersion: event.aggregateVersion, payload,
  };
}
