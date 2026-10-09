import { getJson, requestJson } from '../httpClient.js';

export const NOTIFICATIONS_UPDATED_EVENT = 'tro-lam:notifications-updated';

function queryString(values) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

export const operationsApi = Object.freeze({
  listNotifications: (filters = {}) => getJson(`/notifications${queryString(filters)}`),
  getUnreadCount: () => getJson('/notifications/unread-count'),
  markNotificationRead: async (id) => {
    const response = await requestJson(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', body: {} });
    window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
    return response;
  },
  markAllNotificationsRead: async () => {
    const response = await requestJson('/notifications/read-all', { method: 'PATCH', body: {} });
    window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
    return response;
  },
  getStaffDashboard: (filters = {}) => getJson(`/staff/dashboard${queryString(filters)}`),
  getAdminStatistics: (filters) => getJson(`/admin/statistics${queryString(filters)}`),
  listAuditLogs: (filters = {}) => getJson(`/admin/audit-logs${queryString(filters)}`),
  getBusinessSettings: () => getJson('/admin/settings'),
  updateBusinessSettings: (body) => requestJson('/admin/settings', { method: 'PATCH', body }),
});
