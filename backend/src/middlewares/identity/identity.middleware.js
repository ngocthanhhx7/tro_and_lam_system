import { randomBytes } from 'node:crypto';
import { ServiceError } from '../../utils/serviceError.js';
import { createIdentityService } from '../../services/identity/identity.service.js';
import {
  appendSetCookie,
  cookieValue,
  csrfValue,
  isValidCsrfValue,
  serializeCookie,
} from '../../services/identity/identity.security.js';

export const roleCapabilities = Object.freeze({
  customer: new Set(['self.profile', 'self.addresses', 'self.orders', 'self.reviews', 'self.tickets', 'self.notifications']),
  staff: new Set([
    'self.profile', 'self.addresses', 'self.orders', 'self.reviews', 'self.tickets', 'self.notifications',
    'orders.operate', 'support.operate', 'contacts.operate', 'dashboard.operations', 'refunds.request',
  ]),
  admin: new Set([
    'self.profile', 'self.addresses', 'self.orders', 'self.reviews', 'self.tickets', 'self.notifications',
    'orders.operate', 'support.operate', 'contacts.operate', 'dashboard.operations', 'refunds.request',
    'catalog.manage', 'content.manage', 'users.manage', 'appeals.review', 'refunds.approve', 'refunds.complete',
    'audit.read', 'statistics.read', 'settings.manage',
  ]),
});

export function createIdentityMiddleware({ ports = {}, config = {}, service: suppliedService } = {}) {
  const service = suppliedService || ports.identityService || createIdentityService({ ports, config });
  const settings = {
    sessionCookieName: config.sessionCookieName || 'tl_session',
    restrictedCookieName: config.restrictedCookieName || 'tl_appeal',
    csrfCookieName: config.csrfCookieName || 'tl_csrf',
    cookiePath: config.cookiePath || '/api/v1',
    secureCookies: config.secureCookies ?? process.env.NODE_ENV === 'production',
    sameSite: config.sameSite || 'Lax',
  };
  const allowedOrigins = new Set((Array.isArray(config.allowedOrigins) ? config.allowedOrigins : [config.allowedOrigins || config.corsOrigin || 'http://localhost:5173'])
    .flatMap((value) => String(value).split(',')).map((value) => value.trim()).filter(Boolean));

  function requireActor(req, _res, next) {
    Promise.resolve().then(async () => {
      req.actor = await service.authenticateSession(cookieValue(req, settings.sessionCookieName));
    }).then(() => next(), next);
  }

  function requireCapability(capability) {
    if (typeof capability !== 'string' || !capability) throw new TypeError('Capability phải là chuỗi không rỗng');
    return (req, res, next) => requireActor(req, res, (error) => {
      if (error) return next(error);
      if (!roleCapabilities[req.actor.role]?.has(capability)) {
        return next(new ServiceError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này'));
      }
      return next();
    });
  }

  function requireAppeal(scopes = ['appeal.read']) {
    if (!Array.isArray(scopes) || scopes.some((scope) => !['appeal.submit', 'appeal.read'].includes(scope))) {
      throw new TypeError('Appeal middleware chỉ hỗ trợ scope appeal.submit/appeal.read');
    }
    return (req, _res, next) => {
      Promise.resolve().then(async () => {
        const actor = await service.authenticateAppealProof(cookieValue(req, settings.restrictedCookieName));
        if (!scopes.every((scope) => actor.scopes.includes(scope))) {
          throw new ServiceError(403, 'FORBIDDEN', 'Phiên này không có quyền thực hiện thao tác');
        }
        req.appealActor = actor;
      }).then(() => next(), next);
    };
  }

  function csrfProtection(req, _res, next) {
    const origin = req.get('origin');
    const cookie = cookieValue(req, settings.csrfCookieName);
    const header = req.get('x-csrf-token');
    if (!origin || !allowedOrigins.has(origin) || !cookie || cookie !== header || !isValidCsrfValue(header, config.csrfSecret)) {
      return next(new ServiceError(403, 'CSRF_INVALID', 'Yêu cầu không vượt qua được kiểm tra bảo vệ'));
    }
    return next();
  }

  function requireOwner(actor, resource) {
    const ownerId = resource?.userId?._id ?? resource?.userId?.id ?? resource?.userId;
    if (!actor || !resource || !ownerId || String(ownerId) !== actor.id) {
      throw new ServiceError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên');
    }
    return resource;
  }

  function issueCsrf(req, res) {
    const existing = cookieValue(req, settings.csrfCookieName);
    const token = isValidCsrfValue(existing, config.csrfSecret)
      ? existing
      : csrfValue(randomBytes(32).toString('base64url'), config.csrfSecret);
    appendSetCookie(res, serializeCookie(settings.csrfCookieName, token, {
      httpOnly: false, secure: settings.secureCookies, sameSite: settings.sameSite,
      path: settings.cookiePath, maxAge: 12 * 60 * 60,
    }));
    res.set('Cache-Control', 'no-store');
    return token;
  }

  return Object.freeze({
    requireActor,
    requireCapability,
    requireAppeal,
    requireOwner,
    csrfProtection,
    issueCsrf,
    service,
    settings,
  });
}
