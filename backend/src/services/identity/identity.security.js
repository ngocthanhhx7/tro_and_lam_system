import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';

export function opaqueToken() {
  return randomBytes(32).toString('base64url');
}

export function shortChallengeId() {
  return randomBytes(18).toString('base64url');
}

export function challengeCode(challengeId, secret) {
  const digest = createHmac('sha256', secret).update(`appeal-access:${challengeId}`).digest();
  return (digest.readUInt32BE(0) % 1_000_000).toString().padStart(6, '0');
}

export function hashToken(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export async function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(passwordHash, password) {
  try {
    return await argon2.verify(passwordHash, password, { type: argon2.argon2id });
  } catch {
    return false;
  }
}

export function csrfValue(nonce, secret) {
  const signature = createHmac('sha256', secret).update(nonce).digest('base64url');
  return `${nonce}.${signature}`;
}

export function isValidCsrfValue(value, secret) {
  if (typeof value !== 'string' || typeof secret !== 'string' || secret.length < 32) return false;
  const separator = value.lastIndexOf('.');
  if (separator < 1) return false;
  const nonce = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!/^[A-Za-z0-9_-]{30,}$/.test(nonce) || !/^[A-Za-z0-9_-]{40,}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(nonce).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    return false;
  }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function serializeCookie(name, value, {
  httpOnly = true,
  secure = true,
  sameSite = 'Lax',
  path = '/api/v1',
  maxAge,
} = {}) {
  const attributes = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (httpOnly) attributes.push('HttpOnly');
  if (secure) attributes.push('Secure');
  if (Number.isFinite(maxAge)) attributes.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return attributes.join('; ');
}

export function appendSetCookie(res, cookie) {
  const current = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', current ? [...(Array.isArray(current) ? current : [current]), cookie] : [cookie]);
}

export function clearCookie(res, name, options = {}) {
  appendSetCookie(res, serializeCookie(name, '', { ...options, maxAge: 0 }));
}

export function cookieValue(req, name) {
  const header = req.headers.cookie;
  if (typeof header !== 'string') return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}
