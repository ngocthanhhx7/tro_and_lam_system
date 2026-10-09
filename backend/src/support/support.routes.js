import express, { Router } from 'express';
import { createIdentityMiddleware } from '../middlewares/identity/identity.middleware.js';
import { cookieValue } from '../services/identity/identity.security.js';
import { assistantGuestOwnerFromRequest } from '../assistant/assistant.routes.js';
import { sendAccepted, sendCreated, sendPaginated, sendSuccess } from '../utils/apiResponse.js';
import { forbidden } from '../utils/serviceError.js';
import { createReviewService } from '../reviews/review.service.js';
import { createSupportHandoffPort, createSupportService } from './support.service.js';
import { validateObjectId } from './support.validators.js';

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
}

function actorOf(req) {
  return req.actor || (req.guestOrderActor ? { ...req.guestOrderActor, role: 'guest', kind: 'guest' } : null);
}

function contextOf(req, res) {
  return { requestId: res.locals.requestId, idempotencyKey: req.get('Idempotency-Key') };
}

function authFrom(ports, config) {
  return ports.identityMiddleware || createIdentityMiddleware({ ports, config });
}

function optionalPrincipal(identity, scopes = ['guest.order.read']) {
  return (req, res, next) => {
    const sessionToken = cookieValue(req, identity.settings.sessionCookieName);
    if (sessionToken) return identity.requireActor(req, res, next);
    if (req.body?.orderId || req.params?.id) {
      return identity.requireGuestOrderProof(scopes)(req, res, next);
    }
    return next();
  };
}

function principalOrGuest(identity, capability, guestScopes = ['guest.order.read']) {
  return (req, res, next) => {
    const sessionToken = cookieValue(req, identity.settings.sessionCookieName);
    if (sessionToken) return identity.requireCapability(capability)(req, res, next);
    return identity.requireGuestOrderProof(guestScopes)(req, res, next);
  };
}

function ticketParticipant(identity, guestScopes = ['guest.order.read']) {
  return (req, res, next) => {
    const sessionToken = cookieValue(req, identity.settings.sessionCookieName);
    if (!sessionToken) return identity.requireGuestOrderProof(guestScopes)(req, res, next);
    return identity.requireActor(req, res, (error) => {
      if (error) return next(error);
      const capability = req.actor?.role === 'staff' ? 'support.operate' : 'self.tickets';
      return identity.requireCapability(capability)(req, res, next);
    });
  };
}

function adminOnly(identity) {
  return (req, res, next) => identity.requireActor(req, res, (error) => {
    if (error) return next(error);
    if (req.actor.role !== 'admin') return next(forbidden());
    return next();
  });
}

export function createSupportRouter({ ports = {}, config = {}, supportService, reviewService } = {}) {
  const identity = authFrom(ports, config);
  const privateStorage = ports.storage || null;
  const support = supportService || createSupportService({ ports, config });
  const reviews = reviewService || createReviewService({ ports, config });
  const router = Router();
  const csrf = identity.csrfProtection;
  const selfTickets = principalOrGuest(identity, 'self.tickets', ['guest.ticket.create']);
  const orderOwner = principalOrGuest(identity, 'self.orders', ['guest.order.read']);
  const staffSupport = identity.requireCapability('support.operate');
  const staffContacts = identity.requireCapability('contacts.operate');
  const admin = adminOnly(identity);
  const selfReviews = identity.requireCapability('self.reviews');

  router.put('/attachments/private/uploads/:token', express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp'],
    limit: '5mb',
  }), asyncRoute(async (req, res) => {
    if (!privateStorage || typeof privateStorage.acceptUpload !== 'function') return res.sendStatus(404);
    const contentType = String(req.get('Content-Type') || '').split(';', 1)[0].trim().toLowerCase();
    await privateStorage.acceptUpload(req.params.token, req.body, contentType);
    return res.sendStatus(204);
  }));

  router.get('/attachments/private/downloads/:token', asyncRoute(async (req, res) => {
    if (!privateStorage || typeof privateStorage.readDownload !== 'function') return res.sendStatus(404);
    const file = await privateStorage.readDownload(req.params.token);
    res.set({
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Length': String(file.buffer.length),
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    });
    return res.type(file.mimeType).send(file.buffer);
  }));

  router.post('/contacts', csrf, optionalPrincipal(identity, ['guest.order.read']), asyncRoute(async (req, res) => {
    return sendAccepted(res, await support.createContact(req.actor || null, req.body, contextOf(req, res)));
  }));

  router.get('/account/reviews', selfReviews, asyncRoute(async (req, res) => {
    const result = await reviews.listOwnReviews(req.actor, req.query);
    return sendPaginated(res, result.items, result.pagination);
  }));
  router.post('/account/reviews', csrf, selfReviews, asyncRoute(async (req, res) => {
    return sendCreated(res, await reviews.createReview(req.actor, req.body, contextOf(req, res)));
  }));
  router.patch('/account/reviews/:id', csrf, selfReviews, asyncRoute(async (req, res) => {
    return sendSuccess(res, await reviews.updateOwnReview(req.actor, validateObjectId(req.params.id), req.body, contextOf(req, res)));
  }));

  router.get('/products/:productId/reviews', asyncRoute(async (req, res) => {
    const result = await reviews.listPublishedProductReviews(req.params.productId, req.query);
    return sendPaginated(res, result.items, result.pagination);
  }));

  router.get('/account/tickets', identity.requireCapability('self.tickets'), asyncRoute(async (req, res) => {
    const result = await support.listOwnTickets(req.actor, req.query);
    return sendPaginated(res, result.items, result.pagination);
  }));
  router.post('/tickets', csrf, selfTickets, asyncRoute(async (req, res) => {
    return sendCreated(res, await support.createTicket(actorOf(req), req.body, contextOf(req, res)));
  }));
  router.get('/tickets/:id', ticketParticipant(identity), asyncRoute(async (req, res) => {
    return sendSuccess(res, await support.getTicket(actorOf(req), validateObjectId(req.params.id)));
  }));
  router.get('/tickets/:id/messages', ticketParticipant(identity), asyncRoute(async (req, res) => {
    const result = await support.listTicketMessages(actorOf(req), validateObjectId(req.params.id), req.query);
    return sendSuccess(res, result.items, { meta: { nextCursor: result.nextCursor } });
  }));
  router.post('/tickets/:id/messages', csrf, ticketParticipant(identity), asyncRoute(async (req, res) => {
    return sendCreated(res, await support.createTicketMessage(actorOf(req), validateObjectId(req.params.id), req.body, contextOf(req, res)));
  }));

  router.get('/orders/:id/return-requests', orderOwner, asyncRoute(async (req, res) => {
    return sendSuccess(res, await support.listOwnReturnRequests(actorOf(req), validateObjectId(req.params.id)));
  }));
  router.post('/orders/:id/return-requests', csrf, principalOrGuest(identity, 'self.orders', ['guest.return.request']), asyncRoute(async (req, res) => {
    return sendCreated(res, await support.createReturnRequest(actorOf(req), validateObjectId(req.params.id), req.body, contextOf(req, res)));
  }));

  router.post('/assistant/handoffs', csrf, optionalPrincipal(identity), asyncRoute(async (req, res) => {
    const actor = actorOf(req) || assistantGuestOwnerFromRequest(req, {
      cookieName: config.assistantGuestCookieName || 'tl_assistant_guest',
    });
    return sendAccepted(res, await support.createHandoff(actor, req.body, contextOf(req, res)));
  }));

  router.post('/attachments/uploads', csrf, optionalPrincipal(identity), asyncRoute(async (req, res) => {
    return sendCreated(res, await support.createAttachmentUpload(actorOf(req), req.body));
  }));
  router.post('/attachments/:id/finalize', csrf, optionalPrincipal(identity), asyncRoute(async (req, res) => {
    return sendSuccess(res, await support.finalizeAttachment(actorOf(req), validateObjectId(req.params.id)));
  }));
  router.get('/attachments/:id/download', optionalPrincipal(identity), asyncRoute(async (req, res) => {
    const url = await support.downloadAttachment(actorOf(req), validateObjectId(req.params.id));
    return res.redirect(302, url);
  }));

  router.get('/staff/tickets', staffSupport, asyncRoute(async (req, res) => {
    const result = await support.listStaffTickets(req.query);
    return sendPaginated(res, result.items, result.pagination);
  }));
  router.patch('/staff/tickets/:id', csrf, staffSupport, asyncRoute(async (req, res) => {
    return sendSuccess(res, await support.updateStaffTicket(req.actor, validateObjectId(req.params.id), req.body, contextOf(req, res)));
  }));
  router.get('/staff/return-requests', staffSupport, asyncRoute(async (req, res) => {
    const result = await support.listStaffReturnRequests(req.query);
    return sendPaginated(res, result.items, result.pagination);
  }));
  router.post('/staff/return-requests/:id/decision', csrf, staffSupport, asyncRoute(async (req, res) => {
    return sendSuccess(res, await support.decideReturn(req.actor, validateObjectId(req.params.id), req.body, contextOf(req, res)));
  }));
  router.post('/staff/return-requests/:id/inspection', csrf, staffSupport, asyncRoute(async (req, res) => {
    return sendSuccess(res, await support.inspectReturn(req.actor, validateObjectId(req.params.id), req.body, contextOf(req, res)));
  }));
  router.post('/staff/return-requests/:id/close', csrf, staffSupport, asyncRoute(async (req, res) => {
    return sendSuccess(res, await support.closeReturn(req.actor, validateObjectId(req.params.id), req.body, contextOf(req, res)));
  }));
  router.get('/staff/contacts', staffContacts, asyncRoute(async (req, res) => {
    const result = await support.listStaffContacts(req.query);
    return sendPaginated(res, result.items, result.pagination);
  }));
  router.patch('/staff/contacts/:id', csrf, staffContacts, asyncRoute(async (req, res) => {
    return sendSuccess(res, await support.updateStaffContact(req.actor, validateObjectId(req.params.id), req.body, contextOf(req, res)));
  }));

  router.get('/admin/reviews', admin, asyncRoute(async (req, res) => {
    const result = await reviews.listAdminReviews(req.query);
    return sendPaginated(res, result.items, result.pagination);
  }));
  router.post('/admin/reviews/:id/moderation', csrf, admin, asyncRoute(async (req, res) => {
    return sendSuccess(res, await reviews.moderateReview(req.actor, validateObjectId(req.params.id), req.body, contextOf(req, res)));
  }));

  router.supportService = support;
  router.reviewService = reviews;
  router.supportHandoffPort = createSupportHandoffPort(support);
  return router;
}

export function createSupportRouteFragment(dependencies) {
  return { prefix: '', router: createSupportRouter(dependencies) };
}

export function createSupportPorts(dependencies) {
  const router = createSupportRouter(dependencies);
  return Object.freeze({ supportService: router.supportService, reviewService: router.reviewService, handoffPort: router.supportHandoffPort });
}
