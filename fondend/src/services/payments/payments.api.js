import { getJson, requestJson } from '../httpClient.js';

export const paymentsApi = Object.freeze({
  createPaymentAttempt(orderId, idempotencyKey, { signal } = {}) {
    return requestJson(`/orders/${encodeURIComponent(orderId)}/payment-attempts`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      signal,
    });
  },
  getPaymentStatus(orderId, { signal } = {}) {
    return getJson(`/orders/${encodeURIComponent(orderId)}/payment`, { signal });
  },
  listRefunds({ status, page = 1, limit = 20, signal } = {}) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) query.set('status', status);
    return getJson(`/admin/refunds?${query}`, { signal });
  },
  decideRefund(id, input, { signal } = {}) {
    return requestJson(`/admin/refunds/${encodeURIComponent(id)}/decision`, { method: 'POST', body: input, signal });
  },
  completeRefund(id, input, { signal } = {}) {
    return requestJson(`/admin/refunds/${encodeURIComponent(id)}/complete`, { method: 'POST', body: input, signal });
  },
});
