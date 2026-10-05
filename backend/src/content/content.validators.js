import { badRequest } from '../utils/serviceError.js';

const CONTENT_STATUSES = new Set(['draft', 'published', 'archived']);
const LOCALES = new Set(['vi', 'en']);
const BLOCK_TYPES = new Set(['paragraph', 'heading', 'quote', 'list', 'image', 'link']);
const TAG_PATTERN = /<\/?[a-z][^>]*>/gi;
const DANGEROUS_ELEMENT_PATTERN = /<(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function invalid(field, message) {
  return badRequest('VALIDATION_ERROR', 'Một số trường nội dung chưa hợp lệ', [{ field, code: 'INVALID', message }]);
}

export function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  const withoutMarkup = value.replace(DANGEROUS_ELEMENT_PATTERN, '').replace(TAG_PATTERN, '');
  let clean = '';
  for (const character of withoutMarkup) {
    const code = character.charCodeAt(0);
    if (!(code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127)) clean += character;
  }
  return clean.trim();
}

function plainString(value, field, { min = 0, max = 5000, required = false } = {}) {
  if (typeof value !== 'string') throw invalid(field, 'Giá trị phải là văn bản');
  const clean = sanitizeText(value);
  if ((required && clean.length === 0) || clean.length < min || clean.length > max) {
    throw invalid(field, `Độ dài văn bản phải từ ${min || 1} đến ${max} ký tự`);
  }
  return clean;
}

function safeMediaUrl(value, field) {
  const url = plainString(value, field, { min: 1, max: 2048, required: true });
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) return url;
  let parsed;
  try { parsed = new URL(url); } catch { throw invalid(field, 'Chỉ chấp nhận đường dẫn tương đối hoặc HTTPS'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw invalid(field, 'Chỉ chấp nhận đường dẫn tương đối hoặc HTTPS');
  }
  return parsed.toString();
}

function safeLink(value, field) {
  const url = plainString(value, field, { min: 1, max: 2048, required: true });
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) return url;
  let parsed;
  try { parsed = new URL(url); } catch { throw invalid(field, 'Liên kết không hợp lệ'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw invalid(field, 'Liên kết phải là HTTPS hoặc đường dẫn nội bộ');
  return parsed.toString();
}

function exactObject(value, allowed, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(field, 'Phải là một đối tượng');
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw invalid(`${field}.${key}`, 'Trường này không được phép');
}

function parseBlock(block, field) {
  if (!block || typeof block !== 'object' || Array.isArray(block)) throw invalid(field, 'Khối nội dung không hợp lệ');
  if (!BLOCK_TYPES.has(block.type)) throw invalid(`${field}.type`, 'Loại khối nội dung không được hỗ trợ');
  const shapes = {
    paragraph: ['type', 'text'], heading: ['type', 'text'], quote: ['type', 'text'],
    list: ['type', 'items'], image: ['type', 'url', 'alt', 'caption'], link: ['type', 'text', 'url'],
  };
  exactObject(block, new Set(shapes[block.type]), field);
  if (block.type === 'list') {
    if (!Array.isArray(block.items) || block.items.length < 1 || block.items.length > 50) throw invalid(`${field}.items`, 'Danh sách cần từ 1 đến 50 mục');
    return { type: 'list', items: block.items.map((item, index) => plainString(item, `${field}.items.${index}`, { min: 1, max: 1000, required: true })) };
  }
  if (block.type === 'image') {
    return {
      type: 'image', url: safeMediaUrl(block.url, `${field}.url`),
      alt: plainString(block.alt, `${field}.alt`, { min: 1, max: 300, required: true }),
      ...(block.caption === undefined ? {} : { caption: plainString(block.caption, `${field}.caption`, { max: 500 }) }),
    };
  }
  if (block.type === 'link') {
    return {
      type: 'link', text: plainString(block.text, `${field}.text`, { min: 1, max: 300, required: true }),
      url: safeLink(block.url, `${field}.url`),
    };
  }
  return { type: block.type, text: plainString(block.text, `${field}.text`, { min: 1, max: 5000, required: true }) };
}

function parseLocale(value) {
  if (!LOCALES.has(value)) throw invalid('locale', 'Ngôn ngữ phải là vi hoặc en');
  return value;
}

function parseStatus(value) {
  if (!CONTENT_STATUSES.has(value)) throw invalid('status', 'Trạng thái không hợp lệ');
  return value;
}

function parseSlug(value) {
  const slug = plainString(value, 'slug', { min: 1, max: 180, required: true }).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw invalid('slug', 'Slug chỉ gồm chữ thường không dấu, số và dấu gạch nối');
  return slug;
}

function parseProductIds(value) {
  if (!Array.isArray(value) || value.length > 100) throw invalid('productIds', 'Tối đa 100 sản phẩm được liên kết');
  const ids = value.map((id, index) => {
    if (typeof id !== 'string' || !OBJECT_ID_PATTERN.test(id)) throw invalid(`productIds.${index}`, 'ID sản phẩm không hợp lệ');
    return id;
  });
  if (new Set(ids).size !== ids.length) throw invalid('productIds', 'ID sản phẩm không được lặp lại');
  return ids;
}

function parseMedia(value) {
  if (!Array.isArray(value) || value.length > 100) throw invalid('media', 'Tối đa 100 mục media');
  return value.map((item, index) => {
    const field = `media.${index}`;
    exactObject(item, new Set(['url', 'alt', 'caption']), field);
    return {
      url: safeMediaUrl(item.url, `${field}.url`),
      alt: plainString(item.alt, `${field}.alt`, { min: 1, max: 300, required: true }),
      ...(item.caption === undefined ? {} : { caption: plainString(item.caption, `${field}.caption`, { max: 500 }) }),
    };
  });
}

function parseMotifs(value) {
  if (!Array.isArray(value) || value.length > 100) throw invalid('motifs', 'Tối đa 100 mục hoa văn');
  return value.map((item, index) => plainString(item, `motifs.${index}`, { min: 1, max: 300, required: true }));
}

function parseSections(value) {
  if (!Array.isArray(value) || value.length > 100) throw invalid('sections', 'Tối đa 100 phần nội dung');
  return value.map((section, index) => {
    const field = `sections.${index}`;
    exactObject(section, new Set(['heading', 'body']), field);
    if (!Array.isArray(section.body) || section.body.length > 100) throw invalid(`${field}.body`, 'Phần nội dung cần là một danh sách khối');
    return {
      ...(section.heading === undefined ? {} : { heading: plainString(section.heading, `${field}.heading`, { max: 300 }) }),
      body: section.body.map((block, blockIndex) => parseBlock(block, `${field}.body.${blockIndex}`)),
    };
  });
}

function parseExpectedVersion(value, required) {
  if (value === undefined && !required) return undefined;
  if (!Number.isSafeInteger(value) || value < 0) throw invalid('expectedVersion', 'Phiên bản hiện tại là bắt buộc');
  return value;
}

function requireKeys(body, required, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('body', 'Phần thân yêu cầu không hợp lệ');
  for (const key of Object.keys(body)) if (!allowed.has(key)) throw invalid(key, 'Trường này không được phép');
  for (const key of required) if (!(key in body)) throw invalid(key, 'Trường này là bắt buộc');
}

export function validateStoryWrite(body, { update = false } = {}) {
  const fields = new Set(['slug', 'title', 'locale', 'origin', 'artisan', 'motifs', 'sections', 'media', 'productIds', 'status', 'expectedVersion']);
  const required = ['slug', 'title', 'locale', 'origin', 'motifs', 'sections', 'media', 'productIds', 'status'];
  requireKeys(body, required, fields);
  return {
    slug: parseSlug(body.slug),
    title: plainString(body.title, 'title', { min: 1, max: 300, required: true }),
    locale: parseLocale(body.locale),
    origin: plainString(body.origin, 'origin', { min: 0, max: 2000, required: body.status === 'published' }),
    ...(body.artisan === undefined ? {} : { artisan: plainString(body.artisan, 'artisan', { max: 300 }) }),
    motifs: parseMotifs(body.motifs),
    sections: parseSections(body.sections),
    media: parseMedia(body.media),
    productIds: parseProductIds(body.productIds),
    status: parseStatus(body.status),
    ...(parseExpectedVersion(body.expectedVersion, update) === undefined ? {} : { expectedVersion: body.expectedVersion }),
  };
}

export function validatePageWrite(body, { update = false } = {}) {
  const fields = new Set(['slug', 'title', 'locale', 'blocks', 'status', 'expectedVersion']);
  requireKeys(body, ['slug', 'title', 'locale', 'blocks', 'status'], fields);
  if (!Array.isArray(body.blocks) || body.blocks.length > 200) throw invalid('blocks', 'Tối đa 200 khối nội dung');
  return {
    slug: parseSlug(body.slug),
    title: plainString(body.title, 'title', { min: 1, max: 300, required: true }),
    locale: parseLocale(body.locale),
    blocks: body.blocks.map((block, index) => parseBlock(block, `blocks.${index}`)),
    status: parseStatus(body.status),
    ...(parseExpectedVersion(body.expectedVersion, update) === undefined ? {} : { expectedVersion: body.expectedVersion }),
  };
}

export function validateNfcTagCreate(body) {
  const fields = new Set(['storyId', 'productId']);
  requireKeys(body, ['storyId'], fields);
  if (typeof body.storyId !== 'string' || !OBJECT_ID_PATTERN.test(body.storyId)) throw invalid('storyId', 'ID câu chuyện không hợp lệ');
  if (body.productId !== undefined && (typeof body.productId !== 'string' || !OBJECT_ID_PATTERN.test(body.productId))) throw invalid('productId', 'ID sản phẩm không hợp lệ');
  return { storyId: body.storyId, ...(body.productId === undefined ? {} : { productId: body.productId }) };
}

export function validateReasonVersion(body) {
  requireKeys(body, ['reason', 'expectedVersion'], new Set(['reason', 'expectedVersion']));
  return {
    reason: plainString(body.reason, 'reason', { min: 1, max: 1000, required: true }),
    expectedVersion: parseExpectedVersion(body.expectedVersion, true),
  };
}

export function validateListQuery(query) {
  const status = query.status === undefined ? undefined : parseStatus(query.status);
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1) throw invalid('page', 'Trang phải là số nguyên dương');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw invalid('limit', 'Số dòng phải từ 1 đến 100');
  return { ...(status ? { status } : {}), page, limit };
}

export function validatePublicId(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{32}$/.test(value)) throw invalid('publicId', 'Mã NFC không hợp lệ');
  return value;
}

export function validateDocumentId(value, field = 'id') {
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) throw invalid(field, 'ID nội dung không hợp lệ');
  return value;
}

export function validateLocaleQuery(value) {
  return value === undefined ? 'vi' : parseLocale(value);
}

export function validateExpectedVersionQuery(value) {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 0) throw invalid('expectedVersion', 'Phiên bản hiện tại là bắt buộc');
  return version;
}

export function normalizeContentDocument(document) {
  const plain = typeof document?.toObject === 'function' ? document.toObject({ depopulate: true, versionKey: false }) : document;
  if (!plain || typeof plain !== 'object') return plain;
  const result = { ...plain };
  const id = result._id ?? result.id ?? '';
  delete result._id;
  delete result.__v;
  delete result.id;
  if (Number.isSafeInteger(result.version)) return { id: String(id), ...result, version: result.version };
  return { id: String(id), ...result };
}

export const contentValidationRules = Object.freeze({ statuses: [...CONTENT_STATUSES], locales: [...LOCALES], blockTypes: [...BLOCK_TYPES] });
