import { Router } from 'express';
import { createOperationsController } from '../controllers/operations.controller.js';
import { createAuditService } from '../services/operations/audit.service.js';
import { createBusinessSettingsService } from '../services/operations/business-settings.service.js';
import { createDashboardService } from '../services/operations/dashboard.service.js';
import { createNotificationService } from '../services/operations/notification.service.js';
import { createOutboxService } from '../services/operations/outbox.service.js';
import { forbidden, ServiceError } from '../utils/serviceError.js';

const CAPABILITY_ROLES = Object.freeze({
  'self.notifications': ['customer', 'staff', 'admin'],
  'dashboard.operations': ['staff', 'admin'],
  'audit.read': ['admin'],
  'statistics.read': ['admin'],
  'settings.manage': ['admin'],
});

function actorFor(req, auth) {
  const actor = typeof auth.getActor === 'function' ? auth.getActor(req) : req.actor;
  if (!actor || !(actor.id || actor._id)) throw new ServiceError(401, 'AUTH_REQUIRED', 'Cần đăng nhập để tiếp tục');
  if (actor.status !== 'active') throw new ServiceError(403, 'ACCOUNT_BLOCKED', 'Tài khoản không có quyền sử dụng chức năng này');
  return actor;
}

function authorize(capability, auth) {
  const allowedRoles = CAPABILITY_ROLES[capability];
  if (!allowedRoles) throw new TypeError(`Unknown operations capability: ${capability}`);
  const external = auth.requireCapability?.(capability);
  return (req, _res, next) => {
    try {
      const actor = actorFor(req, auth);
      if (!allowedRoles.includes(actor.role)) throw forbidden();
      if (typeof external === 'function') return external(req, _res, next);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function routeGuard(auth, capability, mutating = false) {
  const authenticate = auth.authenticate || auth.requireActor;
  const csrf = auth.requireCsrf || auth.csrfProtection;
  const externalCapability = auth.requireCapability?.(capability);
  if (!externalCapability && typeof authenticate !== 'function') throw new TypeError('Operations router requires the P02 authentication middleware');
  if (mutating && typeof csrf !== 'function') throw new TypeError('Operations mutations require the P01/P02 CSRF middleware');
  if (externalCapability) return [...(mutating ? [csrf] : []), externalCapability];
  return [authenticate, ...(mutating ? [csrf] : []), authorize(capability, auth)];
}

export function createOperationsRouter({
  auth,
  models = {},
  notificationService = createNotificationService({ Notification: models.Notification }),
  outboxService = createOutboxService({ OutboxEvent: models.OutboxEvent }),
  auditService = createAuditService({ AuditLog: models.AuditLog }),
  dashboardService = createDashboardService({
    Order: models.Order,
    Ticket: models.Ticket,
    Contact: models.Contact,
    Notification: models.Notification,
    orderMetrics: models.orderMetrics,
    inventoryMetrics: models.inventoryMetrics,
    financeLedger: models.financeLedger,
  }),
  settingsService = createBusinessSettingsService({ BusinessSetting: models.BusinessSetting, auditService }),
} = {}) {
  if (!auth) throw new TypeError('Operations router requires an auth port');
  const controller = createOperationsController({ notificationService, auditService, dashboardService, settingsService });
  const router = Router();

  router.get('/notifications', ...routeGuard(auth, 'self.notifications'), controller.listNotifications);
  router.get('/notifications/unread-count', ...routeGuard(auth, 'self.notifications'), controller.getUnreadCount);
  router.patch('/notifications/:id/read', ...routeGuard(auth, 'self.notifications', true), controller.markNotificationRead);
  router.patch('/notifications/read-all', ...routeGuard(auth, 'self.notifications', true), controller.markAllNotificationsRead);

  router.get('/staff/dashboard', ...routeGuard(auth, 'dashboard.operations'), controller.getStaffDashboard);
  router.get('/admin/audit-logs', ...routeGuard(auth, 'audit.read'), controller.listAdminAuditLogs);
  router.get('/admin/statistics', ...routeGuard(auth, 'statistics.read'), controller.getAdminStatistics);
  router.get('/admin/settings', ...routeGuard(auth, 'settings.manage'), controller.getAdminSettings);
  router.patch('/admin/settings', ...routeGuard(auth, 'settings.manage', true), controller.updateAdminSettings);

  Object.defineProperty(router, 'operationsPorts', {
    value: Object.freeze({ outboxService, notificationService, auditService, dashboardService, settingsService }),
    enumerable: false,
  });
  return router;
}

export { CAPABILITY_ROLES };
