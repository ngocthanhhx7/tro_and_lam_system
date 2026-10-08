import { getJson, requestJson } from '../httpClient.js';
import { publishCartUpdate } from '../account/cartEvents.js';

export function productListPath(filters = {}) {
  const query = new URLSearchParams();
  for (const key of ['q', 'line', 'category', 'priceMin', 'priceMax', 'saleMode', 'available', 'sort', 'page', 'limit']) {
    const value = filters[key];
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  return `/products${query.size ? `?${query.toString()}` : ''}`;
}

export async function searchPublishedProducts(filters, { signal } = {}) {
  return getJson(productListPath(filters), { signal });
}

export function getPublishedCategories({ signal } = {}) {
  return getJson('/categories', { signal });
}

export function getPublishedProduct(slug, { signal } = {}) {
  return getJson(`/products/${encodeURIComponent(slug)}`, { signal });
}

export async function submitQuoteRequest(input) {
  return requestJson('/contacts', { method: 'POST', body: input });
}

export async function addCartQuantity(productId, quantity) {
  const cart = await getJson('/cart');
  const existing = (cart?.data?.items || []).find((item) => item.productId === productId || item.product?.id === productId);
  const nextQuantity = (existing?.quantity || 0) + quantity;
  if (nextQuantity > 99) {
    throw new Error('Giỏ chỉ nhận tối đa 99 sản phẩm cho mỗi mã hàng.');
  }
  const version = cart?.data?.version;
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error('Không thể xác minh phiên bản giỏ hàng. Tải lại rồi thử lại.');
  }
  const response = await requestJson(`/cart/items/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    body: { quantity: nextQuantity, expectedVersion: version },
  });
  publishCartUpdate(response?.data);
  return response;
}

export function listAdminProducts(filters = {}, { signal } = {}) {
  const query = new URLSearchParams();
  for (const key of ['q', 'line', 'status', 'page', 'limit']) {
    if (filters[key] !== undefined && filters[key] !== '') query.set(key, String(filters[key]));
  }
  return getJson(`/admin/products${query.size ? `?${query}` : ''}`, { signal });
}

export function getAdminProduct(id, { signal } = {}) {
  return getJson(`/admin/products/${encodeURIComponent(id)}`, { signal });
}

export function saveAdminProduct(product, id) {
  return requestJson(id ? `/admin/products/${encodeURIComponent(id)}` : '/admin/products', {
    method: id ? 'PATCH' : 'POST',
    body: product,
  });
}

export function archiveAdminProduct(id, expectedVersion) {
  return requestJson(`/admin/products/${encodeURIComponent(id)}?expectedVersion=${encodeURIComponent(expectedVersion)}`, {
    method: 'DELETE',
  });
}

export function listAdminCategories({ signal } = {}) {
  return getJson('/admin/categories', { signal });
}

export function saveAdminCategory(category, id) {
  return requestJson(id ? `/admin/categories/${encodeURIComponent(id)}` : '/admin/categories', {
    method: id ? 'PATCH' : 'POST',
    body: category,
  });
}

export function archiveAdminCategory(id, expectedVersion) {
  return requestJson(`/admin/categories/${encodeURIComponent(id)}?expectedVersion=${encodeURIComponent(expectedVersion)}`, {
    method: 'DELETE',
  });
}

export function uploadCatalogImage(file, alt) {
  const form = new FormData();
  form.set('file', file);
  form.set('alt', alt);
  return requestJson('/admin/media', { method: 'POST', body: form });
}

export function formatVnd(amount) {
  if (!Number.isSafeInteger(amount) || amount < 1) return '';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}
