import { sendPaginated, sendSuccess } from '../utils/apiResponse.js';

function actorId(req) {
  return String(req.actor.id ?? req.actor._id);
}

export function createOperationsController({ notificationService, auditService, dashboardService, settingsService }) {
  return Object.freeze({
    async listNotifications(req, res) {
      const result = await notificationService.list(actorId(req), req.query);
      return sendPaginated(res, result.items, result.pagination);
    },
    async getUnreadCount(req, res) {
      return sendSuccess(res, await notificationService.unreadCount(actorId(req)));
    },
    async markNotificationRead(req, res) {
      return sendSuccess(res, await notificationService.markRead(actorId(req), req.params.id));
    },
    async markAllNotificationsRead(req, res) {
      return sendSuccess(res, await notificationService.markAllRead(actorId(req)));
    },
    async getStaffDashboard(req, res) {
      return sendSuccess(res, await dashboardService.getStaffDashboard({ actorId: actorId(req), ...req.query }));
    },
    async listAdminAuditLogs(req, res) {
      const result = await auditService.list(req.query);
      return sendSuccess(res, result.items, { meta: { nextCursor: result.nextCursor } });
    },
    async getAdminStatistics(req, res) {
      return sendSuccess(res, await dashboardService.getAdminStatistics(req.query));
    },
    async getAdminSettings(_req, res) {
      return sendSuccess(res, await settingsService.get());
    },
    async updateAdminSettings(req, res) {
      return sendSuccess(res, await settingsService.update(req.body, {
        actorId: actorId(req),
        requestId: res.locals.requestId,
      }));
    },
  });
}
