import { getJson, requestJson } from '../httpClient.js';

function pageQuery({ status, page = 1, limit = 20 } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) query.set('status', status);
  return query.toString();
}

function localeQuery(locale = 'vi') {
  return new URLSearchParams({ locale }).toString();
}

export function getStory(slug, locale = 'vi', { signal } = {}) {
  return getJson(`/stories/${encodeURIComponent(slug)}?${localeQuery(locale)}`, { signal });
}

export function getPage(slug, locale = 'vi', { signal } = {}) {
  return getJson(`/pages/${encodeURIComponent(slug)}?${localeQuery(locale)}`, { signal });
}

export function getNfcStory(publicId, locale = 'vi', { signal } = {}) {
  return getJson(`/nfc/${encodeURIComponent(publicId)}?${localeQuery(locale)}`, { signal });
}

export function listAdminStories(query, { signal } = {}) {
  return getJson(`/admin/stories?${pageQuery(query)}`, { signal });
}

export function createStory(input) {
  return requestJson('/admin/stories', { method: 'POST', body: input });
}

export function updateStory(id, input) {
  return requestJson(`/admin/stories/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
}

export function archiveStory(id, expectedVersion) {
  const query = new URLSearchParams({ expectedVersion: String(expectedVersion) });
  return requestJson(`/admin/stories/${encodeURIComponent(id)}?${query}`, { method: 'DELETE' });
}

export function listAdminPages(query, { signal } = {}) {
  return getJson(`/admin/pages?${pageQuery(query)}`, { signal });
}

export function createPage(input) {
  return requestJson('/admin/pages', { method: 'POST', body: input });
}

export function updatePage(id, input) {
  return requestJson(`/admin/pages/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
}

export function archivePage(id, expectedVersion) {
  const query = new URLSearchParams({ expectedVersion: String(expectedVersion) });
  return requestJson(`/admin/pages/${encodeURIComponent(id)}?${query}`, { method: 'DELETE' });
}

export function listAdminNfcTags({ signal } = {}) {
  return getJson('/admin/nfc-tags', { signal });
}

export function createNfcTag(input) {
  return requestJson('/admin/nfc-tags', { method: 'POST', body: input });
}

export function revokeNfcTag(id, body) {
  return requestJson(`/admin/nfc-tags/${encodeURIComponent(id)}/revoke`, { method: 'POST', body });
}
