import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { createHmac } from 'node:crypto';
import { ServiceError } from '../../utils/serviceError.js';
import { sendAccepted, sendCreated, sendNoContent, sendPaginated, sendSuccess } from '../../utils/apiResponse.js';
import { createIdentityMiddleware } from '../../middlewares/identity/identity.middleware.js';
import { createIdentityService } from '../../services/identity/identity.service.js';
import { appendSetCookie, clearCookie, cookieValue, serializeCookie } from '../../services/identity/identity.security.js';
import {
  validateAppealFilters,
  validateIdentityBody,
  validateIdentityId,
  validateUserFilters,
} from '../../validators/identity/identity.validator.js';

const paginationMeta = (page, limit, total) => ({
  page, limit, total, totalPages: Math.ceil(total / limit),
});

function makeLimiter({ ports, name, config, next }) {
  const store = typeof ports.rateLimitStore === 'function' ? ports.rateLimitStore(name) : undefined;
  return rateLimit({
    windowMs: config.authRateLimitWindowMs || 15 * 60 * 1000,
    limit: name === 'login' ? (config.loginRateLimit || 10) : (config.challengeRateLimit || 5),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(store ? { store } : {}),
    handler: (_req, _res, routeNext) => routeNext(new ServiceError(429, 'RATE_LIMITED', 'Quá nhiều yêu cầu. Vui lòng thử lại sau')),
    validate: { xForwardedForHeader: false },
    passOnStoreError: false,
    requestPropertyName: `identityRateLimit${name}`,
    ...(next ? { skip: next } : {}),
  });
}

function makeIdentityLimiter({ ports, name, config, limit }) {
  const store = typeof ports.rateLimitStore === 'function' ? ports.rateLimitStore(name) : undefined;
  const secret = config.challengeSecret || config.csrfSecret;
  return rateLimit({
    windowMs: config.authRateLimitWindowMs || 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(store ? { store } : {}),
    keyGenerator(req) {
      const fields = req.validatedBody || {};
      const identity = fields.email ?? fields.challengeId ?? fields.token ?? 'unknown';
      const normalized = fields.email === undefined
        ? String(identity).trim()
        : fields.email.normalize('NFKC').trim().toLowerCase();
      return createHmac('sha256', secret).update(normalized).digest('hex');
    },
    handler: (_req, _res, routeNext) => routeNext(new ServiceError(429, 'RATE_LIMITED', 'Quá nhiều yêu cầu. Vui lòng thử lại sau')),
    passOnStoreError: false,
    requestPropertyName: `identityRateLimit${name}`,
  });
}

function setSessionCookie(res, token, expiresAt, settings) {
  const maxAge = Math.max(0, (new Date(expiresAt).getTime() - Date.now()) / 1000);
  appendSetCookie(res, serializeCookie(settings.sessionCookieName, token, {
    httpOnly: true, secure: settings.secureCookies, sameSite: settings.sameSite,
    path: settings.cookiePath, maxAge,
  }));
}

function setAppealCookie(res, token, expiresAt, settings) {
  const maxAge = Math.max(0, (new Date(expiresAt).getTime() - Date.now()) / 1000);
  appendSetCookie(res, serializeCookie(settings.restrictedCookieName, token, {
    httpOnly: true, secure: settings.secureCookies, sameSite: settings.sameSite,
    path: settings.cookiePath, maxAge,
  }));
}

function cleanSessionCookies(res, settings) {
  clearCookie(res, settings.sessionCookieName, {
    secure: settings.secureCookies, sameSite: settings.sameSite, path: settings.cookiePath,
  });
  clearCookie(res, settings.restrictedCookieName, {
    secure: settings.secureCookies, sameSite: settings.sameSite, path: settings.cookiePath,
  });
}

export function createIdentityRouter({ ports = {}, config = {} } = {}) {
  if (typeof config.csrfSecret !== 'string' || config.csrfSecret.length < 32) {
    throw new TypeError('P02 config.csrfSecret phải có ít nhất 32 ký tự ngẫu nhiên');
  }
  const router = express.Router();
  const service = ports.identityService || createIdentityService({ ports, config });
  const identity = createIdentityMiddleware({ ports, config, service });
  const { requireActor, requireCapability, requireAppeal, csrfProtection, settings } = identity;
  const loginLimiter = makeLimiter({ ports, name: 'login', config });
  const challengeLimiter = makeLimiter({ ports, name: 'challenge', config });
  const loginIdentityLimiter = makeIdentityLimiter({
    ports, name: 'login-identity', config,
    limit: config.identityLoginRateLimit || config.loginRateLimit || 10,
  });
  const challengeIdentityLimiter = makeIdentityLimiter({
    ports, name: 'challenge-identity', config,
    limit: config.identityChallengeRateLimit || config.challengeRateLimit || 5,
  });

  router.get('/auth/csrf', (req, res) => sendSuccess(res, { csrfToken: identity.issueCsrf(req, res) }));

  router.post('/auth/register', csrfProtection, challengeLimiter, validateIdentityBody('register'), challengeIdentityLimiter, async (req, res) => {
    const data = await service.register(req.validatedBody);
    return sendAccepted(res, data);
  });
  router.post('/auth/invitations/accept', csrfProtection, loginLimiter, validateIdentityBody('invitationAccept'), async (req, res) => {
    const result = await service.acceptInvitation(req.validatedBody);
    cleanSessionCookies(res, settings);
    setSessionCookie(res, result.sessionToken, result.sessionExpiresAt, settings);
    return sendSuccess(res, { user: result.user });
  });
  router.post('/auth/verify-email', csrfProtection, challengeLimiter, validateIdentityBody('token'), challengeIdentityLimiter, async (req, res) => {
    return sendSuccess(res, await service.verifyEmail(req.validatedBody.token));
  });
  router.post('/auth/resend-verification', csrfProtection, challengeLimiter, validateIdentityBody('email'), challengeIdentityLimiter, async (req, res) => {
    return sendAccepted(res, await service.resendVerification(req.validatedBody));
  });
  router.post('/auth/login', csrfProtection, loginLimiter, validateIdentityBody('login'), loginIdentityLimiter, async (req, res, next) => {
    const result = await service.login(req.validatedBody);
    if (result.blocked) {
      cleanSessionCookies(res, settings);
      setAppealCookie(res, result.appealToken, result.appealExpiresAt, settings);
      return next(new ServiceError(403, 'ACCOUNT_BLOCKED', 'Tài khoản đang bị khóa', [
        { field: 'account', code: 'APPEAL_AVAILABLE', message: 'Bạn có thể gửi yêu cầu xem xét' },
      ]));
    }
    clearCookie(res, settings.restrictedCookieName, {
      secure: settings.secureCookies, sameSite: settings.sameSite, path: settings.cookiePath,
    });
    setSessionCookie(res, result.sessionToken, result.sessionExpiresAt, settings);
    return sendSuccess(res, { user: result.user });
  });
  router.post('/auth/logout', csrfProtection, async (req, res) => {
    await service.logout({
      sessionToken: cookieValue(req, settings.sessionCookieName),
      appealToken: cookieValue(req, settings.restrictedCookieName),
    });
    cleanSessionCookies(res, settings);
    return sendNoContent(res);
  });
  router.post('/auth/forgot-password', csrfProtection, challengeLimiter, validateIdentityBody('email'), challengeIdentityLimiter, async (req, res) => {
    return sendAccepted(res, await service.requestPasswordReset(req.validatedBody));
  });
  router.post('/auth/reset-password', csrfProtection, challengeLimiter, validateIdentityBody('reset'), challengeIdentityLimiter, async (req, res) => {
    return sendSuccess(res, await service.resetPassword(req.validatedBody));
  });
  router.get('/auth/me', requireActor, (req, res) => sendSuccess(res, req.actor.user && {
    id: req.actor.id,
    name: req.actor.user.name,
    email: req.actor.user.emailNormalized,
    ...(req.actor.user.phone ? { phone: req.actor.user.phone } : {}),
    role: req.actor.role,
    status: req.actor.status,
    ...(req.actor.user.emailVerifiedAt ? { emailVerifiedAt: new Date(req.actor.user.emailVerifiedAt).toISOString() } : {}),
    version: req.actor.user.version,
  }));
  router.post('/auth/appeal-challenges', csrfProtection, challengeLimiter, validateIdentityBody('email'), challengeIdentityLimiter, async (req, res) => {
    return sendAccepted(res, await service.requestAppealChallenge(req.validatedBody));
  });
  router.post('/auth/appeal-access', csrfProtection, challengeLimiter, validateIdentityBody('appealAccess'), challengeIdentityLimiter, async (req, res) => {
    const result = await service.exchangeAppealAccess(req.validatedBody);
    setAppealCookie(res, result.proofToken, result.expiresAt, settings);
    return sendSuccess(res, { expiresAt: result.expiresAt.toISOString() });
  });

  router.get('/account/appeals/current', requireAppeal(['appeal.read']), async (req, res) => {
    return sendSuccess(res, await service.currentAppeal(req.appealActor));
  });
  router.post('/account/appeals', csrfProtection, requireAppeal(['appeal.submit']), validateIdentityBody('appealSubmit'), async (req, res) => {
    return sendCreated(res, await service.submitAppeal(req.appealActor, req.validatedBody, { requestId: res.locals.requestId }));
  });
  router.patch('/account/profile', csrfProtection, requireCapability('self.profile'), validateIdentityBody('profile'), async (req, res) => {
    return sendSuccess(res, await service.updateProfile(req.actor, req.validatedBody));
  });

  router.get('/admin/users', requireCapability('users.manage'), async (req, res) => {
    const filters = validateUserFilters(req.query);
    const { items, total } = await service.listUsers(filters);
    return sendPaginated(res, items, paginationMeta(filters.page, filters.limit, total));
  });
  router.post('/admin/users', csrfProtection, requireCapability('users.manage'), validateIdentityBody('invite'), async (req, res) => {
    return sendCreated(res, await service.inviteUser(req.actor, req.validatedBody, { requestId: res.locals.requestId }));
  });
  router.get('/admin/users/:id', validateIdentityId(), requireCapability('users.manage'), async (req, res) => {
    return sendSuccess(res, await service.getUser(req.params.id));
  });
  router.patch('/admin/users/:id', validateIdentityId(), csrfProtection, requireCapability('users.manage'), validateIdentityBody('adminUser'), async (req, res) => {
    return sendSuccess(res, await service.updateAdminUser(req.actor, req.params.id, req.validatedBody));
  });
  router.post('/admin/users/:id/status', validateIdentityId(), csrfProtection, requireCapability('users.manage'), validateIdentityBody('status'), async (req, res) => {
    const user = await service.changeAdminUser(req.actor, req.params.id, req.validatedBody, 'status', { requestId: res.locals.requestId });
    return sendSuccess(res, user);
  });
  router.post('/admin/users/:id/role', validateIdentityId(), csrfProtection, requireCapability('users.manage'), validateIdentityBody('role'), async (req, res) => {
    const user = await service.changeAdminUser(req.actor, req.params.id, req.validatedBody, 'role', { requestId: res.locals.requestId });
    return sendSuccess(res, user);
  });
  router.get('/admin/appeals', requireCapability('appeals.review'), async (req, res) => {
    const filters = validateAppealFilters(req.query);
    const { items, total } = await service.listAppeals(filters);
    return sendPaginated(res, items, paginationMeta(filters.page, filters.limit, total));
  });
  router.post('/admin/appeals/:id/decision', validateIdentityId(), csrfProtection, requireCapability('appeals.review'), validateIdentityBody('appealDecision'), async (req, res) => {
    const result = await service.decideAppeal(req.actor, req.params.id, req.validatedBody, { requestId: res.locals.requestId });
    return sendSuccess(res, result);
  });

  router.identityService = service;
  router.identityMiddleware = identity;
  return router;
}
