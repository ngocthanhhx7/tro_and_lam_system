import { createHmac } from 'node:crypto';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { appendSetCookie, cookieValue, serializeCookie } from '../../services/identity/identity.security.js';
import { ServiceError } from '../../utils/serviceError.js';
import { sendAccepted, sendCreated, sendPaginated, sendSuccess } from '../../utils/apiResponse.js';
import {
  validateCommerceBody,
  validateCommerceFilters,
  validateCommerceId,
  validateCommerceProductId,
} from '../../validators/commerce/commerce.validator.js';
import { createCommerceService } from '../../services/commerce/commerce.service.js';

function paginationMeta(page, limit, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

function limiter({ ports, config, operation }) {
  const windowMs = config.orderAccessRateLimitWindowMs || 15 * 60 * 1000;
  const limit = operation === 'challenge' ? (config.orderAccessChallengeRateLimit || 5) : (config.orderAccessVerifyRateLimit || 8);
  const base = {
    windowMs, limit,
    standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new ServiceError(429, 'RATE_LIMITED', 'Quá nhiều yêu cầu. Vui lòng thử lại sau')),
    passOnStoreError: false,
  };
  const ipStore = typeof ports.rateLimitStore === 'function' ? ports.rateLimitStore(`order-access-${operation}-ip`) : undefined;
  const identityStore = typeof ports.rateLimitStore === 'function' ? ports.rateLimitStore(`order-access-${operation}-identity`) : undefined;
  const ipLimiter = rateLimit({ ...base, ...(ipStore ? { store: ipStore } : {}) });
  const identityLimiter = rateLimit({
    ...base,
    ...(identityStore ? { store: identityStore } : {}),
    keyGenerator(req) {
      const identity = req.validatedBody?.email ?? req.validatedBody?.challengeId ?? 'unknown';
      const normalized = req.validatedBody?.email === undefined
        ? String(identity) : identity.normalize('NFKC').trim().toLowerCase();
      return createHmac('sha256', config.challengeSecret).update(normalized).digest('hex');
    },
  });
  return [ipLimiter, identityLimiter];
}

export function createCommerceRouter({ ports = {}, config = {} } = {}) {
  if (typeof config.challengeSecret !== 'string' || config.challengeSecret.length < 32) {
    throw new TypeError('P05 config.challengeSecret phải có ít nhất 32 ký tự ngẫu nhiên');
  }
  const identity = ports.identity || {};
  for (const name of ['csrfProtection', 'requireActor', 'requireCapability']) {
    if (typeof identity[name] !== 'function') throw new TypeError(`P05 cần P02 identity.${name}`);
  }
  if (typeof ports.resolveActor !== 'function') throw new TypeError('P05 cần P02 actor resolver có guest cart scope');
  const router = express.Router();
  const service = ports.commerceService || createCommerceService({ ports, config });
  const csrf = identity.csrfProtection;
  const requireActor = identity.requireActor;
  const selfOrders = identity.requireCapability('self.orders');
  const operateOrders = identity.requireCapability('orders.operate');
  const manageCatalog = identity.requireCapability('catalog.manage');
  const accessChallengeLimiter = limiter({ ports, config, operation: 'challenge' });
  const accessVerifyLimiter = limiter({ ports, config, operation: 'verify' });

  async function resolveActor(req) {
    const actor = await ports.resolveActor(req);
    if (!actor) return undefined;
    if (actor.status === 'blocked') throw new ServiceError(403, 'ACCOUNT_BLOCKED', 'Tài khoản đang bị khóa');
    return actor;
  }

  async function resolveOrderActor(req, orderId) {
    if (typeof ports.resolveOrderActor !== 'function') {
      throw new ServiceError(503, 'DATABASE_UNAVAILABLE', 'Xác minh quyền truy cập đơn hàng chưa sẵn sàng');
    }
    const actor = await ports.resolveOrderActor(req, orderId);
    if (!actor) throw new ServiceError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
    return actor;
  }

  function setGuestOrderCookie(res, token, expiresAt) {
    const maxAge = Math.max(0, (new Date(expiresAt).getTime() - Date.now()) / 1000);
    appendSetCookie(res, serializeCookie(config.guestOrderCookieName || 'tl_guest_order', token, {
      httpOnly: true, secure: config.secureCookies ?? process.env.NODE_ENV === 'production',
      sameSite: config.sameSite || 'Lax', path: config.cookiePath || '/api/v1', maxAge,
    }));
  }

  router.post('/checkout/quote', csrf, validateCommerceBody('checkoutQuote'), async (req, res) => {
    return sendSuccess(res, await service.quoteCheckout(await resolveActor(req), req.validatedBody));
  });

  router.post('/orders', csrf, validateCommerceBody('checkoutCreate'), async (req, res) => {
    const result = await service.createOrder(
      await resolveActor(req), req.validatedBody, req.get('Idempotency-Key'), { requestId: res.locals.requestId },
    );
    if (result.guestProofToken) {
      setGuestOrderCookie(res, result.guestProofToken, result.guestAccess.expiresAt);
      delete result.guestProofToken;
    }
    const replay = result.replay === true;
    delete result.replay;
    return replay ? sendSuccess(res, result) : sendCreated(res, result);
  });

  router.post('/order-access/challenges', csrf, validateCommerceBody('orderAccessChallenge'), ...accessChallengeLimiter, async (req, res) => {
    return sendAccepted(res, await service.issueOrderAccessChallenge(req.validatedBody, { requestId: res.locals.requestId }));
  });
  router.post('/order-access/verify', csrf, validateCommerceBody('orderAccessVerify'), ...accessVerifyLimiter, async (req, res) => {
    const result = await service.verifyOrderAccessChallenge(req.validatedBody);
    setGuestOrderCookie(res, result.proofToken, result.expiresAt);
    return sendSuccess(res, { orderId: result.orderId, expiresAt: result.expiresAt.toISOString() });
  });

  router.get('/orders/:id', validateCommerceId, async (req, res) => {
    const actor = await resolveOrderActor(req, req.params.id);
    return sendSuccess(res, await service.getOwnedOrder(actor, req.params.id));
  });
  router.post('/orders/:id/cancel', validateCommerceId, csrf, validateCommerceBody('cancel'), async (req, res) => {
    const actor = await resolveOrderActor(req, req.params.id);
    return sendSuccess(res, await service.cancelOwnedOrder(
      actor, req.params.id, req.validatedBody, req.get('Idempotency-Key'), { requestId: res.locals.requestId },
    ));
  });

  router.get('/account/orders', requireActor, selfOrders, async (req, res) => {
    const filters = validateCommerceFilters(req.query);
    const result = await service.listOwnOrders(req.actor, filters);
    return sendPaginated(res, result.items, paginationMeta(filters.page, filters.limit, result.total));
  });
  router.post('/account/orders/claim', csrf, requireActor, selfOrders, validateCommerceBody('orderClaim'), async (req, res) => {
    if (typeof ports.resolveOrderActor !== 'function') throw new ServiceError(503, 'DATABASE_UNAVAILABLE', 'Xác minh quyền đơn khách chưa sẵn sàng');
    const proofActor = await ports.resolveOrderActor(req, req.validatedBody.orderId);
    return sendSuccess(res, await service.claimGuestOrder(
      { ...req.actor, guestOrderProof: proofActor?.guestOrderProof }, req.validatedBody.orderId, req.get('Idempotency-Key'),
      { requestId: res.locals.requestId },
    ));
  });

  router.get('/staff/orders', operateOrders, async (req, res) => {
    const filters = validateCommerceFilters(req.query);
    const result = await service.listStaffOrders(filters);
    return sendPaginated(res, result.items, paginationMeta(filters.page, filters.limit, result.total));
  });
  router.get('/staff/orders/:id', validateCommerceId, operateOrders, async (req, res) => {
    return sendSuccess(res, await service.getOperationalOrder(req.params.id));
  });
  router.post('/staff/orders/:id/transitions', validateCommerceId, csrf, operateOrders, validateCommerceBody('transition'), async (req, res) => {
    return sendSuccess(res, await service.transitionOrder(
      req.actor, req.params.id, req.validatedBody, req.get('Idempotency-Key'), { requestId: res.locals.requestId },
    ));
  });
  router.post('/staff/orders/:id/shipping-events', validateCommerceId, csrf, operateOrders, validateCommerceBody('shippingEvent'), async (req, res) => {
    return sendSuccess(res, await service.recordShippingEvent(
      req.actor, req.params.id, req.validatedBody, { requestId: res.locals.requestId },
    ));
  });
  router.post('/staff/orders/:id/cod-collection', validateCommerceId, csrf, operateOrders, validateCommerceBody('codCollection'), async (req, res) => {
    return sendSuccess(res, await service.collectCod(
      req.actor, req.params.id, req.validatedBody, req.get('Idempotency-Key'), { requestId: res.locals.requestId },
    ));
  });
  router.post('/admin/products/:productId/inventory-adjustments', validateCommerceProductId, csrf, manageCatalog, validateCommerceBody('inventoryAdjustment'), async (req, res) => {
    return sendSuccess(res, await service.adjustInventory(
      req.actor, req.params.productId, req.validatedBody, req.get('Idempotency-Key'), { requestId: res.locals.requestId },
    ));
  });

  router.commerceService = service;
  router.commerceIdentitySettings = Object.freeze({
    guestOrderCookieName: config.guestOrderCookieName || 'tl_guest_order',
    cookieValue,
  });
  return router;
}
