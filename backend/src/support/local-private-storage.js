import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ServiceError } from '../utils/serviceError.js';

const MAX_BYTES = 5 * 1024 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const STORAGE_KEY = /^support\/[0-9a-f-]{36}$/u;
const TOKEN_BASE = '/api/v1/attachments/private';

function error(status, code, message) {
  return new ServiceError(status, code, message);
}

function mimeFromBytes(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function createLocalPrivateSupportStorage({ storageDir, secret, now = () => Date.now() } = {}) {
  if (typeof storageDir !== 'string' || !storageDir.trim()) throw new TypeError('A private support storage directory is required');
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw new TypeError('A 32-byte support storage signing secret is required');
  if (typeof now !== 'function') throw new TypeError('A support storage clock is required');
  const root = resolve(storageDir);

  function sign(payload) {
    const body = encode(payload);
    const signature = createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${signature}`;
  }

  function verify(token, operation) {
    if (typeof token !== 'string' || token.length > 2048 || !TOKEN.test(token)) throw error(404, 'NOT_FOUND', 'Không tìm thấy tệp');
    const [body, provided] = token.split('.');
    const expected = createHmac('sha256', secret).update(body).digest();
    let received;
    try { received = Buffer.from(provided, 'base64url'); } catch { throw error(404, 'NOT_FOUND', 'Không tìm thấy tệp'); }
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw error(404, 'NOT_FOUND', 'Không tìm thấy tệp');
    let payload;
    try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { throw error(404, 'NOT_FOUND', 'Không tìm thấy tệp'); }
    if (payload?.operation !== operation || !STORAGE_KEY.test(payload.storageKey)
      || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= now()) {
      throw error(payload?.expiresAt <= now() ? 410 : 404, payload?.expiresAt <= now() ? 'LINK_EXPIRED' : 'NOT_FOUND', 'Liên kết tệp không còn hợp lệ');
    }
    return payload;
  }

  function objectPath(storageKey) {
    if (typeof storageKey !== 'string' || !STORAGE_KEY.test(storageKey)) throw error(404, 'NOT_FOUND', 'Không tìm thấy tệp');
    const path = resolve(root, `${storageKey.slice('support/'.length)}.private`);
    if (!path.startsWith(`${root}/`) && !path.startsWith(`${root}\\`)) throw error(404, 'NOT_FOUND', 'Không tìm thấy tệp');
    return path;
  }

  async function read(storageKey, maxBytes = MAX_BYTES) {
    const path = objectPath(storageKey);
    const metadata = await stat(path).catch(() => null);
    if (!metadata?.isFile() || metadata.size < 1 || metadata.size > maxBytes || metadata.size > MAX_BYTES) {
      throw error(404, 'NOT_FOUND', 'Không tìm thấy tệp');
    }
    const buffer = await readFile(path);
    if (buffer.length !== metadata.size || buffer.length > maxBytes || buffer.length > MAX_BYTES) throw error(404, 'NOT_FOUND', 'Không tìm thấy tệp');
    return buffer;
  }

  return Object.freeze({
    configured: true,

    async createUpload({ storageKey, mimeType, bytes, expiresAt }) {
      if (!STORAGE_KEY.test(storageKey) || !MIME_TYPES.has(mimeType)
        || !Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_BYTES
        || !(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now()) {
        throw new TypeError('Invalid private attachment upload request');
      }
      const token = sign({ operation: 'upload', storageKey, mimeType, bytes, expiresAt: expiresAt.getTime() });
      return {
        uploadUrl: `${TOKEN_BASE}/uploads/${token}`,
        headers: { 'Content-Type': mimeType },
      };
    },

    async acceptUpload(token, buffer, contentType) {
      const payload = verify(token, 'upload');
      if (!Buffer.isBuffer(buffer) || !MIME_TYPES.has(contentType)
        || contentType !== payload.mimeType || buffer.length !== payload.bytes || buffer.length > MAX_BYTES) {
        throw error(422, 'VALIDATION_ERROR', 'Nội dung tệp không khớp kiểu hoặc kích thước khai báo');
      }
      const path = objectPath(payload.storageKey);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      const file = await open(path, 'wx', 0o600).catch((cause) => {
        if (cause?.code === 'EEXIST') throw error(409, 'VERSION_CONFLICT', 'Liên kết tải này đã được sử dụng');
        throw cause;
      });
      try { await file.writeFile(buffer); }
      catch (cause) { await unlink(path).catch(() => {}); throw cause; }
      finally { await file.close(); }
      return { bytes: buffer.length, mimeType: contentType };
    },

    async readPrivateObject(storageKey, { maxBytes = MAX_BYTES } = {}) {
      return read(storageKey, maxBytes);
    },

    async deletePrivateObject(storageKey) {
      await unlink(objectPath(storageKey)).catch((cause) => { if (cause?.code !== 'ENOENT') throw cause; });
    },

    async createDownload(storageKey, { expiresInSeconds = 60 } = {}) {
      if (!STORAGE_KEY.test(storageKey) || !Number.isSafeInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 300) {
        throw new TypeError('Invalid private attachment download request');
      }
      const token = sign({ operation: 'download', storageKey, expiresAt: now() + expiresInSeconds * 1000 });
      return `${TOKEN_BASE}/downloads/${token}`;
    },

    async readDownload(token) {
      const payload = verify(token, 'download');
      const buffer = await read(payload.storageKey);
      const mimeType = mimeFromBytes(buffer);
      if (!mimeType) throw error(404, 'NOT_FOUND', 'Không tìm thấy tệp');
      return { buffer, mimeType };
    },
  });
}
