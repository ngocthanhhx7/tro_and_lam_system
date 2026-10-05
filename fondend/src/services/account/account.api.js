import { getJson, requestJson } from '../httpClient.js';

const idPath = (id) => encodeURIComponent(id);
const write = (path, method, body) => requestJson(path, { method, body });

export const accountApi = Object.freeze({
  listAddresses: () => getJson('/account/addresses'),
  createAddress: (body) => write('/account/addresses', 'POST', body),
  updateAddress: (id, body) => write(`/account/addresses/${idPath(id)}`, 'PATCH', body),
  deleteAddress: (id, expectedVersion) => requestJson(`/account/addresses/${idPath(id)}?expectedVersion=${encodeURIComponent(expectedVersion)}`, { method: 'DELETE' }),
  setDefaultAddress: (id, expectedVersion) => write(`/account/addresses/${idPath(id)}/default`, 'POST', { expectedVersion }),
  reverseGeocode: (coordinates) => write('/locations/reverse', 'POST', coordinates),
  getCart: () => getJson('/cart'),
  setCartItemQuantity: (productId, quantity, expectedVersion) => write(`/cart/items/${idPath(productId)}`, 'PUT', { quantity, expectedVersion }),
  removeCartItem: (productId, expectedVersion) => requestJson(`/cart/items/${idPath(productId)}?expectedVersion=${encodeURIComponent(expectedVersion)}`, { method: 'DELETE' }),
  mergeGuestCart: (expectedVersion) => write('/cart/merge', 'POST', { expectedVersion }),
});
