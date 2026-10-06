import { createHash, randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function createUnavailableMediaProvider() {
  return Object.freeze({
    configured: false,
    state: 'unavailable',
    async upload() {
      const error = new Error('Kho lưu trữ media chưa được cấu hình');
      error.code = 'MEDIA_UNAVAILABLE';
      throw error;
    },
    async remove() {},
  });
}

const IMAGE_EXTENSIONS = Object.freeze({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' });

/** Persistent filesystem storage for a single-machine development environment. */
export function createLocalMediaProvider({ storageDir, publicBaseUrl } = {}) {
  if (typeof storageDir !== 'string' || !storageDir.trim()) throw new TypeError('A media storage directory is required');
  if (typeof publicBaseUrl !== 'string' || !publicBaseUrl.startsWith('/') || publicBaseUrl.startsWith('//')
    || publicBaseUrl.includes('\\') || publicBaseUrl.includes('?') || publicBaseUrl.includes('#')
    || publicBaseUrl.split('/').includes('..')) {
    throw new TypeError('A safe root-relative media public base path is required');
  }
  const base = publicBaseUrl.replace(/\/$/u, '');

  return Object.freeze({
    configured: true,
    state: 'local-development',
    async upload({ buffer, mimeType }) {
      const extension = IMAGE_EXTENSIONS[mimeType];
      if (!Buffer.isBuffer(buffer) || buffer.length === 0 || !extension) throw new TypeError('Unsupported media file');
      const storageKey = `${randomUUID()}.${extension}`;
      await mkdir(storageDir, { recursive: true });
      await writeFile(join(storageDir, storageKey), buffer, { flag: 'wx', mode: 0o640 });
      return { storageKey, publicUrl: `${base}/${storageKey}` };
    },
    async remove(storageKey) {
      if (typeof storageKey !== 'string' || !/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/u.test(storageKey)) return;
      try { await unlink(join(storageDir, storageKey)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    },
  });
}

export function createDeterministicFakeMediaProvider({ publicBaseUrl = 'https://media.test/catalog' } = {}) {
  const stored = new Map();
  return Object.freeze({
    configured: true,
    state: 'test',
    stored,
    async upload({ buffer, mimeType }) {
      const digest = createHash('sha256').update(buffer).digest('hex');
      const storageKey = `${digest}.${mimeType.split('/')[1].replace('jpeg', 'jpg')}`;
      stored.set(storageKey, Buffer.from(buffer));
      return { storageKey, publicUrl: `${publicBaseUrl}/${storageKey}` };
    },
    async remove(storageKey) { stored.delete(storageKey); },
  });
}
