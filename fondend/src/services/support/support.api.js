import { getJson, requestJson } from '../httpClient.js';

const queryString = (values = {}) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  return query.size ? `?${query.toString()}` : '';
};

const idempotencyHeaders = (key) => ({ 'Idempotency-Key': key });

export const supportApi = Object.freeze({
  createContact: (body) => requestJson('/contacts', { method: 'POST', body }),
  listOwnOrders: (filters) => getJson(`/account/orders${queryString(filters)}`),
  getOrder: (id) => getJson(`/orders/${encodeURIComponent(id)}`),
  createTicket: (body) => requestJson('/tickets', { method: 'POST', body }),
  createAttachmentUpload: (body) => requestJson('/attachments/uploads', { method: 'POST', body }),
  finalizeAttachment: (id) => requestJson(`/attachments/${encodeURIComponent(id)}/finalize`, { method: 'POST', body: {} }),
  listOwnTickets: (filters) => getJson(`/account/tickets${queryString(filters)}`),
  getTicket: (id) => getJson(`/tickets/${encodeURIComponent(id)}`),
  listTicketMessages: (id, filters) => getJson(`/tickets/${encodeURIComponent(id)}/messages${queryString(filters)}`),
  createTicketMessage: (id, body) => requestJson(`/tickets/${encodeURIComponent(id)}/messages`, { method: 'POST', body }),
  createReturnRequest: (orderId, body, key) => requestJson(`/orders/${encodeURIComponent(orderId)}/return-requests`, {
    method: 'POST', body, headers: idempotencyHeaders(key),
  }),
  listOwnReturnRequests: (orderId) => getJson(`/orders/${encodeURIComponent(orderId)}/return-requests`),
  listOwnReviews: (filters) => getJson(`/account/reviews${queryString(filters)}`),
  createReview: (body) => requestJson('/account/reviews', { method: 'POST', body }),
  updateReview: (id, body) => requestJson(`/account/reviews/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  listPublicReviews: (productId, filters) => getJson(`/products/${encodeURIComponent(productId)}/reviews${queryString(filters)}`),
  listStaffTickets: (filters) => getJson(`/staff/tickets${queryString(filters)}`),
  updateStaffTicket: (id, body) => requestJson(`/staff/tickets/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  listStaffReturns: (filters) => getJson(`/staff/return-requests${queryString(filters)}`),
  decideReturn: (id, body) => requestJson(`/staff/return-requests/${encodeURIComponent(id)}/decision`, { method: 'POST', body }),
  inspectReturn: (id, body) => requestJson(`/staff/return-requests/${encodeURIComponent(id)}/inspection`, { method: 'POST', body }),
  closeReturn: (id, body) => requestJson(`/staff/return-requests/${encodeURIComponent(id)}/close`, { method: 'POST', body }),
  listStaffContacts: (filters) => getJson(`/staff/contacts${queryString(filters)}`),
  updateStaffContact: (id, body) => requestJson(`/staff/contacts/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  listAdminReviews: (filters) => getJson(`/admin/reviews${queryString(filters)}`),
  moderateReview: (id, body) => requestJson(`/admin/reviews/${encodeURIComponent(id)}/moderation`, { method: 'POST', body }),
});

export function createSupportIdempotencyKey() {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Trình duyệt chưa hỗ trợ tạo khóa bảo mật. Hãy mở trang qua HTTPS.');
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}
