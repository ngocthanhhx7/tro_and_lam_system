import { getJson, requestJson } from '../httpClient.js';

const json = (response) => response.data;
const idempotencyHeaders = (key) => ({ 'Idempotency-Key': key });
let volatileRetry = null;

export const commerceApi = Object.freeze({
  getCart: async () => json(await getJson('/cart')),
  listAddresses: async () => json(await getJson('/account/addresses')),
  quoteCheckout: async (body) => json(await requestJson('/checkout/quote', { method: 'POST', body })),
  createOrder: async (body, key) => json(await requestJson('/orders', {
    method: 'POST', body, headers: idempotencyHeaders(key),
  })),
  issueOrderChallenge: async (body) => json(await requestJson('/order-access/challenges', { method: 'POST', body })),
  verifyOrderChallenge: async (body) => json(await requestJson('/order-access/verify', { method: 'POST', body })),
  getOrder: async (id) => json(await getJson(`/orders/${encodeURIComponent(id)}`)),
  cancelOrder: async (id, body, key) => json(await requestJson(`/orders/${encodeURIComponent(id)}/cancel`, {
    method: 'POST', body, headers: idempotencyHeaders(key),
  })),
  listOwnOrders: async ({ page = 1, limit = 20, status } = {}) => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) query.set('status', status);
    return getJson(`/account/orders?${query.toString()}`);
  },
  claimGuestOrder: async (orderId, key) => json(await requestJson('/account/orders/claim', {
    method: 'POST', body: { orderId }, headers: idempotencyHeaders(key),
  })),
  listStaffOrders: async ({ page = 1, limit = 20, queue, q, paymentStatus, from, to, sort } = {}) => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (queue) query.set('queue', queue);
    for (const [key, value] of Object.entries({ q, paymentStatus, from, to, sort })) if (value) query.set(key, value);
    return getJson(`/staff/orders?${query.toString()}`);
  },
  getOperationalOrder: async (id) => json(await getJson(`/staff/orders/${encodeURIComponent(id)}`)),
  transitionOrder: async (id, body, key) => json(await requestJson(`/staff/orders/${encodeURIComponent(id)}/transitions`, {
    method: 'POST', body, headers: idempotencyHeaders(key),
  })),
  collectCod: async (id, body, key) => json(await requestJson(`/staff/orders/${encodeURIComponent(id)}/cod-collection`, {
    method: 'POST', body, headers: idempotencyHeaders(key),
  })),
});

export function createIdempotencyKey() {
  try {
    const randomBytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    throw new Error('Trình duyệt chưa hỗ trợ bộ tạo khóa bảo mật. Hãy mở trang qua kết nối HTTPS.');
  }
}

export async function retryableCheckoutKey(body) {
  const serialized = JSON.stringify(body);
  let fingerprint;
  try {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
    fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    if (volatileRetry?.serialized === serialized) return volatileRetry.key;
    volatileRetry = { serialized, key: createIdempotencyKey() };
    return volatileRetry.key;
  }
  const storageKey = 'tl-checkout-retry';
  try {
    const prior = JSON.parse(globalThis.sessionStorage.getItem(storageKey) || 'null');
    if (prior?.fingerprint === fingerprint && typeof prior.key === 'string') return prior.key;
    const key = createIdempotencyKey();
    globalThis.sessionStorage.setItem(storageKey, JSON.stringify({ fingerprint, key }));
    volatileRetry = { serialized, key };
    return key;
  } catch {
    if (volatileRetry?.serialized === serialized) return volatileRetry.key;
    volatileRetry = { serialized, key: createIdempotencyKey() };
    return volatileRetry.key;
  }
}

export function clearRetryableCheckoutKey() {
  volatileRetry = null;
  try { globalThis.sessionStorage.removeItem('tl-checkout-retry'); } catch { /* Storage may be unavailable. */ }
}
