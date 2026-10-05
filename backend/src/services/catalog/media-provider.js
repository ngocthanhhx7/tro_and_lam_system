import { createHash } from 'node:crypto';

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
