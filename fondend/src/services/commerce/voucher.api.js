import { getJson, requestJson } from '../httpClient.js';

const idPath = (id) => encodeURIComponent(id);

export const voucherApi = Object.freeze({
  listMine: () => getJson('/account/vouchers'),
  listAdmin: () => getJson('/admin/vouchers'),
  issue: (body) => requestJson('/admin/vouchers', { method: 'POST', body }),
  revoke: (id) => requestJson(`/admin/vouchers/${idPath(id)}/revoke`, { method: 'POST', body: {} }),
});
