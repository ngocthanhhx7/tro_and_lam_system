import { getJson, requestJson } from '../httpClient.js';
import { publishCartUpdate } from './cartEvents.js';

const idPath = (id) => encodeURIComponent(id);
const write = (path, method, body) => requestJson(path, { method, body });
async function updateCart(request) {
  const response = await request;
  publishCartUpdate(response?.data);
  return response;
}

export const accountApi = Object.freeze({
  listAddresses: () => getJson('/account/addresses'),
  createAddress: (body) => write('/account/addresses', 'POST', body),
  updateAddress: (id, body) => write(`/account/addresses/${idPath(id)}`, 'PATCH', body),
  deleteAddress: (id, expectedVersion) => requestJson(`/account/addresses/${idPath(id)}?expectedVersion=${encodeURIComponent(expectedVersion)}`, { method: 'DELETE' }),
  setDefaultAddress: (id, expectedVersion) => write(`/account/addresses/${idPath(id)}/default`, 'POST', { expectedVersion }),
  reverseGeocode: (coordinates) => write('/locations/reverse', 'POST', coordinates),
  getCart: () => getJson('/cart'),
  setCartItemQuantity: (productId, quantity, expectedVersion) => updateCart(write(`/cart/items/${idPath(productId)}`, 'PUT', { quantity, expectedVersion })),
  removeCartItem: (productId, expectedVersion) => updateCart(requestJson(`/cart/items/${idPath(productId)}?expectedVersion=${encodeURIComponent(expectedVersion)}`, { method: 'DELETE' })),
  mergeGuestCart: (expectedVersion) => updateCart(write('/cart/merge', 'POST', { expectedVersion })),
});
