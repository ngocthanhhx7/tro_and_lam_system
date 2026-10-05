import { badRequest } from '../../utils/serviceError.js';

export const PRODUCT_LINES = Object.freeze(['lifestyle', 'diplomacy']);
export const PRODUCT_STATUSES = Object.freeze(['draft', 'published', 'archived']);
export const SALE_MODES = Object.freeze(['buy', 'quote', 'both']);
export const PRODUCT_SORTS = Object.freeze(['name', 'price_asc', 'price_desc', 'newest']);
export const PRODUCT_WRITE_FIELDS = Object.freeze([
  'name', 'slug', 'sku', 'line', 'categoryId', 'description', 'material',
  'dimensions', 'careInstructions', 'images', 'saleMode', 'priceVnd', 'storyId', 'status', 'featured',
]);
export const PRODUCT_PATCH_FIELDS = Object.freeze([...PRODUCT_WRITE_FIELDS, 'expectedVersion']);
export const CATEGORY_WRITE_FIELDS = Object.freeze([
  'slug', 'name', 'description', 'parentId', 'sortOrder', 'status', 'expectedVersion',
]);

function issue(field, code, message) {
  return { field, code, message };
}

function fail(details) {
  throw badRequest('VALIDATION_ERROR', 'Kiểm tra lại thông tin danh mục', details);
}

function requireRecord(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail([issue(name, 'REQUIRED', 'Thông tin không hợp lệ')]);
  }
}

function checkUnknownFields(value, allowed) {
  const unknown = Object.keys(value).filter((field) => !allowed.includes(field));
  if (unknown.length) fail(unknown.map((field) => issue(field, 'UNKNOWN_FIELD', 'Trường này không được hỗ trợ')));
}

function checkString(value, field, { required = false, max = Infinity } = {}) {
  if (value === undefined && !required) return;
  if (typeof value !== 'string' || (required && value.trim().length === 0) || value.length > max) {
    fail([issue(field, 'INVALID_STRING', 'Nhập nội dung hợp lệ')]);
  }
}

function checkSlug(value, field) {
  if (value !== undefined && (typeof value !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))) {
    fail([issue(field, 'INVALID_SLUG', 'Dùng chữ thường, số và dấu gạch ngang giữa các từ')]);
  }
}

function checkEnum(value, field, choices, { required = false } = {}) {
  if (value === undefined && !required) return;
  if (typeof value !== 'string' || !choices.includes(value)) {
    fail([issue(field, 'INVALID_ENUM', 'Chọn một giá trị được hỗ trợ')]);
  }
}

export function validateProductQuery(query = {}) {
  const filters = {};
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 120)) {
    fail([issue('q', 'INVALID_QUERY', 'Từ khóa tối đa 120 ký tự')]);
  }
  filters.q = q;
  checkEnum(query.line, 'line', PRODUCT_LINES);
  if (query.line) filters.line = query.line;
  checkEnum(query.saleMode, 'saleMode', SALE_MODES);
  if (query.saleMode) filters.saleMode = query.saleMode;
  if (query.available !== undefined) {
    const value = query.available === 'true' ? true : query.available === 'false' ? false : query.available;
    if (typeof value !== 'boolean') fail([issue('available', 'INVALID_BOOLEAN', 'Availability phải là true hoặc false')]);
    filters.available = value;
    filters.buyableOnly = true;
  }
  checkString(query.category, 'category', { max: 80 });
  if (query.category) filters.category = query.category.trim();
  for (const field of ['priceMin', 'priceMax']) {
    if (query[field] === undefined) continue;
    const raw = Array.isArray(query[field]) ? undefined : query[field];
    const value = raw === undefined || raw === '' ? NaN : Number(raw);
    if (!Number.isSafeInteger(value) || value < 0) {
      fail([issue(field, 'INVALID_PRICE', 'Giá phải là số nguyên VND không âm')]);
    }
    filters[field] = value;
  }
  if (filters.priceMin !== undefined && filters.priceMax !== undefined && filters.priceMin > filters.priceMax) {
    fail([issue('priceMin', 'INVALID_RANGE', 'Giá tối thiểu không được lớn hơn giá tối đa')]);
  }
  checkEnum(query.sort, 'sort', PRODUCT_SORTS);
  filters.sort = query.sort || 'newest';
  filters.page = parsePage(query.page, 1, 'page');
  filters.limit = parsePage(query.limit, 20, 'limit', 100);
  return filters;
}

function parsePage(value, fallback, field, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    fail([issue(field, 'INVALID_PAGINATION', `Giá trị ${field} không hợp lệ`)]);
  }
  return parsed;
}

export function validateProductWrite(value, { partial = false } = {}) {
  requireRecord(value, 'product');
  checkUnknownFields(value, partial ? PRODUCT_PATCH_FIELDS : PRODUCT_WRITE_FIELDS);
  const details = [];
  for (const [field, max] of [['name', 160], ['slug', 180], ['sku', 80], ['description', 12000], ['material', 500], ['dimensions', 300], ['careInstructions', 3000]]) {
    const required = !partial && ['name', 'slug', 'sku', 'description', 'material'].includes(field);
    try { checkString(value[field], field, { required, max }); } catch (error) { details.push(...(error.details || [])); }
  }
  checkSlug(value.slug, 'slug');
  for (const [field, values] of [['line', PRODUCT_LINES], ['saleMode', SALE_MODES], ['status', PRODUCT_STATUSES]]) {
    try { checkEnum(value[field], field, values, { required: !partial }); } catch (error) { details.push(...(error.details || [])); }
  }
  for (const [field, required] of [['categoryId', !partial], ['storyId', false]]) {
    if (field === 'storyId' && value[field] === null) continue;
    try { checkString(value[field], field, { required, max: 64 }); } catch (error) { details.push(...(error.details || [])); }
  }
  if (value.featured !== undefined && typeof value.featured !== 'boolean') details.push(issue('featured', 'INVALID_BOOLEAN', 'Giá trị không hợp lệ'));
  if (value.priceVnd !== undefined && (!Number.isSafeInteger(value.priceVnd) || value.priceVnd < 1)) {
    details.push(issue('priceVnd', 'INVALID_PRICE', 'Giá phải là số VND nguyên lớn hơn 0'));
  }
  if (value.images !== undefined) {
    if (!Array.isArray(value.images) || value.images.length > 12) {
      details.push(issue('images', 'INVALID_MEDIA', 'Tối đa 12 ảnh'));
    } else {
      value.images.forEach((image, index) => {
        if (!image || typeof image !== 'object' || Array.isArray(image)) {
          details.push(issue(`images.${index}`, 'INVALID_MEDIA', 'Ảnh không hợp lệ'));
          return;
        }
        const keys = Object.keys(image);
        if (keys.some((key) => !['url', 'alt', 'sortOrder'].includes(key))) details.push(issue(`images.${index}`, 'UNKNOWN_FIELD', 'Ảnh có trường không được hỗ trợ'));
        if (typeof image.url !== 'string' || !isSafePublicImageUrl(image.url)) details.push(issue(`images.${index}.url`, 'INVALID_URL', 'Ảnh cần URL HTTPS hoặc URL trong website'));
        if (typeof image.alt !== 'string' || !image.alt.trim() || image.alt.length > 250) details.push(issue(`images.${index}.alt`, 'INVALID_ALT', 'Mô tả ảnh là bắt buộc'));
        if (!Number.isSafeInteger(image.sortOrder) || image.sortOrder < 0) details.push(issue(`images.${index}.sortOrder`, 'INVALID_ORDER', 'Thứ tự ảnh không hợp lệ'));
      });
    }
  }
  const saleMode = value.saleMode;
  if (['buy', 'both'].includes(saleMode)
    && (!Number.isSafeInteger(value.priceVnd) || value.priceVnd < 1)
    && (!partial || value.priceVnd !== undefined)) {
    details.push(issue('priceVnd', 'PRICE_REQUIRED', 'Sản phẩm bán trực tiếp cần giá VND lớn hơn 0'));
  }
  if (partial) {
    if (!Number.isSafeInteger(value.expectedVersion) || value.expectedVersion < 0) {
      details.push(issue('expectedVersion', 'REQUIRED', 'Cần tải lại phiên bản hiện tại'));
    }
    if (Object.keys(value).every((field) => field === 'expectedVersion')) {
      details.push(issue('product', 'EMPTY_UPDATE', 'Cần có ít nhất một thay đổi'));
    }
  }
  if (details.length) fail(details);
  const data = Object.fromEntries(Object.entries(value).filter(([key]) => PRODUCT_WRITE_FIELDS.includes(key)));
  if (data.storyId === '') data.storyId = null;
  return data;
}

export function validateCategoryWrite(value, { partial = false } = {}) {
  requireRecord(value, 'category');
  checkUnknownFields(value, CATEGORY_WRITE_FIELDS);
  const details = [];
  for (const [field, max, required] of [['slug', 180, !partial], ['name', 120, !partial], ['description', 5000, false], ['parentId', 64, false]]) {
    try { checkString(value[field], field, { max, required }); } catch (error) { details.push(...(error.details || [])); }
  }
  checkSlug(value.slug, 'slug');
  try { checkEnum(value.status, 'status', PRODUCT_STATUSES); } catch (error) { details.push(...(error.details || [])); }
  if (value.sortOrder !== undefined && (!Number.isSafeInteger(value.sortOrder) || value.sortOrder < 0)) details.push(issue('sortOrder', 'INVALID_ORDER', 'Thứ tự không hợp lệ'));
  if (partial && (!Number.isSafeInteger(value.expectedVersion) || value.expectedVersion < 0)) details.push(issue('expectedVersion', 'REQUIRED', 'Cần tải lại phiên bản hiện tại'));
  if (details.length) fail(details);
  return { ...value };
}

export function validateExpectedVersion(value) {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(number) || number < 0) fail([issue('expectedVersion', 'REQUIRED', 'Phiên bản cần được cung cấp')]);
  return number;
}

export function validateAdminProductQuery(query = {}) {
  const filters = {};
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 120)) {
    fail([issue('q', 'INVALID_QUERY', 'Từ khóa tối đa 120 ký tự')]);
  }
  if (query.q?.trim()) filters.q = query.q.trim();
  checkEnum(query.status, 'status', PRODUCT_STATUSES);
  if (query.status) filters.status = query.status;
  checkEnum(query.line, 'line', PRODUCT_LINES);
  if (query.line) filters.line = query.line;
  filters.page = parsePage(query.page, 1, 'page');
  filters.limit = parsePage(query.limit, 20, 'limit', 100);
  return filters;
}

export function validateImageUploadAlt(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 250) {
    fail([issue('alt', 'INVALID_ALT', 'Nhập mô tả ảnh dài tối đa 250 ký tự')]);
  }
  return value.trim();
}

export function isSafePublicImageUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.startsWith('//') || value.includes('\\')) return false;
  if (value.startsWith('/')) return !value.split('/').some((part) => part === '..');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}
