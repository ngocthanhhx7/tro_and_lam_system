import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { ServiceError } from '../../utils/serviceError.js';

function keyBytes(value) {
  if (Buffer.isBuffer(value) && value.length === 32) return value;
  if (typeof value === 'string') {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length === 32 && decoded.toString('base64').replace(/=+$/, '') === value.replace(/=+$/, '')) return decoded;
  }
  throw new TypeError('OUTBOX_ENCRYPTION_KEY must be a base64 encoded 32-byte key');
}

/** Protects retryable mail envelopes containing recipient PII or one-time links/codes at rest. */
export function createOutboxPayloadCipher({ key } = {}) {
  const secret = keyBytes(key);

  function encrypt(value) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', secret, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return {
      algorithm: 'aes-256-gcm',
      version: 1,
      fingerprint: createHmac('sha256', secret).update(JSON.stringify(value)).digest('hex'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  function decrypt(envelope) {
    if (!envelope || envelope.algorithm !== 'aes-256-gcm' || envelope.version !== 1) {
      throw new ServiceError(503, 'MAIL_UNAVAILABLE', 'Outbox mail payload không thể giải mã');
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(envelope.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
      return JSON.parse(plaintext);
    } catch {
      throw new ServiceError(503, 'MAIL_UNAVAILABLE', 'Outbox mail payload không thể giải mã');
    }
  }

  return Object.freeze({ encrypt, decrypt });
}
