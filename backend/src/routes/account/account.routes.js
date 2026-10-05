import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { ServiceError } from '../../utils/serviceError.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../utils/apiResponse.js';
import { createIdentityMiddleware } from '../../middlewares/identity/identity.middleware.js';
import { createAccountService, hashGuestCartToken } from '../../services/account/account.service.js';
import {
  validateAddressId,
  validateAddressWrite,
  validateCartItemWrite,
  validateCartMerge,
  validateExpectedVersion,
  validateReverseLocation,
} from '../../validators/account/account.validator.js';
import {
  appendSetCookie,
  clearCookie,
  cookieValue,
  serializeCookie,
} from '../../services/identity/identity.security.js';

function guestTokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createAccountRouter({ ports = {}, config = {} } = {}) {
  if (typeof config.csrfSecret !== 'string' || config.csrfSecret.length < 32) {
    throw new TypeError('P03 config.csrfSecret phải có ít nhất 32 ký tự ngẫu nhiên');
  }
  const router = express.Router();
  const service = ports.accountService || createAccountService({ ports, config });
  const identity = ports.identityMiddleware || createIdentityMiddleware({ ports, config });
  const { requireCapability, csrfProtection, settings } = identity;
  const requireAddressAccess = requireCapability('self.addresses');
  const cookieName = config.guestCartCookieName || 'tl_guest_cart';
  const guestCookieOptions = {
    httpOnly: true,
    secure: settings.secureCookies,
    sameSite: settings.sameSite,
    path: settings.cookiePath,
    maxAge: Math.floor((config.cartTtlMs || 30 * 24 * 60 * 60 * 1000) / 1000),
  };

  function setGuestCookie(res, token) {
    appendSetCookie(res, serializeCookie(cookieName, token, guestCookieOptions));
  }

  async function resolveCartActor(req, res, next) {
    try {
      const sessionToken = cookieValue(req, settings.sessionCookieName);
      if (sessionToken) {
        req.cartActor = await identity.service.authenticateSession(sessionToken);
        return next();
      }

      let token = cookieValue(req, cookieName);
      if (!token) token = randomBytes(32).toString('base64url');
      let tokenHash = guestTokenHash(token);
      if (await service.guestCartWasMerged(tokenHash)) {
        token = randomBytes(32).toString('base64url');
        tokenHash = guestTokenHash(token);
      }
      setGuestCookie(res, token);
      req.cartActor = { kind: 'guest', guestTokenHash: tokenHash };
      return next();
    } catch (error) {
      return next(error);
    }
  }

  function requireCartAccount(req, _res, next) {
    if (req.cartActor?.kind === 'guest') return next(new ServiceError(401, 'AUTH_REQUIRED', 'Đăng nhập để gộp giỏ hàng'));
    if (!req.cartActor?.id) return next(new ServiceError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để tiếp tục'));
    return next();
  }

  router.get('/account/addresses', requireAddressAccess, async (req, res) => {
    return sendSuccess(res, await service.listAddresses(req.actor));
  });
  router.post('/account/addresses', csrfProtection, requireAddressAccess, async (req, res) => {
    const input = validateAddressWrite(req.body);
    return sendCreated(res, await service.createAddress(req.actor, input));
  });
  router.patch('/account/addresses/:id', csrfProtection, requireAddressAccess, async (req, res) => {
    const id = validateAddressId(req.params.id);
    const input = validateAddressWrite(req.body, { partial: true });
    return sendSuccess(res, await service.updateAddress(req.actor, id, input));
  });
  router.delete('/account/addresses/:id', csrfProtection, requireAddressAccess, async (req, res) => {
    const id = validateAddressId(req.params.id);
    const expectedVersion = validateExpectedVersion(req.query.expectedVersion);
    await service.deleteAddress(req.actor, id, expectedVersion);
    return sendNoContent(res);
  });
  router.post('/account/addresses/:id/default', csrfProtection, requireAddressAccess, async (req, res) => {
    const id = validateAddressId(req.params.id);
    const expectedVersion = validateExpectedVersion(req.body?.expectedVersion);
    return sendSuccess(res, await service.setDefaultAddress(req.actor, id, expectedVersion));
  });
  router.post('/locations/reverse', csrfProtection, requireAddressAccess, async (req, res) => {
    const input = validateReverseLocation(req.body);
    return sendSuccess(res, await service.reverseGeocode(input));
  });

  router.get('/cart', resolveCartActor, async (req, res) => sendSuccess(res, await service.getCart(req.cartActor)));
  router.put('/cart/items/:productId', csrfProtection, resolveCartActor, async (req, res) => {
    const input = validateCartItemWrite(req.body);
    return sendSuccess(res, await service.setCartItemQuantity(req.cartActor, req.params.productId, input.quantity, input.expectedVersion));
  });
  router.delete('/cart/items/:productId', csrfProtection, resolveCartActor, async (req, res) => {
    const expectedVersion = validateExpectedVersion(req.query.expectedVersion);
    return sendSuccess(res, await service.removeCartItem(req.cartActor, req.params.productId, expectedVersion));
  });
  router.post('/cart/merge', csrfProtection, resolveCartActor, requireCartAccount, async (req, res) => {
    const input = validateCartMerge(req.body);
    const token = cookieValue(req, cookieName);
    if (!token) return sendSuccess(res, await service.getCart(req.cartActor));
    const cart = await service.mergeGuestCart(req.cartActor, hashGuestCartToken(token), input.expectedVersion);
    clearCookie(res, cookieName, {
      secure: settings.secureCookies,
      sameSite: settings.sameSite,
      path: settings.cookiePath,
    });
    return sendSuccess(res, cart);
  });

  router.accountService = service;
  router.identityMiddleware = identity;
  return router;
}
