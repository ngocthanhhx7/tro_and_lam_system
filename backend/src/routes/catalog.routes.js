import { Router } from 'express';
import { ServiceError, forbidden } from '../utils/serviceError.js';
import { sendCreated, sendNoContent, sendPaginated, sendSuccess } from '../utils/apiResponse.js';
import { validateImageUploadAlt } from '../services/catalog/catalog-validation.js';

const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_MEDIA_BYTES + 64 * 1024;
const DEFAULT_ADMIN_DENY = (_req, _res, next) => next(forbidden());

function mediaError(message, code = 'UNSUPPORTED_MEDIA_TYPE') {
  return new ServiceError(code === 'PAYLOAD_TOO_LARGE' ? 413 : 415, code, message);
}

function multipartBoundary(contentType = '') {
  if (!/^multipart\/form-data(?:\s*;|$)/i.test(contentType)) {
    throw mediaError('Tải ảnh lên bằng biểu mẫu multipart/form-data');
  }
  const boundary = /(?:^|;)\s*boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const value = boundary?.[1] || boundary?.[2];
  if (!value || value.length > 70 || /[\r\n]/.test(value)) throw mediaError('Biểu mẫu tải ảnh không hợp lệ');
  return value;
}

function parseDisposition(header) {
  const match = /^form-data\s*;\s*name="([^"]+)"(?:\s*;\s*filename="([^"]*)")?/i.exec(header || '');
  if (!match) throw mediaError('Biểu mẫu ảnh không hợp lệ');
  return { name: match[1], filename: match[2] };
}

function sniffImage(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function parseCatalogMediaUpload(req, _res, next) {
  try {
    const boundary = multipartBoundary(req.headers['content-type']);
    const chunks = [];
    let byteCount = 0;
    for await (const chunk of req) {
      byteCount += chunk.length;
      if (byteCount > MAX_MULTIPART_BYTES) throw new ServiceError(413, 'PAYLOAD_TOO_LARGE', 'Tệp ảnh vượt giới hạn 5 MB');
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks, byteCount);
    const delimiter = Buffer.from(`--${boundary}`);
    let cursor = 0;
    const fields = new Map();
    let partCount = 0;
    while (cursor < body.length) {
      let start = body.indexOf(delimiter, cursor);
      if (start < 0) break;
      start += delimiter.length;
      if (body.subarray(start, start + 2).equals(Buffer.from('--'))) break;
      if (!body.subarray(start, start + 2).equals(Buffer.from('\r\n'))) throw mediaError('Biểu mẫu ảnh không hợp lệ');
      const headerStart = start + 2;
      const separator = body.indexOf(Buffer.from('\r\n\r\n'), headerStart);
      if (separator < 0) throw mediaError('Biểu mẫu ảnh không hợp lệ');
      const headerText = body.toString('latin1', headerStart, separator);
      const headers = new Map(headerText.split('\r\n').map((line) => {
        const colon = line.indexOf(':');
        return [line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()];
      }));
      const disposition = parseDisposition(headers.get('content-disposition'));
      const contentStart = separator + 4;
      const contentEnd = body.indexOf(Buffer.from(`\r\n--${boundary}`), contentStart);
      if (contentEnd < 0) throw mediaError('Biểu mẫu ảnh không hợp lệ');
      if (fields.has(disposition.name)) throw mediaError('Biểu mẫu ảnh lặp trường');
      partCount += 1;
      if (partCount > 2 || !['file', 'alt'].includes(disposition.name)) throw mediaError('Biểu mẫu có trường không được hỗ trợ');
      const value = body.subarray(contentStart, contentEnd);
      if (disposition.name === 'file') {
        if (!disposition.filename) throw mediaError('Chọn một tệp ảnh');
        if (value.length > MAX_MEDIA_BYTES) throw new ServiceError(413, 'PAYLOAD_TOO_LARGE', 'Tệp ảnh vượt giới hạn 5 MB');
        if (!value.length) throw mediaError('Chọn một tệp ảnh có nội dung');
        const mimeType = sniffImage(value);
        if (!mimeType || (headers.get('content-type') && headers.get('content-type') !== mimeType)) {
          throw mediaError('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP có nội dung hợp lệ');
        }
        fields.set('file', {
          buffer: Buffer.from(value),
          bytes: value.length,
          mimeType,
        });
      } else {
        fields.set('alt', value.toString('utf8'));
      }
      cursor = contentEnd + 2;
    }
    if (!fields.has('file')) throw mediaError('Chọn một tệp ảnh');
    req.catalogMedia = {
      file: fields.get('file'),
      alt: validateImageUploadAlt(fields.get('alt')),
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function sendMediaUnavailable(error, req, res, next) {
  if (error?.code !== 'MEDIA_UNAVAILABLE' || res.headersSent) return next(error);
  return res.status(503).json({
    error: {
      code: 'MEDIA_UNAVAILABLE',
      message: error.message || 'Kho lưu trữ ảnh chưa sẵn sàng',
      details: [{ field: 'file', code: 'DRAFT_ONLY', message: 'Ảnh chưa được tải lên hoặc công bố' }],
    },
    meta: { requestId: res.locals.requestId },
  });
}

export function createCatalogRouter({
  service,
  requireAdmin = DEFAULT_ADMIN_DENY,
  actorFromRequest = (req) => req.actor,
  sessionFromRequest = () => undefined,
  mediaParser = parseCatalogMediaUpload,
} = {}) {
  if (!service) throw new TypeError('Thiếu catalog service');
  if (typeof requireAdmin !== 'function') throw new TypeError('requireAdmin phải là Express middleware');
  const router = Router();
  const admin = requireAdmin;

  router.get('/products', async (req, res) => {
    const result = await service.listPublishedProducts(req.query, { session: sessionFromRequest(req) });
    return sendPaginated(res, result.items, result.pagination);
  });
  router.get('/products/:slug', async (req, res) => {
    const product = await service.getPublishedProductBySlug(req.params.slug, { session: sessionFromRequest(req) });
    return sendSuccess(res, product);
  });
  router.get('/categories', async (req, res) => sendSuccess(res, await service.listPublishedCategories({ session: sessionFromRequest(req) })));

  router.get('/admin/products', admin, async (req, res) => {
    const result = await service.listAdminProducts(req.query, { session: sessionFromRequest(req) });
    return sendPaginated(res, result.items, result.pagination);
  });
  router.post('/admin/products', admin, async (req, res) => {
    const product = await service.createProduct(req.body, {
      actor: actorFromRequest(req), session: sessionFromRequest(req),
    });
    return sendCreated(res, product);
  });
  router.get('/admin/products/:id', admin, async (req, res) => sendSuccess(res, await service.getAdminProduct(req.params.id, {
    actor: actorFromRequest(req), session: sessionFromRequest(req),
  })));
  router.patch('/admin/products/:id', admin, async (req, res) => sendSuccess(res, await service.updateProduct(req.params.id, req.body, {
    actor: actorFromRequest(req), session: sessionFromRequest(req),
  })));
  router.delete('/admin/products/:id', admin, async (req, res) => {
    await service.archiveProduct(req.params.id, req.query.expectedVersion, { session: sessionFromRequest(req) });
    return sendNoContent(res);
  });

  router.get('/admin/categories', admin, async (req, res) => sendSuccess(res, await service.listAdminCategories({ session: sessionFromRequest(req) })));
  router.post('/admin/categories', admin, async (req, res) => sendCreated(res, await service.createCategory(req.body, {
    actor: actorFromRequest(req), session: sessionFromRequest(req),
  })));
  router.patch('/admin/categories/:id', admin, async (req, res) => sendSuccess(res, await service.updateCategory(req.params.id, req.body, {
    actor: actorFromRequest(req), session: sessionFromRequest(req),
  })));
  router.delete('/admin/categories/:id', admin, async (req, res) => {
    await service.archiveCategory(req.params.id, req.query.expectedVersion, { session: sessionFromRequest(req) });
    return sendNoContent(res);
  });

  router.post('/admin/media', admin, mediaParser, async (req, res) => sendCreated(res, await service.createMediaAsset(req.catalogMedia, {
    actor: actorFromRequest(req), session: sessionFromRequest(req),
  })));
  router.use(sendMediaUnavailable);
  return router;
}

export const catalogRoutePrefix = '';
