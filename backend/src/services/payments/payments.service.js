import { createHash, randomInt } from 'node:crypto';
import { ServiceError } from '../../utils/serviceError.js';
import { createPayosAdapter, PayosAdapterError } from '../integrations/payos/payos.adapter.js';
import { PaymentsRepository } from './payments.repository.js';

const idOf = (value) => String(value?._id ?? value?.id ?? value);
const PAYABLE_STATUSES = new Set(['paid', 'partially_refunded', 'refund_pending']);

function fail(status, code, message) {
  throw new ServiceError(status, code, message);
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeAttempt(attempt) {
  return {
    attemptId: idOf(attempt),
    ...(attempt.checkoutUrl ? { checkoutUrl: attempt.checkoutUrl } : {}),
    expiresAt: new Date(attempt.expiresAt).toISOString(),
    status: attempt.status,
  };
}

function safeRefund(refund) {
  return {
    id: idOf(refund),
    orderId: idOf(refund.orderId),
    ...(refund.paymentAttemptId ? { paymentAttemptId: idOf(refund.paymentAttemptId) } : {}),
    amountVnd: refund.amountVnd,
    status: refund.status,
    reason: refund.reason,
    ...(refund.requestedBy ? { requestedBy: idOf(refund.requestedBy) } : {}),
    ...(refund.approvedBy ? { approvedBy: idOf(refund.approvedBy) } : {}),
    ...(refund.externalReference ? { externalReference: refund.externalReference } : {}),
    ...(refund.evidenceReference ? { evidenceReference: refund.evidenceReference } : {}),
    ...(refund.outcomeReason ? { outcomeReason: refund.outcomeReason } : {}),
    ...(refund.outcomeReasonCode ? { outcomeReasonCode: refund.outcomeReasonCode } : {}),
    createdAt: new Date(refund.createdAt).toISOString(),
    updatedAt: new Date(refund.updatedAt).toISOString(),
    version: refund.version,
  };
}

function providerOrderCode(now) {
  const candidate = now.getTime() * 1000 + randomInt(0, 1000);
  if (!Number.isSafeInteger(candidate) || candidate < 1) throw new RangeError('Payment order code exceeds safe integer range');
  return candidate;
}

function orderIdFrom(order) {
  return idOf(order?._id ?? order?.id);
}

function paymentContextService(ports) {
  return ports.commerceService || ports.commerce?.service;
}

function outboxPort(ports) {
  return ports.outbox?.appendOutbox || ports.appendOutbox;
}

function auditPort(ports) {
  return ports.outbox?.appendAudit || ports.audit?.appendAudit || ports.appendAudit;
}

function mailPort(ports) {
  return ports.outbox?.enqueueMail || ports.enqueueMail;
}

export function createPaymentsService({ ports = {}, config = {}, provider: suppliedProvider, repository: suppliedRepository } = {}) {
  const repository = suppliedRepository || ports.repository || new PaymentsRepository(ports.models);
  const provider = suppliedProvider || ports.provider || createPayosAdapter({
    config: config.payos || {
      enabled: config.payosEnabled,
      clientId: config.payosClientId,
      apiKey: config.payosApiKey,
      checksumKey: config.payosChecksumKey,
      timeoutMs: config.payosTimeoutMs,
    },
    fetchImpl: ports.fetchImpl,
    now: ports.now || (() => new Date()),
  });
  const commerce = paymentContextService(ports);
  const now = () => (ports.now ? ports.now() : new Date());
  if (!commerce || typeof commerce.getOwnedOrder !== 'function' || typeof commerce.getPaymentContext !== 'function'
    || typeof commerce.getOperationalOrder !== 'function' || typeof commerce.applyVerifiedPayment !== 'function'
    || typeof commerce.applyRefundAggregate !== 'function') {
    throw new TypeError('P06 cần P05 commerce order, verified-payment, payment-context và refund-aggregate ports');
  }

  async function appendOutbox(event, session) {
    const append = outboxPort(ports);
    if (typeof append !== 'function') fail(503, 'DATABASE_UNAVAILABLE', 'Outbox thanh toán chưa sẵn sàng');
    await append(event, { session });
  }

  async function appendAudit(event, session) {
    const append = auditPort(ports);
    if (typeof append !== 'function') fail(503, 'DATABASE_UNAVAILABLE', 'Audit thanh toán chưa sẵn sàng');
    await append(event, { session });
  }

  function updateEventKey(orderId, eventKey, channel) {
    return `operations:payment:${hash(`${orderId}:${eventKey}:${channel}`).slice(0, 48)}`;
  }

  async function enqueueCustomerOrderUpdate(orderId, eventKey, status, session) {
    const order = await commerce.getOperationalOrder(orderId, { session });
    if (!order) return;
    const mail = mailPort(ports);
    if (order.recipient?.email) {
      if (typeof mail !== 'function') fail(503, 'MAIL_UNAVAILABLE', 'Hàng đợi cập nhật đơn hàng chưa sẵn sàng');
      await mail('order_update', order.recipient.email, {
        orderCode: order.code,
        status,
      }, { session, eventKey: updateEventKey(orderId, eventKey, 'mail') });
    }
    if (!order.userId) return;
    const eventKeyForNotification = updateEventKey(orderId, eventKey, 'notification');
    await appendOutbox({
      eventKey: eventKeyForNotification,
      type: 'operations.delivery',
      aggregateType: 'order',
      aggregateId: String(orderId),
      aggregateVersion: Number.isSafeInteger(order.version) ? order.version : 0,
      payload: { deliveries: [{ notification: {
        recipients: [String(order.userId)],
        category: 'order',
        title: 'Cập nhật đơn hàng',
        body: `${status}. Mã đơn ${order.code}.`,
        href: `/tai-khoan/don-hang/${orderId}`,
      } }] },
    }, session);
  }

  async function recordPaymentAudit({ actor, requestId, orderId, attempt, action, outcome, reasonCode, amountVnd }, session) {
    await appendAudit({
      ...(actor?.id ? { actorId: actor.id } : {}),
      ...(actor?.role ? { actorRole: actor.role } : {}),
      requestId: requestId || 'payment-provider-event',
      action,
      targetType: orderId ? 'order' : 'payment_attempt',
      targetId: String(orderId || attempt?.id || attempt?._id || attempt?.providerOrderCode),
      outcome,
      ...(reasonCode ? { reasonCode } : {}),
      ...(amountVnd ? { changesRedacted: { amountVnd } } : {}),
      createdAt: now(),
    }, session);
  }

  async function preparePaymentAttempt(actor, orderId, requestKey) {
    if (typeof requestKey !== 'string' || requestKey.length < 22 || requestKey.length > 200) {
      fail(400, 'VALIDATION_ERROR', 'Thiếu khóa chống lặp hợp lệ');
    }
    if (typeof provider.isConfigured !== 'function' || !provider.isConfigured()) {
      fail(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Thanh toán trực tuyến hiện chưa được cấu hình');
    }
    const sessionResult = await repository.transaction(async (session) => {
      const context = await commerce.getPaymentContext(actor, orderId, { session });
      const order = context?.order;
      const reservation = context?.reservation;
      if (!order || orderIdFrom(order) !== String(orderId)) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
      const existing = await repository.findAttempt(orderId, requestKey, { session });
      if (existing) {
        if (existing.amountVnd !== order.totalVnd) fail(409, 'IDEMPOTENCY_CONFLICT', 'Khóa đã được dùng cho nội dung khác');
        if (existing.status !== 'pending' || existing.checkoutUrl) {
          return { attempt: existing, order, expiresAt: new Date(existing.expiresAt), replay: true };
        }
      }
      if (order.paymentMethod !== 'payos' || !['pending', 'failed', 'expired', 'cancelled'].includes(order.paymentStatus)
        || order.status !== 'pending') {
        fail(409, 'INVALID_TRANSITION', 'Đơn hàng hiện không thể tạo liên kết thanh toán');
      }
      if (!reservation || reservation.status !== 'held' || !reservation.expiresAt) {
        fail(409, 'INVALID_TRANSITION', 'Đơn hàng không còn giữ tồn kho để thanh toán');
      }
      const expiresAt = new Date(reservation.expiresAt);
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now()) {
        fail(409, 'PAYMENT_ATTEMPT_EXPIRED', 'Thời hạn thanh toán của đơn đã kết thúc');
      }
      if (existing) return { attempt: existing, order, expiresAt, replay: true };
      const active = await repository.findActiveAttempt(orderId, { session });
      if (active) fail(409, 'PAYMENT_ATTEMPT_EXISTS', 'Đơn đã có một liên kết thanh toán đang hoạt động');
      const priorReview = await repository.findReviewEvent(orderId, { session });
      if (priorReview) fail(409, 'PAYMENT_REVIEW_REQUIRED', 'Đơn hàng đang được đối soát thủ công');
      const attempt = await repository.createAttempt({
        orderId,
        provider: 'payos',
        providerOrderCode: (ports.newProviderOrderCode || providerOrderCode)(now()),
        status: 'pending',
        providerState: 'unknown',
        amountVnd: order.totalVnd,
        expiresAt,
        requestKey,
        active: true,
        version: 0,
      }, { session });
      return { attempt, order, expiresAt, replay: false };
    });
    return sessionResult;
  }

  async function persistCreatedLink(attempt, result) {
    return repository.transaction(async (session) => {
      const current = await repository.findAttempt(attempt.orderId, attempt.requestKey, { session });
      if (!current) fail(404, 'NOT_FOUND', 'Không tìm thấy lần thanh toán');
      if (current.paymentLinkId && current.paymentLinkId !== result.paymentLinkId) {
        fail(409, 'PAYMENT_ATTEMPT_CONFLICT', 'Liên kết thanh toán đã được gắn với lần thử khác');
      }
      const saved = await repository.updateAttempt(current._id ?? current.id, current.version, {
        paymentLinkId: result.paymentLinkId,
        checkoutUrl: result.checkoutUrl,
        providerState: result.status,
        lastCheckedAt: now(),
      }, { session });
      if (!saved) fail(409, 'VERSION_CONFLICT', 'Lần thanh toán đã thay đổi');
      return saved;
    });
  }

  async function createPaymentAttempt(actor, orderId, requestKey) {
    if (typeof orderId !== 'string' || !/^[a-f0-9]{24}$/iu.test(orderId)) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
    const prepared = await preparePaymentAttempt(actor, orderId, requestKey);
    if (prepared.attempt.checkoutUrl && prepared.attempt.paymentLinkId) return safeAttempt(prepared.attempt);
    if (prepared.attempt.status !== 'pending') return safeAttempt(prepared.attempt);
    const currentTime = now();
    if (prepared.expiresAt <= currentTime) {
      fail(409, 'PAYMENT_ATTEMPT_EXPIRED', 'Thời hạn thanh toán của đơn đã kết thúc');
    }
    try {
      const existingRemote = prepared.attempt.paymentLinkId
        ? await provider.getLink(prepared.attempt)
        : { status: 'unknown' };
      if (existingRemote.status === 'pending' && existingRemote.checkoutUrl) {
        const restored = await persistCreatedLink(prepared.attempt, {
          paymentLinkId: existingRemote.paymentLinkId,
          checkoutUrl: existingRemote.checkoutUrl,
          status: 'pending',
        });
        return safeAttempt(restored);
      }
      if (existingRemote.status === 'paid') {
        await reconcileProviderFact(prepared.attempt, existingRemote, { requestId: 'payment-attempt-retry' });
        fail(409, 'PAYMENT_ALREADY_SETTLED', 'Khoản thanh toán đang được đối soát');
      }
      if (prepared.attempt.paymentLinkId) {
        if (['failed', 'expired', 'cancelled'].includes(existingRemote.status)) {
          fail(409, 'PAYMENT_ATTEMPT_TERMINAL', 'Liên kết thanh toán hiện không còn hoạt động');
        }
        fail(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Chưa thể xác minh liên kết thanh toán hiện tại. Vui lòng thử lại sau.');
      }
      const webOrigin = config.publicWebUrl;
      let returnUrl;
      let cancelUrl;
      try {
        const returnTarget = new URL('/payment/return', webOrigin);
        const cancelTarget = new URL('/payment/cancel', webOrigin);
        returnTarget.searchParams.set('orderId', orderId);
        cancelTarget.searchParams.set('orderId', orderId);
        returnUrl = returnTarget.toString();
        cancelUrl = cancelTarget.toString();
      } catch { fail(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'URL trả về thanh toán chưa được cấu hình'); }
      const link = await provider.createLink({
        ...(prepared.attempt.toObject ? prepared.attempt.toObject() : prepared.attempt),
        providerOrderCode: prepared.attempt.providerOrderCode,
        amountVnd: prepared.attempt.amountVnd,
        expiresAt: prepared.expiresAt,
        description: `TL${String(orderId).slice(-8).toUpperCase()}`,
        returnUrl,
        cancelUrl,
      });
      const saved = await persistCreatedLink(prepared.attempt, link);
      return safeAttempt(saved);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      if (error instanceof PayosAdapterError) {
        throw new ServiceError(503, error.code === 'PAYMENT_PROVIDER_UNAVAILABLE' ? error.code : 'PAYMENT_PROVIDER_UNAVAILABLE', 'Cổng thanh toán hiện chưa phản hồi. Đơn hàng vẫn được giữ để thử lại.');
      }
      if (error?.code === 11000) fail(409, 'PAYMENT_ATTEMPT_EXISTS', 'Đơn đã có lần thanh toán khác đang được xử lý');
      throw error;
    }
  }

  async function paymentStatus(actor, orderId) {
    const order = await commerce.getOwnedOrder(actor, orderId);
    const review = await repository.findLatestReviewEvent(orderId);
    return {
      paymentStatus: order.paymentStatus,
      paidAmountVnd: order.paidAmountVnd,
      refundedAmountVnd: order.refundedAmountVnd,
      reviewRequired: Boolean(order.paymentReview?.required || review),
    };
  }

  async function saveProviderEvent(fact, context = {}) {
    const timestamp = now();
    try {
      return await repository.transaction(async (session) => {
        const existingEvent = await repository.findEvent('payos', fact.providerEventKey, { session });
        if (existingEvent) return { duplicate: true, event: existingEvent };
        const attempt = await repository.findAttemptByProviderOrderCode(fact.providerOrderCode, { session });
        const event = await repository.createEvent({
          provider: 'payos',
          dedupeKey: fact.providerEventKey,
          ...(attempt ? { attemptId: attempt._id ?? attempt.id, orderId: attempt.orderId } : {}),
          providerOrderCode: fact.providerOrderCode,
          paymentLinkId: fact.paymentLinkId,
          payloadDigest: fact.payloadDigest,
          receivedAt: timestamp,
          verifiedAt: timestamp,
          processingState: 'received',
          amountVnd: fact.amountVnd,
        }, { session });
        let processingState = 'rejected';
        let reasonCode = 'PAYMENT_ATTEMPT_NOT_FOUND';
        let applied = false;
        let reviewRequired = false;
        if (attempt && (attempt.paymentLinkId === fact.paymentLinkId || !attempt.paymentLinkId)) {
          if (fact.status !== 'paid') {
            reasonCode = 'PAYMENT_NOT_SETTLED';
          } else if (fact.currency !== 'VND') {
            processingState = 'review';
            reasonCode = 'PAYMENT_CURRENCY_MISMATCH';
            reviewRequired = true;
          } else {
            const orderId = idOf(attempt.orderId);
            const result = await commerce.applyVerifiedPayment({
              provider: 'payos', status: 'paid', currency: 'VND', amountVnd: fact.amountVnd, orderId,
            }, { session });
            applied = result?.applied ?? result?.order !== undefined;
            reviewRequired = result?.reviewRequired === true;
            processingState = reviewRequired ? 'review' : (applied || result?.order) ? 'applied' : 'review';
            reasonCode = reviewRequired
              ? (fact.amountVnd === attempt.amountVnd ? 'LATE_PAYMENT_STOCK_REVIEW' : 'PAYMENT_AMOUNT_MISMATCH')
              : undefined;
            const updatedAttempt = await repository.updateAttempt(attempt._id ?? attempt.id, attempt.version, {
              status: 'paid', providerState: 'paid', active: false, lastCheckedAt: timestamp,
              ...(attempt.paymentLinkId ? {} : { paymentLinkId: fact.paymentLinkId }),
            }, { session });
            if (!updatedAttempt) fail(409, 'VERSION_CONFLICT', 'Lần thanh toán đã thay đổi');
            if (applied && !reviewRequired) {
              await enqueueCustomerOrderUpdate(orderId, `payment:${attempt.providerOrderCode}`, 'Đã xác nhận thanh toán', session);
            } else if (reviewRequired) {
              await enqueueCustomerOrderUpdate(orderId, `payment-review:${attempt.providerOrderCode}`, 'Khoản thanh toán đang được kiểm tra; đơn hàng chưa được xác nhận giao', session);
            }
          }
        } else if (attempt) {
          processingState = 'review';
          reasonCode = 'PAYMENT_LINK_MISMATCH';
          reviewRequired = true;
        }
        if (attempt && fact.status === 'paid' && fact.currency !== 'VND'
          && attempt.paymentLinkId === fact.paymentLinkId) {
          const updatedAttempt = await repository.updateAttempt(attempt._id ?? attempt.id, attempt.version, {
            status: 'paid', providerState: 'paid', active: false, lastCheckedAt: timestamp,
          }, { session });
          if (!updatedAttempt) fail(409, 'VERSION_CONFLICT', 'Lần thanh toán đã thay đổi');
        }
        await repository.updateEvent(event._id ?? event.id, {
          processingState,
          ...(reasonCode ? { reasonCode } : {}),
        }, { session });
        await recordPaymentAudit({
          requestId: context.requestId,
          orderId: attempt ? idOf(attempt.orderId) : undefined,
          attempt,
          action: processingState === 'applied' ? 'payment.webhook.applied' : 'payment.webhook.review',
          outcome: processingState === 'applied' ? 'success' : processingState,
          reasonCode,
          amountVnd: fact.amountVnd,
        }, session);
        return { duplicate: false, applied, reviewRequired, processingState, reasonCode };
      });
    } catch (error) {
      if (error?.code === 11000) {
        const prior = await repository.findEvent('payos', fact.providerEventKey).catch(() => null);
        if (prior) return { duplicate: true, event: prior };
      }
      throw error;
    }
  }

  async function receivePayosWebhook(body, context = {}) {
    if (typeof provider.isConfigured !== 'function' || !provider.isConfigured()) {
      fail(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Thanh toán trực tuyến hiện chưa được cấu hình');
    }
    let fact;
    try { fact = provider.verifyWebhook(body); }
    catch (error) {
      if (error instanceof PayosAdapterError && error.code === 'PAYOS_SIGNATURE_INVALID') {
        fail(401, 'PAYOS_SIGNATURE_INVALID', 'Chữ ký thông báo thanh toán không hợp lệ');
      }
      if (error instanceof PayosAdapterError) fail(400, 'PAYOS_WEBHOOK_INVALID', 'Thông báo thanh toán chưa hợp lệ');
      throw error;
    }
    return saveProviderEvent(fact, context);
  }

  async function reconcileProviderFact(attempt, remote, context = {}) {
    const payload = {
      attemptId: idOf(attempt),
      paymentLinkId: remote.paymentLinkId,
      status: remote.status,
      amountVnd: remote.amountPaidVnd ?? remote.amountVnd,
    };
    const payloadDigest = hash(JSON.stringify(payload));
    const fact = {
      provider: 'payos',
      providerEventKey: `reconcile:${hash(`${attempt.paymentLinkId}:${remote.status}:${payloadDigest}`).slice(0, 64)}`,
      providerOrderCode: attempt.providerOrderCode,
      paymentLinkId: remote.paymentLinkId,
      amountVnd: remote.amountPaidVnd ?? remote.amountVnd,
      currency: remote.currency || 'VND',
      status: remote.status === 'paid' ? 'paid' : 'unsettled',
      occurredAt: now(),
      payloadDigest,
    };
    return saveProviderEvent(fact, context);
  }

  async function reconcileAttempt(attempt) {
    if (!attempt) return 'expired';
    if (attempt.status !== 'pending') return attempt.status;
    if (!attempt.paymentLinkId) return 'unknown';
    if (typeof provider.isConfigured !== 'function' || !provider.isConfigured()) return 'unknown';
    const orderId = idOf(attempt.orderId);
    try {
      const remote = await provider.getLink(attempt);
      if (remote.status === 'paid') {
        await reconcileProviderFact(attempt, remote, { requestId: 'payment-reconciliation-worker' });
      } else if (['expired', 'failed', 'cancelled'].includes(remote.status)) {
        await repository.transaction(async (session) => {
          const current = await repository.findAttemptByProviderOrderCode(attempt.providerOrderCode, { session });
          if (!current || current.status !== 'pending') return;
          const changed = await repository.updateAttempt(current._id ?? current.id, current.version, {
            status: remote.status, providerState: remote.status, active: false, lastCheckedAt: now(),
          }, { session });
          if (changed) await recordPaymentAudit({
            requestId: 'payment-reconciliation-worker', orderId, attempt: current,
            action: 'payment.reconciliation.terminal', outcome: 'success',
            reasonCode: `PROVIDER_${remote.status.toUpperCase()}`,
          }, session);
        });
      } else {
        await repository.transaction(async (session) => {
          const current = await repository.findAttemptByProviderOrderCode(attempt.providerOrderCode, { session });
          if (current?.status === 'pending') await repository.updateAttempt(current._id ?? current.id, current.version, {
            providerState: remote.status === 'pending' ? 'pending' : 'unknown', lastCheckedAt: now(),
          }, { session });
        });
      }
      return remote.status;
    } catch {
      return 'unknown';
    }
  }

  async function getReservationExpiryStatus(order) {
    const orderId = orderIdFrom(order);
    const attempt = await repository.findActiveAttempt(orderId) || await repository.findLatestAttempt(orderId);
    return reconcileAttempt(attempt);
  }

  async function reconcilePendingAttempts({ batchSize = 100 } = {}) {
    const minimumAgeMs = Number.isSafeInteger(config.reconciliationMinimumAgeMs) && config.reconciliationMinimumAgeMs >= 0
      ? config.reconciliationMinimumAgeMs : 60_000;
    const rows = await repository.listPendingAttempts({
      olderThan: new Date(now().getTime() - minimumAgeMs),
      limit: Math.min(500, Math.max(1, batchSize)),
    });
    const result = { checked: 0, paid: 0, terminal: 0, pending: 0, deferred: 0 };
    for (const attempt of rows) {
      result.checked += 1;
      if (!attempt.paymentLinkId) { result.deferred += 1; continue; }
      try {
        const status = await reconcileAttempt(attempt);
        if (status === 'paid') result.paid += 1;
        else if (['expired', 'failed', 'cancelled'].includes(status)) result.terminal += 1;
        else if (status === 'pending') result.pending += 1;
        else result.deferred += 1;
      } catch { result.deferred += 1; }
    }
    return result;
  }

  async function prepareRefundOrder(orderId, session) {
    const order = await commerce.getOperationalOrder(orderId, { session });
    if (!order || orderIdFrom(order) !== String(orderId)) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
    if (!PAYABLE_STATUSES.has(order.paymentStatus) || !Number.isSafeInteger(order.paidAmountVnd)
      || order.paidAmountVnd < 1 || order.refundedAmountVnd > order.paidAmountVnd) {
      fail(422, 'INVALID_TRANSITION', 'Đơn hàng chưa có khoản tiền đủ điều kiện hoàn');
    }
    return order;
  }

  async function syncRefundAggregate(orderId, session) {
    const order = await prepareRefundOrder(orderId, session);
    const totals = await repository.refundTotals(orderId, { session });
    const newVersion = await commerce.applyRefundAggregate(orderId, {
      expectedVersion: order.version,
      refundedAmountVnd: totals.completedVnd,
      hasInFlightRefund: totals.hasInFlightRefund,
    }, { session });
    return { order: newVersion, totals };
  }

  async function createRefundRequest(actor, orderId, input, requestKey, context = {}) {
    if (!actor?.id || !['staff', 'admin'].includes(actor.role)) fail(403, 'FORBIDDEN', 'Chỉ nhân viên được yêu cầu hoàn tiền');
    if (typeof orderId !== 'string' || !/^[a-f0-9]{24}$/iu.test(orderId)) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
    if (!input || !Number.isSafeInteger(input.amountVnd) || input.amountVnd < 1
      || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 1000
      || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
      fail(400, 'VALIDATION_ERROR', 'Yêu cầu hoàn tiền chưa hợp lệ');
    }
    if (typeof requestKey !== 'string' || requestKey.length < 22 || requestKey.length > 200) {
      fail(400, 'VALIDATION_ERROR', 'Thiếu khóa chống lặp hợp lệ');
    }
    const payloadHash = hash(JSON.stringify({
      actorId: actor.id, amountVnd: input.amountVnd, reason: input.reason.trim(), expectedVersion: input.expectedVersion,
    }));
    try {
      return await repository.transaction(async (session) => {
        const existing = await repository.findRefundByKey(orderId, requestKey, { session });
        if (existing) {
          if (existing.requestPayloadHash !== payloadHash) fail(409, 'IDEMPOTENCY_CONFLICT', 'Khóa đã được dùng cho nội dung khác');
          return safeRefund(existing);
        }
        const order = await prepareRefundOrder(orderId, session);
        if (String(order.userId || '') === String(actor.id)) fail(403, 'FORBIDDEN', 'Không thể yêu cầu hoàn tiền cho đơn của chính mình');
        if (order.version !== input.expectedVersion) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
        const totals = await repository.refundTotals(orderId, { session });
        const refundableBalance = order.paidAmountVnd - totals.completedVnd;
        if (input.amountVnd !== refundableBalance) {
          fail(422, 'PARTIAL_OPERATION_DISABLED', 'Giai đoạn này chỉ hỗ trợ yêu cầu hoàn toàn bộ số dư còn lại');
        }
        if (totals.requestedVnd || totals.inFlightVnd) fail(409, 'REFUND_IN_PROGRESS', 'Đơn hàng đã có yêu cầu hoàn tiền đang mở');
        const priorAttempt = await repository.findLatestAttempt(orderId, { session });
        const refund = await repository.createRefund({
          orderId,
          ...(priorAttempt ? { paymentAttemptId: priorAttempt._id ?? priorAttempt.id } : {}),
          amountVnd: input.amountVnd,
          status: 'requested',
          reason: input.reason.trim(),
          requestedBy: actor.id,
          requestKey,
          requestPayloadHash: payloadHash,
          version: 0,
        }, { session });
        await appendAudit({
          actorId: actor.id, actorRole: actor.role, requestId: context.requestId || 'refund-request',
          action: 'refund.requested', targetType: 'refund', targetId: idOf(refund), outcome: 'success',
          reasonCode: 'STAFF_REFUND_REQUESTED', changesRedacted: { orderId, amountVnd: refund.amountVnd }, createdAt: now(),
        }, session);
        await enqueueCustomerOrderUpdate(orderId, `refund-requested:${idOf(refund)}`, 'Yêu cầu hoàn tiền đã được ghi nhận', session);
        return safeRefund(refund);
      });
    } catch (error) {
      if (error?.code === 11000) {
        const existing = await repository.findRefundByKey(orderId, requestKey).catch(() => null);
        if (existing?.requestPayloadHash === payloadHash) return safeRefund(existing);
        if (existing) fail(409, 'IDEMPOTENCY_CONFLICT', 'Khóa đã được dùng cho nội dung khác');
        fail(409, 'REFUND_IN_PROGRESS', 'Yêu cầu hoàn tiền đang được xử lý');
      }
      throw error;
    }
  }

  async function decideRefund(actor, refundId, input, context = {}) {
    if (!actor?.id || actor.role !== 'admin') fail(403, 'FORBIDDEN', 'Chỉ quản trị viên được quyết định hoàn tiền');
    if (!input || !['approved', 'rejected'].includes(input.decision)
      || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 1000
      || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
      fail(400, 'VALIDATION_ERROR', 'Quyết định hoàn tiền chưa hợp lệ');
    }
    return repository.transaction(async (session) => {
      const refund = await repository.findRefundById(refundId, { session });
      if (!refund) fail(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu hoàn tiền');
      if (refund.version !== input.expectedVersion || refund.status !== 'requested') {
        fail(409, 'VERSION_CONFLICT', 'Yêu cầu hoàn tiền đã thay đổi');
      }
      const approved = input.decision === 'approved';
      const changed = await repository.updateRefund(refund._id ?? refund.id, input.expectedVersion, ['requested'], {
        status: approved ? 'approved' : 'rejected',
        approvedBy: actor.id,
        outcomeReason: input.reason.trim(),
        ...(!approved ? { outcomeReasonCode: 'ADMIN_REJECTED' } : {}),
      }, { session });
      if (!changed) fail(409, 'VERSION_CONFLICT', 'Yêu cầu hoàn tiền đã thay đổi');
      await syncRefundAggregate(idOf(refund.orderId), session);
      await appendAudit({
        actorId: actor.id, actorRole: actor.role, requestId: context.requestId || 'refund-decision',
        action: `refund.${input.decision}`, targetType: 'refund', targetId: idOf(changed), outcome: 'success',
        reasonCode: approved ? 'ADMIN_APPROVED' : 'ADMIN_REJECTED',
        changesRedacted: { orderId: idOf(refund.orderId), amountVnd: changed.amountVnd }, createdAt: now(),
      }, session);
      await enqueueCustomerOrderUpdate(idOf(refund.orderId), `refund:${idOf(changed)}:${changed.version}`, approved
        ? 'Yêu cầu hoàn tiền đã được chấp thuận'
        : 'Yêu cầu hoàn tiền đã bị từ chối', session);
      return safeRefund(changed);
    });
  }

  async function completeRefund(actor, refundId, input, context = {}) {
    if (!actor?.id || actor.role !== 'admin') fail(403, 'FORBIDDEN', 'Chỉ quản trị viên được ghi nhận hoàn tiền');
    if (!input || typeof input.externalReference !== 'string' || !input.externalReference.trim()
      || input.externalReference.length > 500 || typeof input.evidenceReference !== 'string'
      || !input.evidenceReference.trim() || input.evidenceReference.length > 500
      || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
      fail(400, 'VALIDATION_ERROR', 'Bằng chứng hoàn tiền chưa hợp lệ');
    }
    return repository.transaction(async (session) => {
      const refund = await repository.findRefundById(refundId, { session });
      if (!refund) fail(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu hoàn tiền');
      if (refund.version !== input.expectedVersion || !['approved', 'processing'].includes(refund.status)) {
        fail(409, 'VERSION_CONFLICT', 'Yêu cầu hoàn tiền chưa được duyệt hoặc đã thay đổi');
      }
      const changed = await repository.updateRefund(refund._id ?? refund.id, input.expectedVersion, ['approved', 'processing'], {
        status: 'completed',
        externalReference: input.externalReference.trim(),
        evidenceReference: input.evidenceReference.trim(),
      }, { session });
      if (!changed) fail(409, 'VERSION_CONFLICT', 'Yêu cầu hoàn tiền đã thay đổi');
      await syncRefundAggregate(idOf(refund.orderId), session);
      await appendAudit({
        actorId: actor.id, actorRole: actor.role, requestId: context.requestId || 'refund-complete',
        action: 'refund.completed', targetType: 'refund', targetId: idOf(changed), outcome: 'success',
        reasonCode: 'MANUAL_REFUND_EVIDENCE_RECORDED',
        changesRedacted: { orderId: idOf(refund.orderId), amountVnd: changed.amountVnd }, createdAt: now(),
      }, session);
      await enqueueCustomerOrderUpdate(idOf(refund.orderId), `refund:${idOf(changed)}:${changed.version}`, 'Khoản hoàn tiền đã được ghi nhận', session);
      return safeRefund(changed);
    });
  }

  async function failRefund(refundId, reasonCode, context = {}) {
    if (typeof reasonCode !== 'string' || !/^[A-Z0-9_]{1,80}$/u.test(reasonCode)) {
      fail(400, 'VALIDATION_ERROR', 'Mã lý do hoàn tiền thất bại không hợp lệ');
    }
    return repository.transaction(async (session) => {
      const refund = await repository.findRefundById(refundId, { session });
      if (!refund) fail(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu hoàn tiền');
      const changed = await repository.updateRefund(refund._id ?? refund.id, refund.version, ['approved', 'processing'], {
        status: 'failed', outcomeReasonCode: reasonCode,
      }, { session });
      if (!changed) fail(409, 'VERSION_CONFLICT', 'Yêu cầu hoàn tiền đã thay đổi');
      await syncRefundAggregate(idOf(refund.orderId), session);
      await appendAudit({
        ...(context.actor?.id ? { actorId: context.actor.id, actorRole: context.actor.role } : { actorRole: 'system' }),
        requestId: context.requestId || 'refund-failure', action: 'refund.failed', targetType: 'refund',
        targetId: idOf(changed), outcome: 'failure', reasonCode,
        changesRedacted: { orderId: idOf(refund.orderId), amountVnd: changed.amountVnd }, createdAt: now(),
      }, session);
      await enqueueCustomerOrderUpdate(idOf(refund.orderId), `refund:${idOf(changed)}:${changed.version}`, 'Yêu cầu hoàn tiền không hoàn tất và đã được gỡ khỏi số dư chờ xử lý', session);
      return safeRefund(changed);
    });
  }

  async function listRefunds(filters) {
    const { items, total } = await repository.listRefunds(filters);
    return { items: items.map(safeRefund), total };
  }

  async function requestOrderCancellationRefund(input, { session } = {}) {
    if (!session) throw new TypeError('P05 phải gọi requestOrderCancellationRefund bên trong transaction hủy đơn');
    const { orderId, amountVnd, reason, actor, requestKey } = input || {};
    if (typeof orderId !== 'string' && !orderId?._id && !orderId?.id) fail(400, 'VALIDATION_ERROR', 'Đơn hủy chưa hợp lệ');
    const normalizedOrderId = idOf(orderId);
    if (typeof requestKey !== 'string' || requestKey.length < 22 || requestKey.length > 200) {
      fail(400, 'VALIDATION_ERROR', 'Thiếu khóa chống lặp hợp lệ');
    }
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 1000) fail(400, 'VALIDATION_ERROR', 'Nhập lý do hủy đơn hàng');
    const requesterType = ['customer', 'staff', 'admin', 'guest'].includes(actor?.role) ? actor.role : undefined;
    if (!requesterType || (requesterType !== 'guest' && !actor?.id)
      || (requesterType === 'guest' && String(actor.orderId ?? '') !== normalizedOrderId)) {
      fail(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu hủy đơn');
    }
    const requestPayloadHash = hash(JSON.stringify({
      orderId: normalizedOrderId, amountVnd, reason: reason.trim(), requesterType,
    }));
    const existing = await repository.findRefundByKey(normalizedOrderId, requestKey, { session });
    if (existing) {
      if (existing.requestPayloadHash !== requestPayloadHash) fail(409, 'IDEMPOTENCY_CONFLICT', 'Khóa đã được dùng cho nội dung khác');
      return safeRefund(existing);
    }
    const order = await prepareRefundOrder(normalizedOrderId, session);
    const totals = await repository.refundTotals(normalizedOrderId, { session });
    if (totals.requestedVnd || totals.inFlightVnd) fail(409, 'REFUND_IN_PROGRESS', 'Đơn hàng đã có yêu cầu hoàn tiền đang mở');
    const refundableBalance = order.paidAmountVnd - totals.completedVnd;
    if (!Number.isSafeInteger(amountVnd) || amountVnd !== refundableBalance) {
      fail(422, 'PARTIAL_OPERATION_DISABLED', 'Yêu cầu hủy cần hoàn đúng toàn bộ số dư còn lại');
    }
    const priorAttempt = await repository.findLatestAttempt(normalizedOrderId, { session });
    const refund = await repository.createRefund({
      orderId: normalizedOrderId,
      ...(priorAttempt ? { paymentAttemptId: priorAttempt._id ?? priorAttempt.id } : {}),
      amountVnd,
      status: 'requested',
      reason: reason.trim(),
      ...(requesterType === 'guest' ? {} : { requestedBy: actor.id }),
      requesterType,
      requestKey,
      requestPayloadHash,
      version: 0,
    }, { session });
    const requestId = typeof input.requestId === 'string' && /^[A-Za-z0-9._:-]{1,120}$/u.test(input.requestId)
      ? input.requestId : 'order-cancellation';
    await appendAudit({
      ...(actor?.id ? { actorId: actor.id } : {}),
      actorRole: requesterType === 'guest' ? 'system' : requesterType,
      requestId,
      action: 'refund.requested', targetType: 'refund', targetId: idOf(refund), outcome: 'success',
      reasonCode: 'ORDER_CANCELLATION_REFUND',
      changesRedacted: { orderId: normalizedOrderId, amountVnd }, createdAt: now(),
    }, session);
    await enqueueCustomerOrderUpdate(normalizedOrderId, `refund-requested:${idOf(refund)}`, 'Yêu cầu hoàn tiền sau khi hủy đơn đã được ghi nhận', session);
    return safeRefund(refund);
  }

  return Object.freeze({
    repository,
    isConfigured: () => typeof provider.isConfigured === 'function' && provider.isConfigured(),
    createPaymentAttempt,
    paymentStatus,
    receivePayosWebhook,
    getReservationExpiryStatus,
    reconcilePendingAttempts,
    createRefundRequest,
    listRefunds,
    decideRefund,
    completeRefund,
    failRefund,
    requestOrderCancellationRefund,
  });
}
