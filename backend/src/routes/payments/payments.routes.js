import express from 'express';
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/apiResponse.js';
import { ServiceError } from '../../utils/serviceError.js';
import {
  validateIdempotencyKey,
  validatePaymentBody,
  validatePaymentId,
  validateRefundFilters,
} from '../../validators/payments.validator.js';
import { createPaymentsService } from '../../services/payments/payments.service.js';

function requiredMiddleware(value, name) {
  if (typeof value !== 'function') throw new TypeError(`P06 cần P02 identity.${name}`);
  return value;
}

function paginationMeta(page, limit, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export function createPaymentsRouter({ ports = {}, config = {} } = {}) {
  const identity = ports.identity || {};
  const csrf = requiredMiddleware(identity.csrfProtection, 'csrfProtection');
  const requireCapability = requiredMiddleware(identity.requireCapability, 'requireCapability');
  const service = ports.paymentsService || createPaymentsService({ ports, config });
  if (typeof ports.resolveOrderActor !== 'function') throw new TypeError('P06 cần P02 ports.resolveOrderActor');
  const resolveOrderActor = ports.resolveOrderActor;
  const router = express.Router();

  router.post('/orders/:id/payment-attempts',
    validatePaymentId,
    csrf,
    validateIdempotencyKey,
    async (req, res) => {
      // P02 resolves the full session before guest proof and enforces guest.payment.create.
      const actor = await resolveOrderActor(req, req.params.id);
      if (!actor) throw new ServiceError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
      const attempt = await service.createPaymentAttempt(actor, req.params.id, req.idempotencyKey);
      return sendCreated(res, attempt);
    });

  router.get('/orders/:id/payment', validatePaymentId, async (req, res) => {
    // P02 resolves full sessions first and enforces guest.order.read on the exact order.
    const actor = await resolveOrderActor(req, req.params.id);
    if (!actor) throw new ServiceError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
    return sendSuccess(res, await service.paymentStatus(actor, req.params.id));
  });

  router.post('/payments/payos/webhook', async (req, res) => {
    await service.receivePayosWebhook(req.body, { requestId: res.locals.requestId });
    // PayOS retries on non-2xx; the body contains no order or customer data.
    return res.status(200).json({ code: '00', desc: 'success' });
  });

  router.post('/staff/orders/:id/refund-requests',
    validatePaymentId,
    csrf,
    requireCapability('refunds.request'),
    validateIdempotencyKey,
    validatePaymentBody('refundRequest'),
    async (req, res) => sendCreated(res, await service.createRefundRequest(
      req.actor, req.params.id, req.validatedBody, req.idempotencyKey, { requestId: res.locals.requestId },
    )));

  router.get('/admin/refunds', requireCapability('refunds.approve'), validateRefundFilters, async (req, res) => {
    const { items, total } = await service.listRefunds(req.paymentFilters);
    return sendPaginated(res, items, paginationMeta(req.paymentFilters.page, req.paymentFilters.limit, total));
  });

  router.post('/admin/refunds/:id/decision',
    validatePaymentId,
    csrf,
    requireCapability('refunds.approve'),
    validatePaymentBody('refundDecision'),
    async (req, res) => sendSuccess(res, await service.decideRefund(
      req.actor, req.params.id, req.validatedBody, { requestId: res.locals.requestId },
    )));

  router.post('/admin/refunds/:id/complete',
    validatePaymentId,
    csrf,
    requireCapability('refunds.complete'),
    validatePaymentBody('refundComplete'),
    async (req, res) => sendSuccess(res, await service.completeRefund(
      req.actor, req.params.id, req.validatedBody, { requestId: res.locals.requestId },
    )));

  Object.defineProperty(router, 'paymentsService', { value: service, enumerable: false });
  return router;
}
