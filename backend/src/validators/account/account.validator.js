import { badRequest } from '../../utils/serviceError.js';

const ADDRESS_FIELDS = new Set([
  'label', 'recipientName', 'phone', 'line1', 'line2', 'ward', 'province',
  'countryCode', 'postalCode', 'formattedAddress', 'location', 'isDefault', 'expectedVersion',
]);
const TEXT_LIMITS = Object.freeze({
  label: 80, recipientName: 100, phone: 30, line1: 200, line2: 200,
  ward: 100, province: 100, postalCode: 20, formattedAddress: 500,
});
const REQUIRED_ADDRESS = ['recipientName', 'phone', 'line1', 'countryCode', 'formattedAddress'];
const fail = (field, message) => badRequest('VALIDATION_ERROR', 'Vui lòng kiểm tra lại thông tin', [{ field, code: 'INVALID_VALUE', message }]);

function requirePlainObject(input, field = 'body') {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail(field, 'Dữ liệu không hợp lệ');
}

function validateLocation(input) {
  if (input === undefined) return undefined;
  requirePlainObject(input, 'location');
  const allowed = new Set(['lat', 'lng', 'accuracyMeters', 'capturedAt', 'source']);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw fail('location', 'Vị trí chứa trường không hỗ trợ');
  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) throw fail('location.lat', 'Vĩ độ không hợp lệ');
  if (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) throw fail('location.lng', 'Kinh độ không hợp lệ');
  if (input.accuracyMeters !== undefined && (!Number.isFinite(input.accuracyMeters) || input.accuracyMeters < 0)) throw fail('location.accuracyMeters', 'Độ chính xác không hợp lệ');
  const capturedAt = new Date(input.capturedAt);
  if (!input.capturedAt || Number.isNaN(capturedAt.getTime())) throw fail('location.capturedAt', 'Thời điểm vị trí không hợp lệ');
  if (typeof input.source !== 'string' || !input.source.trim() || input.source.length > 80) throw fail('location.source', 'Nguồn vị trí không hợp lệ');
  return {
    lat: input.lat,
    lng: input.lng,
    ...(input.accuracyMeters === undefined ? {} : { accuracyMeters: input.accuracyMeters }),
    capturedAt: capturedAt.toISOString(),
    source: input.source.trim(),
  };
}

export function validateAddressWrite(input, { partial = false } = {}) {
  requirePlainObject(input);
  if (Object.keys(input).some((key) => !ADDRESS_FIELDS.has(key))) throw fail('body', 'Dữ liệu chứa trường không hỗ trợ');
  if (partial && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0)) throw fail('expectedVersion', 'Phiên bản địa chỉ không hợp lệ');
  if (!partial && REQUIRED_ADDRESS.some((key) => typeof input[key] !== 'string' || !input[key].trim())) {
    const missing = REQUIRED_ADDRESS.find((key) => typeof input[key] !== 'string' || !input[key].trim());
    throw fail(missing, 'Trường này bắt buộc nhập');
  }
  if (partial && Object.keys(input).every((key) => key === 'expectedVersion')) throw fail('body', 'Cần có ít nhất một trường cần cập nhật');

  const result = {};
  for (const [field, maxLength] of Object.entries(TEXT_LIMITS)) {
    if (input[field] === undefined) continue;
    if (typeof input[field] !== 'string') throw fail(field, 'Giá trị phải là văn bản');
    const value = input[field].trim();
    if (value.length > maxLength || (!partial && REQUIRED_ADDRESS.includes(field) && !value)) throw fail(field, 'Độ dài văn bản không hợp lệ');
    result[field] = value || undefined;
  }
  if (input.countryCode !== undefined) {
    if (input.countryCode !== 'VN') throw fail('countryCode', 'Hiện chỉ hỗ trợ địa chỉ tại Việt Nam');
    result.countryCode = 'VN';
  }
  if (!partial) result.countryCode ||= 'VN';
  if (input.location !== undefined) result.location = validateLocation(input.location);
  if (input.isDefault !== undefined) {
    if (typeof input.isDefault !== 'boolean') throw fail('isDefault', 'Giá trị mặc định không hợp lệ');
    result.isDefault = input.isDefault;
  }
  if (partial) result.expectedVersion = input.expectedVersion;
  return result;
}

export function validateAddressId(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) throw fail('id', 'Mã địa chỉ không hợp lệ');
  return value;
}

export function validateExpectedVersion(value, field = 'expectedVersion') {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw fail(field, 'Phiên bản dữ liệu không hợp lệ');
  return parsed;
}

export function validateCartItemWrite(input) {
  requirePlainObject(input);
  if (Object.keys(input).some((key) => !['quantity', 'expectedVersion'].includes(key))) throw fail('body', 'Dữ liệu chứa trường không hỗ trợ');
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 99) throw fail('quantity', 'Số lượng phải từ 1 đến 99');
  return { quantity: input.quantity, expectedVersion: validateExpectedVersion(input.expectedVersion) };
}

export function validateCartMerge(input) {
  requirePlainObject(input);
  if (Object.keys(input).some((key) => key !== 'expectedVersion')) throw fail('body', 'Dữ liệu chứa trường không hỗ trợ');
  return { expectedVersion: validateExpectedVersion(input.expectedVersion) };
}

export function validateReverseLocation(input) {
  requirePlainObject(input);
  if (Object.keys(input).some((key) => !['lat', 'lng'].includes(key))) throw fail('body', 'Dữ liệu chứa trường không hỗ trợ');
  if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) throw fail('lat', 'Vĩ độ không hợp lệ');
  if (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) throw fail('lng', 'Kinh độ không hợp lệ');
  return { lat: input.lat, lng: input.lng };
}
