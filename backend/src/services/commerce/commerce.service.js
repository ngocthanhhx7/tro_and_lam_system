import { createHash, randomBytes, randomInt } from 'node:crypto';
import { ServiceError } from '../../utils/serviceError.js';
import { CommerceRepository } from './commerce.repository.js';

const ORDER_STATUSES = new Set(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned']);
const nowFrom = (ports) => new Date(typeof ports.clock?.now === 'function' ? ports.clock.now() : Date.now());
const idOf = (value) => String(value?._id ?? value?.id ?? value);
const emailOf = (actor) => actor?.user?.emailNormalized ?? actor?.emailNormalized ?? actor?.email;
const hash = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const jsonHash = (value) => hash(stableJson(value));

const TRANSITIONS = Object.freeze({
  pending: new Set(['confirmed', 'cancelled']),
  confirmed: new Set(['processing', 'cancelled']),
  processing: new Set(['shipped', 'cancelled']),
  shipped: new Set(['delivered', 'return_requested']),
  delivered: new Set(['return_requested']),
  cancelled: new Set(),
  return_requested: new Set(),
  returned: new Set(),
});

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fail(status, code, message) {
  throw new ServiceError(status, code, message);
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : '';
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
    fail(400, 'VALIDATION_ERROR', 'Chọn ít nhất một sản phẩm để tiếp tục');
  }
  const normalized = items.map(({ productId, quantity }) => ({ productId: String(productId), quantity }));
  if (normalized.some((item) => !/^[a-f\d]{24}$/iu.test(item.productId)
    || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)) {
    fail(400, 'VALIDATION_ERROR', 'Sản phẩm hoặc số lượng chưa hợp lệ');
  }
  if (new Set(normalized.map((item) => item.productId)).size !== normalized.length) {
    fail(400, 'VALIDATION_ERROR', 'Mỗi sản phẩm chỉ được thêm một lần');
  }
  return normalized.sort((left, right) => left.productId.localeCompare(right.productId));
}

function normalizeRecipient(source, email) {
  const recipient = {
    recipientName: source?.recipientName?.trim(),
    email: normalizeEmail(email ?? source?.email),
    phone: source?.phone?.trim(),
    line1: source?.line1?.trim(),
    ...(source?.line2?.trim() ? { line2: source.line2.trim() } : {}),
    ...(source?.ward?.trim() ? { ward: source.ward.trim() } : {}),
    ...(source?.province?.trim() ? { province: source.province.trim() } : {}),
    countryCode: source?.countryCode,
    ...(source?.postalCode?.trim() ? { postalCode: source.postalCode.trim() } : {}),
    formattedAddress: source?.formattedAddress?.trim(),
    ...(source?.location ? { location: source.location } : {}),
  };
  if (!recipient.recipientName || recipient.recipientName.length > 100
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(recipient.email) || recipient.email.length > 254
    || !recipient.phone || recipient.phone.length > 30 || !recipient.line1 || recipient.line1.length > 200
    || recipient.countryCode !== 'VN' || !recipient.formattedAddress || recipient.formattedAddress.length > 500) {
    fail(400, 'VALIDATION_ERROR', 'Thông tin người nhận chưa đầy đủ hoặc chưa hợp lệ');
  }
  return recipient;
}

function safeProductSnapshot(product, quantity) {
  const productId = idOf(product);
  const unitPriceVnd = product.priceVnd;
  if (product.status !== 'published' || !['buy', 'both'].includes(product.saleMode)
    || !Number.isSafeInteger(unitPriceVnd) || unitPriceVnd < 1 || !product.sku || !product.name) {
    fail(422, 'CHECKOUT_NOT_ALLOWED', 'Một sản phẩm không còn được bán trực tiếp');
  }
  const imageUrl = product.images?.slice().sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url;
  return {
    productId,
    sku: product.sku,
    name: product.name,
    ...(imageUrl ? { imageUrl } : {}),
    quantity,
    unitPriceVnd,
  };
}

function publicOrder(order) {
  const record = order?.toObject ? order.toObject() : order;
  const shipping = record.shipping?.toObject?.() ?? record.shipping;
  return {
    id: idOf(record),
    code: record.code,
    status: record.status,
    paymentStatus: record.paymentStatus,
    paymentMethod: record.paymentMethod,
    recipient: record.recipientSnapshot,
    items: record.itemsSnapshot,
    subtotalVnd: record.subtotalVnd,
    shippingFeeVnd: record.shippingFeeVnd,
    discountVnd: record.discountVnd,
    ...(record.voucherSnapshot ? { voucher: record.voucherSnapshot } : {}),
    totalVnd: record.totalVnd,
    paidAmountVnd: record.paidAmountVnd,
    refundedAmountVnd: record.refundedAmountVnd,
    ...(shipping ? { shipping: {
      ...(shipping.carrier ? { carrier: shipping.carrier } : {}),
      ...(shipping.trackingNumber ? { trackingNumber: shipping.trackingNumber } : {}),
      ...(shipping.events ? { events: shipping.events.map(({ status, message, occurredAt, carrier, trackingNumber }) => ({
        status, message, occurredAt, ...(carrier ? { carrier } : {}), ...(trackingNumber ? { trackingNumber } : {}),
      })) } : {}),
    } } : {}),
    statusHistory: (record.statusHistory || []).map(({ toStatus, createdAt }) => ({ toStatus, createdAt })),
    createdAt: record.createdAt,
    version: record.version,
  };
}

function operationalOrder(order) {
  const record = order?.toObject ? order.toObject() : order;
  return {
    ...publicOrder(record),
    userId: record.userId ? idOf(record.userId) : undefined,
    note: record.note,
    internalNote: record.internalNote,
    paymentReview: record.paymentReview,
  };
}

function orderSummary(order) {
  const record = order?.toObject ? order.toObject() : order;
  return {
    id: idOf(record), code: record.code, status: record.status,
    paymentMethod: record.paymentMethod, paymentStatus: record.paymentStatus,
    itemCount: record.itemsSnapshot.reduce((sum, item) => sum + item.quantity, 0),
    totalVnd: record.totalVnd, createdAt: record.createdAt, version: record.version,
  };
}

function assertValidPaymentMethod(paymentMethod) {
  if (!['cod', 'payos'].includes(paymentMethod)) fail(400, 'VALIDATION_ERROR', 'Phương thức thanh toán chưa hợp lệ');
}

export function createCommerceService({ ports = {}, config = {} } = {}) {
  const repository = ports.repository || new CommerceRepository(ports.models);
  const now = () => nowFrom(ports);
  const orderAccessTtlMs = Number.isSafeInteger(config.orderAccessTtlMs) && config.orderAccessTtlMs > 0
    ? config.orderAccessTtlMs : 10 * 60 * 1000;
  const reservationTtlMs = Number.isSafeInteger(config.reservationTtlMs) && config.reservationTtlMs > 0
    ? config.reservationTtlMs : 15 * 60 * 1000;
  const idempotencyRetentionMs = Number.isSafeInteger(config.idempotencyRetentionMs) && config.idempotencyRetentionMs > 0
    ? config.idempotencyRetentionMs : 7 * 24 * 60 * 60 * 1000;

  async function requireCheckoutPorts({ quote = false } = {}) {
    if (typeof ports.catalog?.getCheckoutProducts !== 'function') {
      fail(503, 'DATABASE_UNAVAILABLE', 'Danh mục sản phẩm chưa sẵn sàng');
    }
    if (typeof ports.settings?.getBusinessSettings !== 'function') {
      fail(503, 'DATABASE_UNAVAILABLE', 'Cấu hình giao hàng và thanh toán chưa sẵn sàng');
    }
    if (typeof ports.shipping?.quoteFeeVnd !== 'function') {
      fail(503, 'DATABASE_UNAVAILABLE', 'Chưa cấu hình bảng phí và vùng giao hàng');
    }
    if (typeof ports.outbox?.enqueueMail !== 'function' || typeof ports.outbox?.appendOutbox !== 'function') {
      fail(503, 'DATABASE_UNAVAILABLE', 'Hàng đợi xác nhận đơn chưa sẵn sàng');
    }
    if (quote && typeof repository.getAvailability !== 'function') {
      fail(503, 'DATABASE_UNAVAILABLE', 'Tồn kho chưa sẵn sàng');
    }
  }

  async function resolveRecipient(actor, input, session) {
    if (input.addressId) {
      if (!actor?.id || typeof ports.address?.getOwnedAddress !== 'function') {
        fail(404, 'NOT_FOUND', 'Không tìm thấy địa chỉ');
      }
      const address = await ports.address.getOwnedAddress(actor.id, input.addressId, { session });
      if (!address) fail(404, 'NOT_FOUND', 'Không tìm thấy địa chỉ');
      return normalizeRecipient(address, emailOf(actor));
    }
    return normalizeRecipient(input.recipient, emailOf(actor) ?? input.recipient?.email);
  }

  async function getProductSnapshots(items, { session } = {}) {
    const products = await ports.catalog.getCheckoutProducts(items.map(({ productId }) => productId), { session });
    const byId = new Map((products || []).map((product) => [idOf(product), product]));
    if (byId.size !== items.length) fail(404, 'NOT_FOUND', 'Không tìm thấy một hoặc nhiều sản phẩm');
    return items.map((item) => safeProductSnapshot(byId.get(item.productId), item.quantity));
  }

  async function quoteAmounts({ recipient, items, paymentMethod, actor, session, voucherId }) {
    const itemSnapshots = await getProductSnapshots(items, { session });
    const subtotalVnd = itemSnapshots.reduce((total, item) => total + item.unitPriceVnd * item.quantity, 0);
    if (!Number.isSafeInteger(subtotalVnd) || subtotalVnd < 1) fail(422, 'CHECKOUT_NOT_ALLOWED', 'Tổng tiền vượt giới hạn cho phép');
    const settings = await ports.settings.getBusinessSettings({ ...(session ? { session } : {}) });
    const values = settings?.values;
    if (!values || !Array.isArray(values.shippingZones) || values.shippingZones.length === 0
      || typeof values.codEnabled !== 'boolean' || !values.checkoutLimits || typeof values.checkoutLimits !== 'object'
      || Array.isArray(values.checkoutLimits)) {
      fail(503, 'DATABASE_UNAVAILABLE', 'Chưa cấu hình vùng giao hàng, phí và giới hạn checkout');
    }
    const paymentMethods = [];
    const maxPendingCodOrders = values.checkoutLimits.maxPendingCodOrders;
    if (values.codEnabled && Number.isSafeInteger(maxPendingCodOrders) && maxPendingCodOrders > 0) paymentMethods.push('cod');
    if (typeof ports.payment?.isConfigured === 'function' && await ports.payment.isConfigured()) paymentMethods.push('payos');
    if (!paymentMethods.includes(paymentMethod)) {
      fail(422, 'CHECKOUT_NOT_ALLOWED', 'Phương thức thanh toán hiện chưa khả dụng');
    }
    const shippingFeeVnd = await ports.shipping.quoteFeeVnd({
      settings: values, recipient, items: itemSnapshots, subtotalVnd,
      actor: actor ? { id: actor.id, role: actor.role } : undefined,
      ...(session ? { session } : {}),
    });
    if (!Number.isSafeInteger(shippingFeeVnd) || shippingFeeVnd < 0) {
      fail(503, 'DATABASE_UNAVAILABLE', 'Không tìm thấy phí giao hàng đã cấu hình cho địa chỉ này');
    }
    const policy = {
      checkoutEnabled: true,
      paymentMethods,
      codEnabled: values.codEnabled,
      maxPendingCodOrders,
      shippingFeeVnd,
      quoteExpiresAt: now().getTime() + 5 * 60 * 1000,
      reservationTtlMs: reservationTtlMs,
    };
    if (paymentMethod === 'cod' && policy.codEnabled !== true) {
      fail(422, 'CHECKOUT_NOT_ALLOWED', 'Thanh toán khi nhận hàng hiện chưa khả dụng');
    }
    let voucher;
    if (voucherId) {
      if (!actor?.id || actor.role !== 'customer') fail(403, 'FORBIDDEN', 'Chỉ customer mới có thể sử dụng voucher');
      if (typeof ports.vouchers?.quote !== 'function') fail(503, 'DATABASE_UNAVAILABLE', 'Kho voucher chưa sẵn sàng');
      voucher = await ports.vouchers.quote(actor.id, voucherId, subtotalVnd, { session });
    }
    const discountVnd = voucher?.discountVnd || 0;
    const totalVnd = subtotalVnd - discountVnd + shippingFeeVnd;
    if (!Number.isSafeInteger(totalVnd) || totalVnd < 1) fail(422, 'CHECKOUT_NOT_ALLOWED', 'Tổng tiền vượt giới hạn cho phép');
    return { itemSnapshots, subtotalVnd, shippingFeeVnd, discountVnd, totalVnd, policy, voucher };
  }

  async function quoteCheckout(actor, input) {
    await requireCheckoutPorts({ quote: true });
    assertValidPaymentMethod(input.paymentMethod);
    const items = normalizeItems(input.items);
    const recipient = await resolveRecipient(actor, input);
    const totals = await quoteAmounts({ recipient, items, paymentMethod: input.paymentMethod, actor, voucherId: input.voucherId });
    const availabilityRows = await repository.getAvailability(items.map(({ productId }) => productId));
    const availability = new Map(availabilityRows.map((item) => [item.productId, item.available]));
    const warnings = items.filter((item) => (availability.get(item.productId) || 0) < item.quantity)
      .map((item) => ({ productId: item.productId, code: 'OUT_OF_STOCK' }));
    return {
      items: totals.itemSnapshots.map((item) => ({ ...item, available: availability.get(item.productId) || 0 })),
      subtotalVnd: totals.subtotalVnd,
      shippingFeeVnd: totals.shippingFeeVnd,
      discountVnd: totals.discountVnd,
      ...(totals.voucher ? { voucher: totals.voucher } : {}),
      totalVnd: totals.totalVnd,
      quoteExpiresAt: (totals.policy.quoteExpiresAt ? new Date(totals.policy.quoteExpiresAt) : new Date(now().getTime() + 5 * 60 * 1000)).toISOString(),
      warnings,
    };
  }

  function checkoutActorKey(actor) {
    if (actor?.id) return `user:${actor.id}`;
    if (actor?.orderId) return `guest-order:${actor.orderId}`;
    if (actor?.kind === 'guest' && typeof actor.guestTokenHash === 'string' && /^[a-f\d]{64}$/u.test(actor.guestTokenHash)) {
      return `guest:${actor.guestTokenHash}`;
    }
    if (typeof actor?.actorKey === 'string' && actor.actorKey.length >= 20 && actor.actorKey.length <= 128) return `guest:${actor.actorKey}`;
    fail(503, 'DATABASE_UNAVAILABLE', 'Phiên giỏ hàng chưa sẵn sàng');
  }

  async function appendAudit(event, session) {
    if (typeof ports.outbox?.appendAudit !== 'function') {
      fail(503, 'DATABASE_UNAVAILABLE', 'Ghi nhận kiểm toán chưa sẵn sàng');
    }
    await ports.outbox.appendAudit(event, { session });
  }

  async function runMutationIdempotently(actor, scope, rawKey, payload, work) {
    if (typeof rawKey !== 'string' || rawKey.length < 22 || rawKey.length > 200) {
      fail(400, 'VALIDATION_ERROR', 'Thiếu khóa chống lặp hợp lệ');
    }
    const actorKey = actor?.id ? `user:${actor.id}` : checkoutActorKey(actor);
    const idempotencyScope = { scope, actorKey, keyHash: hash(rawKey) };
    const requestKey = hash(`${scope}:${actorKey}:${idempotencyScope.keyHash}`);
    const payloadHash = jsonHash(payload);
    try {
      return await repository.transaction(async (session) => {
        const existing = await repository.findIdempotency(idempotencyScope, { session });
        if (existing) {
          if (existing.payloadHash !== payloadHash) fail(409, 'IDEMPOTENCY_CONFLICT', 'Khóa đã được dùng cho nội dung khác');
          if (existing.state !== 'succeeded' || !existing.safeResponse) fail(409, 'REQUEST_IN_PROGRESS', 'Yêu cầu đang được xử lý');
          return existing.safeResponse;
        }
        const record = await repository.insertIdempotency({
          ...idempotencyScope, payloadHash, state: 'processing',
          expiresAt: new Date(now().getTime() + idempotencyRetentionMs),
        }, { session });
        const response = await work({ session, requestKey });
        await repository.finishIdempotency(record._id ?? record.id, {
          resourceId: response.id,
          responseStatus: 200,
          safeResponse: response,
        }, { session });
        return response;
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const existing = await repository.findIdempotency(idempotencyScope).catch(() => null);
      if (!existing) fail(409, 'REQUEST_IN_PROGRESS', 'Yêu cầu đang được xử lý');
      if (existing.payloadHash !== payloadHash) fail(409, 'IDEMPOTENCY_CONFLICT', 'Khóa đã được dùng cho nội dung khác');
      if (existing.state !== 'succeeded' || !existing.safeResponse) fail(409, 'REQUEST_IN_PROGRESS', 'Yêu cầu đang được xử lý');
      return existing.safeResponse;
    }
  }

  async function createOrder(actor, input, idempotencyKey, { requestId } = {}) {
    await requireCheckoutPorts();
    assertValidPaymentMethod(input.paymentMethod);
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 22 || idempotencyKey.length > 200) {
      fail(400, 'VALIDATION_ERROR', 'Thiếu khóa chống đặt trùng hợp lệ');
    }
    if (input.consent !== true) fail(400, 'VALIDATION_ERROR', 'Cần xác nhận điều khoản đặt hàng');
    const items = normalizeItems(input.items);
    const payload = {
      items,
      paymentMethod: input.paymentMethod,
      ...(input.addressId ? { addressId: String(input.addressId) } : { recipient: input.recipient }),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      ...(input.voucherId ? { voucherId: String(input.voucherId) } : {}),
      consent: input.consent,
    };
    const payloadHash = jsonHash(payload);
    const keyHash = hash(idempotencyKey);
    const actorKey = checkoutActorKey(actor);
    const idempotencyScope = { scope: 'orders.create', actorKey, keyHash };
    const orderId = repository.newId();
    const orderCode = `TL-${randomBytes(8).toString('hex').toUpperCase()}`;
    const clockNow = now();

    try {
      const result = await repository.transaction(async (session) => {
        const existing = await repository.findIdempotency(idempotencyScope, { session });
        if (existing) {
          if (existing.payloadHash !== payloadHash) fail(409, 'IDEMPOTENCY_CONFLICT', 'Khóa đã được dùng cho nội dung khác');
          if (existing.state !== 'succeeded' || !existing.safeResponse) fail(409, 'REQUEST_IN_PROGRESS', 'Yêu cầu đang được xử lý');
          return { ...existing.safeResponse, replay: true };
        }
        const idempotency = await repository.insertIdempotency({
          ...idempotencyScope,
          payloadHash,
          state: 'processing',
          expiresAt: new Date(clockNow.getTime() + idempotencyRetentionMs),
        }, { session });
        const recipient = await resolveRecipient(actor, input, session);
        const totals = await quoteAmounts({ recipient, items, paymentMethod: input.paymentMethod, actor, session, voucherId: input.voucherId });
        if (input.paymentMethod === 'cod') {
          const activeCodOrders = await repository.countPendingCodOrders(actor, recipient.email, { session });
          if (activeCodOrders >= totals.policy.maxPendingCodOrders) {
            fail(422, 'CHECKOUT_NOT_ALLOWED', 'Đã đạt giới hạn đơn COD đang chờ xử lý');
          }
        }
        const expiresAt = input.paymentMethod === 'payos'
          ? new Date(clockNow.getTime() + (Number.isSafeInteger(totals.policy.reservationTtlMs)
            ? totals.policy.reservationTtlMs : reservationTtlMs)) : undefined;
        const reservation = await repository.reserve(
          items.map(({ productId, quantity }) => ({ productId, quantity })), orderId, { session, expiresAt },
        );
        const voucherSnapshot = input.voucherId
          ? await ports.vouchers.redeem(actor.id, input.voucherId, orderId, totals.subtotalVnd, { session })
          : undefined;
        const order = await repository.createOrder({
          _id: orderId,
          code: orderCode,
          ...(actor?.id ? { userId: actor.id } : {}),
          recipientSnapshot: recipient,
          itemsSnapshot: totals.itemSnapshots,
          subtotalVnd: totals.subtotalVnd,
          shippingFeeVnd: totals.shippingFeeVnd,
          discountVnd: totals.discountVnd,
          ...(voucherSnapshot ? { voucherSnapshot: {
            voucherId: input.voucherId,
            code: voucherSnapshot.code,
            title: voucherSnapshot.title,
            discountType: voucherSnapshot.discountType,
            discountVnd: voucherSnapshot.discountVnd,
          } } : {}),
          totalVnd: totals.totalVnd,
          status: 'pending',
          paymentMethod: input.paymentMethod,
          paymentStatus: 'pending',
          paidAmountVnd: 0,
          refundedAmountVnd: 0,
          reservationId: idOf(reservation),
          ...(input.note?.trim() ? { note: input.note.trim() } : {}),
          statusHistory: [{ toStatus: 'pending', createdAt: clockNow }],
          version: 0,
        }, { session });
        let guestAccess;
        if (!actor?.id) {
          if (typeof ports.identity?.createGuestOrderProof !== 'function') {
            fail(503, 'DATABASE_UNAVAILABLE', 'Tra cứu đơn hàng chưa sẵn sàng');
          }
          const proof = await ports.identity.createGuestOrderProof({
            orderId: order._id ?? order.id, session,
          });
          const proofHash = hash(proof.token);
          await repository.models.Order.updateOne(
            { _id: order._id ?? order.id, version: order.version },
            { $set: { guestAccessTokenHash: proofHash } }, { session },
          ).exec();
          guestAccess = { token: proof.token, expiresAt: proof.expiresAt };
        }
        const safeResponse = {
          order: { id: idOf(order), code: order.code, status: order.status, paymentStatus: order.paymentStatus, totalVnd: order.totalVnd },
          payment: input.paymentMethod === 'payos'
            ? { status: 'unavailable', retryable: true }
            : { status: 'pending', retryable: false },
          ...(guestAccess ? { guestAccess: { expiresAt: guestAccess.expiresAt.toISOString() } } : {}),
        };
        await ports.outbox.appendOutbox({
          eventKey: `order.created:${idOf(order)}`, type: 'order.created',
          aggregateType: 'order', aggregateId: idOf(order), aggregateVersion: order.version,
          payload: {
            orderId: idOf(order), ...(actor?.id ? { userId: actor.id } : {}), orderCode: order.code, paymentMethod: order.paymentMethod,
            ...(requestId ? { requestId } : {}),
          },
        }, { session });
        await ports.outbox.enqueueMail('order-confirmation', recipient.email, {
          orderCode: order.code, recipientName: recipient.recipientName,
          totalVnd: order.totalVnd, itemCount: order.itemsSnapshot.length,
        }, { session });
        await repository.finishIdempotency(idempotency._id ?? idempotency.id, {
          resourceId: order._id ?? order.id, responseStatus: 201, safeResponse,
        }, { session });
        return { ...safeResponse, ...(guestAccess ? { guestProofToken: guestAccess.token } : {}) };
      });
      return result;
    } catch (error) {
      if (error?.code === 11000) {
        const existing = await repository.findIdempotency(idempotencyScope).catch(() => null);
        if (existing) {
          if (existing.payloadHash !== payloadHash) fail(409, 'IDEMPOTENCY_CONFLICT', 'Khóa đã được dùng cho nội dung khác');
          if (existing.state === 'succeeded' && existing.safeResponse) return { ...existing.safeResponse, replay: true };
        }
        if (error.keyPattern?.orderId || error.message?.includes('inventory')) {
          fail(409, 'OUT_OF_STOCK', 'Một hoặc nhiều sản phẩm vừa được đặt hết');
        }
        fail(409, 'REQUEST_IN_PROGRESS', 'Yêu cầu đang được xử lý');
      }
      if (error?.code === 'OUT_OF_STOCK') fail(409, 'OUT_OF_STOCK', error.message);
      if (error?.code === 'RESERVATION_CONFLICT') fail(409, 'VERSION_CONFLICT', error.message);
      throw error;
    }
  }

  async function getOwnedOrder(actor, id) {
    if (actor?.id) {
      const order = await repository.findOwnedOrder(actor.id, id);
      if (order) return publicOrder(order);
    }
    if (String(actor?.orderId ?? '') === String(id)) {
      const order = await repository.findOrderById(id);
      if (order) return publicOrder(order);
    }
    fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
  }

  async function getPaymentContext(actor, id, { session } = {}) {
    const order = await repository.findOrderById(id, { session });
    const isOwner = actor?.id && String(order?.userId ?? '') === String(actor.id);
    const isGuestProofForOrder = !actor?.id && String(actor?.orderId ?? '') === String(id);
    if (!order || (!isOwner && !isGuestProofForOrder)) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
    const reservation = await repository.models.StockReservation.findOne({ orderId: order._id ?? order.id })
      .session(session || null).exec();
    return {
      order: publicOrder(order),
      reservation: reservation ? {
        status: reservation.status,
        ...(reservation.expiresAt ? { expiresAt: reservation.expiresAt } : {}),
      } : null,
    };
  }

  async function listOwnOrders(actor, { status, page = 1, limit = 20 } = {}) {
    if (!actor?.id) fail(401, 'AUTH_REQUIRED', 'Cần đăng nhập để xem đơn hàng');
    const { items, total } = await repository.listOwnedOrders(actor.id, { status, page, limit });
    return { items: items.map(orderSummary), total };
  }

  async function listStaffOrders(filters = {}) {
    const { page = 1, limit = 20, ...rest } = filters;
    const { items, total } = await repository.listStaffOrders({ ...rest, page, limit });
    return { items: items.map((order) => {
      const record = order.toObject ? order.toObject() : order;
      return { ...orderSummary(record),
        recipient: { recipientName: record.recipientSnapshot?.recipientName, phone: record.recipientSnapshot?.phone },
        firstItem: record.itemsSnapshot[0] ? { name: record.itemsSnapshot[0].name, imageUrl: record.itemsSnapshot[0].imageUrl } : null,
      };
    }), total };
  }

  async function getOperationalOrder(id, { session } = {}) {
    const order = await repository.findStaffOrder(id, { session });
    if (!order) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
    return operationalOrder(order);
  }

  async function applyRefundAggregate(orderId, input, { session } = {}) {
    if (!session) throw new TypeError('P06 phải gọi applyRefundAggregate trong transaction');
    if (!Number.isSafeInteger(input?.expectedVersion) || input.expectedVersion < 0
      || !Number.isSafeInteger(input?.refundedAmountVnd) || input.refundedAmountVnd < 0
      || typeof input?.hasInFlightRefund !== 'boolean') {
      fail(400, 'VALIDATION_ERROR', 'Tổng hợp hoàn tiền chưa hợp lệ');
    }
    const order = await repository.findStaffOrder(orderId, { session });
    if (!order) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
    if (order.version !== input.expectedVersion) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
    if (!Number.isSafeInteger(order.paidAmountVnd) || order.paidAmountVnd < 1
      || input.refundedAmountVnd < order.refundedAmountVnd
      || input.refundedAmountVnd > order.paidAmountVnd
      || (input.hasInFlightRefund && input.refundedAmountVnd >= order.paidAmountVnd)) {
      fail(422, 'CHECKOUT_NOT_ALLOWED', 'Tổng tiền hoàn vượt số tiền đã thu');
    }
    if (!['paid', 'partially_refunded', 'refund_pending', 'refunded'].includes(order.paymentStatus)) {
      fail(409, 'INVALID_TRANSITION', 'Đơn chưa có khoản thanh toán đủ điều kiện hoàn tiền');
    }
    const paymentStatus = input.hasInFlightRefund ? 'refund_pending'
      : input.refundedAmountVnd === order.paidAmountVnd ? 'refunded'
        : input.refundedAmountVnd > 0 ? 'partially_refunded' : 'paid';
    if (order.refundedAmountVnd === input.refundedAmountVnd && order.paymentStatus === paymentStatus) {
      return operationalOrder(order);
    }
    const updated = await repository.updateOrder(orderId, input.expectedVersion, {
      paymentStatus, refundedAmountVnd: input.refundedAmountVnd,
    }, { session });
    if (!updated) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
    return operationalOrder(updated);
  }

  async function cancelOwnedOrder(actor, id, input, idempotencyKey, context = {}) {
    if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 1000) {
      fail(400, 'VALIDATION_ERROR', 'Nhập lý do hủy đơn hàng');
    }
    return runMutationIdempotently(actor, 'orders.cancel', idempotencyKey, { orderId: id, ...input }, async ({ session, requestKey }) => {
      const order = await repository.findOrderById(id, { session });
      if (!order || (order.userId && String(order.userId) !== actor?.id)
        || (!order.userId && String(actor?.orderId ?? '') !== String(id))) {
        fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
      }
      if (order.status !== 'pending') fail(422, 'CHECKOUT_NOT_ALLOWED', 'Đơn chỉ có thể được hủy khi đang chờ xử lý');
      if (!actor?.id && !actor?.orderId) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
      if (order.version !== input.expectedVersion) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
      if (order.paidAmountVnd > order.refundedAmountVnd && order.paymentStatus !== 'refund_pending') {
        if (typeof ports.refunds?.requestOrderCancellationRefund !== 'function') {
          fail(503, 'DATABASE_UNAVAILABLE', 'Luồng yêu cầu hoàn tiền chưa sẵn sàng; đơn đã thanh toán chưa bị hủy');
        }
        await ports.refunds.requestOrderCancellationRefund({
          orderId: order._id ?? order.id,
          amountVnd: order.paidAmountVnd - order.refundedAmountVnd,
          reason: input.reason.trim(),
          actor: actor?.id ? { id: actor.id, role: actor.role } : { orderId: String(order._id ?? order.id), role: 'guest' },
          requestKey,
          ...(context.requestId ? { requestId: context.requestId } : {}),
        }, { session });
      }
      const cancelled = await repository.updateOrder(id, input.expectedVersion, {
        status: 'cancelled',
        statusHistory: [...order.statusHistory, {
          fromStatus: order.status, toStatus: 'cancelled', actorId: actor?.id, reason: input.reason.trim(), createdAt: now(),
        }],
      }, { session });
      if (!cancelled) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
      await repository.release(order._id ?? order.id, { session, reason: 'cancelled' });
      await ports.vouchers?.releaseForOrder?.(order._id ?? order.id, { session });
      await ports.outbox.appendOutbox({
        eventKey: `order.cancelled:${id}:${cancelled.version}`, type: 'order.cancelled',
        aggregateType: 'order', aggregateId: String(id), aggregateVersion: cancelled.version,
        payload: { orderId: String(id), code: order.code, actorId: actor?.id, requestId: context.requestId },
      }, { session });
      return publicOrder(cancelled);
    });
  }

  async function transitionOrder(actor, id, input, idempotencyKey, context = {}) {
    if (!ORDER_STATUSES.has(input.toStatus) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
      fail(400, 'VALIDATION_ERROR', 'Trạng thái hoặc phiên bản chưa hợp lệ');
    }
    if (['cancelled'].includes(input.toStatus) && (!input.reason?.trim() || input.reason.length > 1000)) {
      fail(400, 'VALIDATION_ERROR', 'Nhập lý do hủy đơn hàng');
    }
    if (input.toStatus === 'shipped') {
      const hasCarrier = Boolean(input.shipping?.carrier?.trim() && input.shipping?.trackingNumber?.trim());
      const isManual = Boolean(input.reason?.trim() && !input.shipping);
      if (hasCarrier === isManual) fail(400, 'VALIDATION_ERROR', 'Nhập thông tin vận chuyển hoặc lý do giao thủ công');
    }
    if (['return_requested', 'returned'].includes(input.toStatus)) {
      fail(409, 'INVALID_TRANSITION', 'Yêu cầu và kiểm tra hàng trả phải đi qua luồng đổi trả');
    }
    return runMutationIdempotently(actor, 'orders.transition', idempotencyKey, { orderId: id, ...input }, async ({ session, requestKey }) => {
      const order = await repository.findStaffOrder(id, { session });
      if (!order) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
      if (order.version !== input.expectedVersion) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
      if (!TRANSITIONS[order.status]?.has(input.toStatus)) fail(409, 'INVALID_TRANSITION', 'Không thể chuyển đơn sang trạng thái này');
      if (input.toStatus === 'confirmed') {
        if (order.paymentMethod === 'payos' && order.paymentStatus !== 'paid') {
          fail(422, 'CHECKOUT_NOT_ALLOWED', 'Chỉ xác nhận đơn đã được PayOS xác minh thanh toán');
        }
        const reservation = await repository.models.StockReservation.findOne({ orderId: id }).session(session).exec();
        if (!reservation || reservation.status !== 'held') fail(409, 'OUT_OF_STOCK', 'Đơn không còn giữ được tồn kho');
      }
      if (input.toStatus === 'shipped' && order.paymentMethod === 'payos' && order.paymentStatus !== 'paid') {
        fail(422, 'CHECKOUT_NOT_ALLOWED', 'Chỉ giao đơn PayOS đã được xác minh thanh toán');
      }
      if (input.toStatus === 'cancelled' && order.paidAmountVnd > order.refundedAmountVnd
        && order.paymentStatus !== 'refund_pending') {
        if (typeof ports.refunds?.requestOrderCancellationRefund !== 'function') {
          fail(503, 'DATABASE_UNAVAILABLE', 'Luồng yêu cầu hoàn tiền chưa sẵn sàng; đơn đã thanh toán chưa bị hủy');
        }
        await ports.refunds.requestOrderCancellationRefund({
          orderId: order._id ?? order.id,
          amountVnd: order.paidAmountVnd - order.refundedAmountVnd,
          reason: input.reason.trim(),
          actor: { id: actor.id, role: actor.role },
          requestKey,
          ...(context.requestId ? { requestId: context.requestId } : {}),
        }, { session });
      }
      const history = [...order.statusHistory, {
        fromStatus: order.status, toStatus: input.toStatus, actorId: actor.id,
        ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}), createdAt: now(),
      }];
      const changes = { status: input.toStatus, statusHistory: history };
      if (input.toStatus === 'shipped') {
        if (input.shipping) changes.shipping = {
          ...(order.shipping?.toObject?.() ?? order.shipping ?? {}),
          carrier: input.shipping.carrier.trim(), trackingNumber: input.shipping.trackingNumber.trim(),
        };
        await repository.commitShipment(order._id ?? order.id, { session, actorId: actor.id });
      }
      if (input.toStatus === 'cancelled') {
        await repository.release(order._id ?? order.id, { session, reason: 'cancelled' });
        await ports.vouchers?.releaseForOrder?.(order._id ?? order.id, { session });
      }
      const updated = await repository.updateOrder(id, input.expectedVersion, changes, { session });
      if (!updated) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
      await ports.outbox.appendOutbox({
        eventKey: `order.status:${id}:${updated.version}`, type: 'order.status_changed',
        aggregateType: 'order', aggregateId: String(id), aggregateVersion: updated.version,
        payload: { orderId: String(id), code: order.code, fromStatus: order.status, toStatus: updated.status, actorId: actor.id },
      }, { session });
      await appendAudit({
        actorId: actor.id, actorRole: actor.role, requestId: context.requestId,
        action: 'order.transition', targetType: 'order', targetId: String(id), outcome: 'success',
        changesRedacted: { fromStatus: order.status, toStatus: updated.status }, createdAt: now(),
      }, session);
      return operationalOrder(updated);
    });
  }

  async function recordShippingEvent(actor, id, input, context = {}) {
    if (!Number.isFinite(Date.parse(input.occurredAt)) || !input.status?.trim() || !input.message?.trim()) {
      fail(400, 'VALIDATION_ERROR', 'Sự kiện vận chuyển chưa hợp lệ');
    }
    return repository.transaction(async (session) => {
      const order = await repository.findStaffOrder(id, { session });
      if (!order) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
      if (order.version !== input.expectedVersion) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
      if (!['shipped', 'return_requested'].includes(order.status)) fail(409, 'INVALID_TRANSITION', 'Đơn chưa ở trạng thái giao hàng');
      const event = {
        status: input.status.trim(), message: input.message.trim(), occurredAt: new Date(input.occurredAt),
        ...(input.trackingNumber ? { trackingNumber: input.trackingNumber.trim() } : {}),
        ...(input.carrier ? { carrier: input.carrier.trim() } : {}), actorId: actor.id,
      };
      const updated = await repository.updateOrder(id, input.expectedVersion, {
        shipping: { ...(order.shipping?.toObject?.() ?? order.shipping ?? {}), events: [...(order.shipping?.events ?? []), event] },
      }, { session });
      if (!updated) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
      await ports.outbox.appendOutbox({
        eventKey: `order.shipping:${id}:${updated.version}`, type: 'order.shipping_event',
        aggregateType: 'order', aggregateId: String(id), aggregateVersion: updated.version,
        payload: { orderId: String(id), code: order.code, status: event.status },
      }, { session });
      await appendAudit({
        actorId: actor.id, actorRole: actor.role, requestId: context.requestId,
        action: 'order.shipping_event', targetType: 'order', targetId: String(id), outcome: 'success',
        reasonCode: 'SHIPPING_EVENT', createdAt: now(),
      }, session);
      return operationalOrder(updated);
    });
  }

  async function collectCod(actor, id, input, idempotencyKey, context = {}) {
    if (!Number.isSafeInteger(input.amountVnd) || input.amountVnd < 1
      || typeof input.evidenceReference !== 'string' || !input.evidenceReference.trim() || input.evidenceReference.length > 500) {
      fail(400, 'VALIDATION_ERROR', 'Bằng chứng thu COD hoặc số tiền chưa hợp lệ');
    }
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 22 || idempotencyKey.length > 200) {
      fail(400, 'VALIDATION_ERROR', 'Thiếu khóa chống lặp hợp lệ');
    }
    const hashedKey = hash(`${actor.id}:${id}:${idempotencyKey}`);
    try {
      return await repository.transaction(async (session) => {
        const prior = await repository.findCodCollectionByIdempotencyKey(hashedKey, { session });
        if (prior) {
          if (String(prior.orderId) !== String(id) || prior.amountVnd !== input.amountVnd
            || prior.evidenceReference !== input.evidenceReference.trim()) {
            fail(409, 'IDEMPOTENCY_CONFLICT', 'Khóa đã được dùng cho nội dung khác');
          }
          const replayOrder = await repository.findOrderById(id, { session });
          return operationalOrder(replayOrder);
        }
        const order = await repository.findStaffOrder(id, { session });
        if (!order || order.paymentMethod !== 'cod') fail(404, 'NOT_FOUND', 'Không tìm thấy đơn COD');
        if (order.version !== input.expectedVersion) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
        if (!['shipped', 'delivered'].includes(order.status) || order.paymentStatus !== 'pending') {
          fail(409, 'INVALID_TRANSITION', 'Chỉ đối soát COD của đơn đã giao cho vận chuyển');
        }
        if (input.amountVnd !== order.totalVnd - order.paidAmountVnd) {
          fail(422, 'CHECKOUT_NOT_ALLOWED', 'Số tiền COD phải bằng toàn bộ số dư cần thu');
        }
        const recordedAt = now();
        await repository.createCodCollection({
          orderId: order._id ?? order.id, amountVnd: input.amountVnd,
          evidenceReference: input.evidenceReference.trim(), idempotencyKey: hashedKey,
          recordedBy: actor.id, recordedAt,
        }, { session });
        const updated = await repository.updateOrder(id, input.expectedVersion, {
          paymentStatus: 'paid', paidAmountVnd: order.paidAmountVnd + input.amountVnd,
        }, { session });
        if (!updated) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
        await ports.outbox.appendOutbox({
          eventKey: `order.cod_collected:${id}:${updated.version}`, type: 'order.cod_collected',
          aggregateType: 'order', aggregateId: String(id), aggregateVersion: updated.version,
          payload: { orderId: String(id), code: order.code, amountVnd: input.amountVnd },
        }, { session });
        await appendAudit({
          actorId: actor.id, actorRole: actor.role, requestId: context.requestId,
          action: 'order.cod_collection', targetType: 'order', targetId: String(id), outcome: 'success',
          reasonCode: 'COD_COLLECTED', changesRedacted: { amountVnd: input.amountVnd }, createdAt: recordedAt,
        }, session);
        return operationalOrder(updated);
      });
    } catch (error) {
      if (error?.code === 11000) {
        const prior = await repository.findCodCollectionByIdempotencyKey(hashedKey).catch(() => null);
        if (prior && String(prior.orderId) === String(id) && prior.amountVnd === input.amountVnd
          && prior.evidenceReference === input.evidenceReference.trim()) return getOperationalOrder(id);
        if (prior || error.keyPattern?.orderId) fail(409, 'IDEMPOTENCY_CONFLICT', 'Đơn COD đã được đối soát');
        fail(409, 'REQUEST_IN_PROGRESS', 'Yêu cầu đang được xử lý');
      }
      throw error;
    }
  }

  async function adjustInventory(actor, productId, input, idempotencyKey, context = {}) {
    if (!Number.isSafeInteger(input.delta) || input.delta === 0 || typeof input.reason !== 'string'
      || !input.reason.trim() || input.reason.length > 1000 || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0) {
      fail(400, 'VALIDATION_ERROR', 'Điều chỉnh tồn kho chưa hợp lệ');
    }
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 22 || idempotencyKey.length > 200) {
      fail(400, 'VALIDATION_ERROR', 'Thiếu khóa chống lặp hợp lệ');
    }
    const key = hash(`inventory:${productId}:${actor.id}:${idempotencyKey}`);
    return repository.transaction(async (session) => {
      const existing = await repository.models.InventoryMovement.findOne({ eventKey: key }).session(session).exec();
      if (existing) {
        if (existing.onHandDelta !== input.delta || existing.reason !== input.reason.trim()
          || String(existing.actorId) !== String(actor.id)) fail(409, 'IDEMPOTENCY_CONFLICT', 'Khóa đã được dùng cho nội dung khác');
        const current = await repository.models.Inventory.findOne({ productId }).session(session).exec();
        return { productId: String(productId), onHand: current.onHand, reserved: current.reserved, available: current.onHand - current.reserved, version: current.version };
      }
      const inventory = await repository.models.Inventory.findOne({ productId }).session(session).exec();
      if ((inventory?.version ?? 0) !== input.expectedVersion) fail(409, 'VERSION_CONFLICT', 'Tồn kho đã thay đổi');
      const changed = await repository.adjustInventory(productId, input.delta, {
        session, actorId: actor.id, reason: input.reason.trim(), eventKey: key,
      });
      await appendAudit({
        actorId: actor.id, actorRole: actor.role, requestId: context.requestId,
        action: 'inventory.adjust', targetType: 'product', targetId: String(productId), outcome: 'success',
        reasonCode: 'INVENTORY_ADJUSTMENT', changesRedacted: { delta: input.delta, available: changed.onHand - changed.reserved },
        createdAt: now(),
      }, session);
      return { productId: String(productId), onHand: changed.onHand, reserved: changed.reserved, available: changed.onHand - changed.reserved, version: changed.version };
    });
  }

  async function applyVerifiedPayment(paymentFact, { session } = {}) {
    if (!session) throw new TypeError('P06 phải gọi applyVerifiedPayment trong transaction');
    if (paymentFact?.provider !== 'payos' || paymentFact?.status !== 'paid'
      || paymentFact?.currency !== 'VND' || !Number.isSafeInteger(paymentFact.amountVnd) || paymentFact.amountVnd < 1
      || !paymentFact.orderId) fail(400, 'BAD_REQUEST', 'Sự kiện thanh toán đã xác minh chưa hợp lệ');
    const order = await repository.findStaffOrder(paymentFact.orderId, { session });
    if (!order || order.paymentMethod !== 'payos') fail(404, 'NOT_FOUND', 'Không tìm thấy đơn PayOS');
    if (order.paymentStatus === 'paid' && order.paidAmountVnd === paymentFact.amountVnd) {
      return { order: publicOrder(order), applied: false, reviewRequired: false };
    }
    if (paymentFact.amountVnd !== order.totalVnd) {
      const flagged = await repository.updateOrder(order._id ?? order.id, order.version, {
        paymentReview: { required: true, reasonCode: 'PAYMENT_AMOUNT_MISMATCH', amountVnd: paymentFact.amountVnd },
      }, { session });
      if (!flagged) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi trong lúc xử lý thanh toán');
      return { applied: false, reviewRequired: true };
    }
    const reservation = await repository.models.StockReservation.findOne({ orderId: order._id ?? order.id }).session(session).exec();
    const late = order.status === 'cancelled' || reservation?.status !== 'held'
      || (reservation.expiresAt && new Date(reservation.expiresAt) <= now());
    const changes = {
      paymentStatus: 'paid', paidAmountVnd: paymentFact.amountVnd,
      ...(late ? { paymentReview: { required: true, reasonCode: 'LATE_PAYMENT_STOCK_REVIEW' } } : {}),
    };
    const updated = await repository.updateOrder(order._id ?? order.id, order.version, changes, { session });
    if (!updated) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi trong lúc xử lý thanh toán');
    if (!late) {
      await repository.models.StockReservation.updateOne(
        { _id: reservation._id, status: 'held' },
        { $unset: { expiresAt: 1 }, $inc: { version: 1 } }, { session },
      ).exec();
    }
    await ports.outbox.appendOutbox({
      eventKey: `order.paid:${order._id}`, type: late ? 'order.late_payment_review' : 'order.payment_verified',
      aggregateType: 'order', aggregateId: String(order._id), aggregateVersion: updated.version,
      payload: { orderId: String(order._id), code: order.code, amountVnd: paymentFact.amountVnd, reviewRequired: late },
    }, { session });
    return { order: publicOrder(updated), applied: true, reviewRequired: late };
  }

  async function requestReturn(actor, id, reason, { session } = {}) {
    if (!session) throw new TypeError('P07 phải gọi requestReturn bên trong transaction tạo return request');
    const order = await repository.findOrderById(id, { session });
    if (!order || (actor?.id && String(order.userId) !== actor.id)
      || (!actor?.id && String(actor?.orderId ?? '') !== String(id))) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
    if (!['delivered'].includes(order.status)) fail(422, 'CHECKOUT_NOT_ALLOWED', 'Chỉ có thể gửi yêu cầu sau khi nhận hàng');
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 1000) fail(400, 'VALIDATION_ERROR', 'Nhập lý do đổi trả');
    const updated = await repository.updateOrder(id, order.version, {
      status: 'return_requested',
      statusHistory: [...order.statusHistory, {
        fromStatus: order.status, toStatus: 'return_requested', actorId: actor?.id,
        reason: reason.trim(), createdAt: now(),
      }],
    }, { session });
    if (!updated) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
    await ports.outbox.appendOutbox({
      eventKey: `order.return_requested:${id}:${updated.version}`, type: 'order.return_requested',
      aggregateType: 'order', aggregateId: String(id), aggregateVersion: updated.version,
      payload: { orderId: String(id), code: order.code },
    }, { session });
    return publicOrder(updated);
  }

  async function transitionReturnOrder(actor, id, toStatus, reason, expectedVersion, { session } = {}) {
    if (!session) throw new TypeError('P07 phải gọi transitionReturnOrder bên trong transaction return workflow');
    if (!['returned', 'shipped', 'delivered'].includes(toStatus)
      || typeof reason !== 'string' || !reason.trim() || reason.length > 1000
      || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
      fail(400, 'VALIDATION_ERROR', 'Kết quả kiểm tra đổi trả chưa hợp lệ');
    }
    const order = await repository.findStaffOrder(id, { session });
    if (!order) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
    if (order.status !== 'return_requested') fail(409, 'INVALID_TRANSITION', 'Đơn chưa có yêu cầu đổi trả đang xử lý');
    if (order.version !== expectedVersion) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
    const updated = await repository.updateOrder(id, expectedVersion, {
      status: toStatus,
      statusHistory: [...order.statusHistory, {
        fromStatus: order.status, toStatus, actorId: actor?.id, reason: reason.trim(), createdAt: now(),
      }],
    }, { session });
    if (!updated) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
    await ports.outbox.appendOutbox({
      eventKey: `order.return_resolved:${id}:${updated.version}`, type: 'order.return_resolved',
      aggregateType: 'order', aggregateId: String(id), aggregateVersion: updated.version,
      payload: { orderId: String(id), code: order.code, toStatus },
    }, { session });
    return operationalOrder(updated);
  }

  async function restockReturnedItems(actor, orderId, items, returnId, { session, reason } = {}) {
    if (!session || !Array.isArray(items) || items.length < 1) {
      throw new TypeError('P07 phải gọi restockReturnedItems trong transaction inspection');
    }
    const order = await repository.findStaffOrder(orderId, { session });
    if (!order) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
    const purchased = new Map(order.itemsSnapshot.map((item) => [String(item.productId), item.quantity]));
    const seen = new Set();
    const updated = [];
    for (const item of items) {
      const productId = String(item.productId);
      if (seen.has(productId) || !purchased.has(productId)
        || !Number.isSafeInteger(item.receivedQuantity) || item.receivedQuantity < 0
        || !Number.isSafeInteger(item.resellableQuantity) || item.resellableQuantity < 0
        || item.resellableQuantity > item.receivedQuantity || item.receivedQuantity > purchased.get(productId)) {
        fail(400, 'VALIDATION_ERROR', 'Số lượng hàng nhận hoặc có thể bán lại chưa hợp lệ');
      }
      seen.add(productId);
      if (item.resellableQuantity === 0) continue;
      const inventory = await repository.models.Inventory.findOneAndUpdate(
        { productId, $expr: { $gte: [{ $add: ['$onHand', item.resellableQuantity] }, '$reserved'] } },
        { $inc: { onHand: item.resellableQuantity, version: 1 } }, { returnDocument: 'after', session },
      ).exec();
      if (!inventory) fail(409, 'OUT_OF_STOCK', 'Không thể cộng lại hàng trả vào tồn kho');
      await repository.models.InventoryMovement.create([{
        productId, orderId, eventKey: `return:${returnId}:${productId}`, kind: 'return',
        onHandDelta: item.resellableQuantity, reservedDelta: 0, actorId: actor?.id, reason,
      }], { session });
      updated.push({ productId, onHand: inventory.onHand, reserved: inventory.reserved, available: inventory.onHand - inventory.reserved });
    }
    return updated;
  }

  async function completeReturn(actor, input, { session } = {}) {
    if (!session) throw new TypeError('P07 phải gọi completeReturn bên trong transaction kiểm tra hàng trả');
    const orderId = input?.orderId;
    const returnId = String(input?.returnId?._id ?? input?.returnId ?? '');
    const reason = typeof input?.reason === 'string' ? input.reason.trim() : undefined;
    const expectedOrderVersion = input?.expectedOrderVersion;
    if (typeof returnId !== 'string' || !/^[a-f\d]{24}$/iu.test(returnId)
      || !Array.isArray(input?.items) || input.items.length < 1
      || !Number.isSafeInteger(expectedOrderVersion) || expectedOrderVersion < 0
      || (reason !== undefined && (!reason || reason.length > 1000))) {
      fail(400, 'VALIDATION_ERROR', 'Thông tin kiểm tra hàng trả chưa hợp lệ');
    }
    const order = await repository.findStaffOrder(orderId, { session });
    if (!order) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
    if (order.status !== 'return_requested') fail(409, 'INVALID_TRANSITION', 'Đơn hàng không có yêu cầu trả đang xử lý');
    if (order.version !== expectedOrderVersion) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');

    const inventory = await restockReturnedItems(actor, order._id ?? orderId, input.items, returnId, { session, reason });
    const updated = await repository.updateOrder(order._id ?? orderId, expectedOrderVersion, {
      status: 'returned',
      statusHistory: [...order.statusHistory, {
        fromStatus: order.status, toStatus: 'returned', actorId: actor?.id,
        ...(reason ? { reason } : {}), createdAt: now(),
      }],
    }, { session });
    if (!updated) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
    await ports.outbox.appendOutbox({
      eventKey: `order.return_resolved:${idOf(order)}:${updated.version}`, type: 'order.return_resolved',
      aggregateType: 'order', aggregateId: idOf(order), aggregateVersion: updated.version,
      payload: { orderId: idOf(order), code: order.code, toStatus: 'returned' },
    }, { session });
    return { order: operationalOrder(updated), inventory };
  }

  async function issueOrderAccessChallenge(input, context = {}) {
    const code = typeof input?.code === 'string' ? input.code.trim().toUpperCase() : '';
    const email = normalizeEmail(input?.email);
    if (code.length < 1 || code.length > 32 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) || email.length > 254) {
      fail(400, 'VALIDATION_ERROR', 'Mã đơn hoặc email chưa hợp lệ');
    }
    if (typeof ports.outbox?.enqueueMail !== 'function') fail(503, 'MAIL_UNAVAILABLE', 'Email xác minh chưa sẵn sàng');
    const challengeId = randomBytes(24).toString('base64url');
    const verificationCode = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(now().getTime() + orderAccessTtlMs);
    const transactionResult = await repository.transaction(async (session) => {
      const order = await repository.findOrderByCodeAndEmail(code, email, { session });
      await repository.createOrderAccessChallenge({
        challengeIdHash: hash(challengeId),
        ...(order ? { orderId: order._id ?? order.id } : {}),
        codeHash: hash(`${challengeId}:${verificationCode}`), attempts: 0, expiresAt,
      }, { session });
      if (order) {
        await ports.outbox.enqueueMail('guest-order-access-code', order.recipientSnapshot.email, {
          orderCode: order.code, verificationCode, expiresAt: expiresAt.toISOString(),
          ...(context.requestId ? { requestId: context.requestId } : {}),
        }, { session });
      }
      return { accepted: true, challengeId };
    });
    return transactionResult;
  }

  async function verifyOrderAccessChallenge(input) {
    if (typeof input?.challengeId !== 'string' || input.challengeId.length < 20 || input.challengeId.length > 128
      || !/^\d{6}$/u.test(input.verificationCode)) fail(400, 'VALIDATION_ERROR', 'Thông tin xác minh chưa hợp lệ');
    const result = await repository.transaction(async (session) => {
      const challenge = await repository.findOrderAccessChallenge(hash(input.challengeId), { session });
      const currentTime = now();
      if (!challenge || !challenge.orderId || challenge.consumedAt || challenge.attempts >= 5
        || new Date(challenge.expiresAt) <= currentTime) return { invalid: true };
      if (challenge.codeHash !== hash(`${input.challengeId}:${input.verificationCode}`)) {
        await repository.incrementOrderAccessAttempts(challenge._id ?? challenge.id, { session });
        return { invalid: true };
      }
      if (!await repository.consumeOrderAccessChallenge(challenge._id ?? challenge.id, currentTime, { session })) {
        return { invalid: true };
      }
      const order = await repository.findOrderById(challenge.orderId, { session, includeGuestProofHash: true });
      if (!order || order.userId || typeof ports.identity?.createGuestOrderProof !== 'function') return { invalid: true };
      const proof = await ports.identity.createGuestOrderProof({
        orderId: order._id ?? order.id, identityVerifiedAt: currentTime, session,
      });
      const changed = await repository.updateOrder(order._id ?? order.id, order.version, {
        guestAccessTokenHash: hash(proof.token),
      }, { session });
      if (!changed) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi');
      return { invalid: false, orderId: idOf(order), expiresAt: proof.expiresAt, proofToken: proof.token };
    });
    if (result.invalid) fail(403, 'FORBIDDEN', 'Thông tin xác minh không hợp lệ hoặc đã hết hạn');
    return result;
  }

  async function claimGuestOrder(actor, id, idempotencyKey, { requestId } = {}) {
    if (!actor?.id || !actor.user?.emailVerifiedAt) fail(403, 'FORBIDDEN', 'Cần xác minh email tài khoản để liên kết đơn');
    return runMutationIdempotently(actor, 'orders.claim', idempotencyKey, { orderId: id }, async ({ session }) => {
      const order = await repository.findOrderById(id, { session, includeGuestProofHash: true });
      if (!order) fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
      if (String(order.userId ?? '') === actor.id) return publicOrder(order);
      if (order.userId || normalizeEmail(order.recipientSnapshot.email) !== normalizeEmail(emailOf(actor))) {
        fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
      }
      if (!actor.guestOrderProof || String(actor.guestOrderProof.orderId) !== String(id)) {
        fail(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng');
      }
      if (typeof ports.identity?.revokeGuestOrderProofs !== 'function') {
        fail(503, 'DATABASE_UNAVAILABLE', 'Thu hồi quyền tra cứu khách chưa sẵn sàng');
      }
      const updated = await repository.models.Order.findOneAndUpdate(
        { _id: id, userId: null, version: order.version, 'recipientSnapshot.email': order.recipientSnapshot.email },
        { $set: { userId: actor.id }, $unset: { guestAccessTokenHash: 1 }, $inc: { version: 1 } },
        { returnDocument: 'after', session, runValidators: true },
      ).exec();
      if (!updated) fail(409, 'VERSION_CONFLICT', 'Đơn đã được liên kết hoặc thay đổi');
      await ports.identity.revokeGuestOrderProofs(id, { session });
      await ports.outbox.appendOutbox({
        eventKey: `order.claimed:${id}`, type: 'order.guest_claimed', aggregateType: 'order',
        aggregateId: String(id), aggregateVersion: updated.version, payload: { orderId: String(id), userId: actor.id },
      }, { session });
      await appendAudit({
        actorId: actor.id, actorRole: actor.role, requestId, action: 'order.guest_claimed',
        targetType: 'order', targetId: String(id), outcome: 'success', createdAt: now(),
      }, session);
      return publicOrder(updated);
    });
  }

  async function releaseExpiredReservations({ batchSize = 100 } = {}) {
    if (typeof ports.payment?.getReservationExpiryStatus !== 'function') {
      return { checked: 0, released: 0, deferred: 0, reason: 'PAYMENT_EXPIRY_ADAPTER_UNCONFIGURED' };
    }
    const expired = await repository.models.StockReservation.find({
      status: 'held', expiresAt: { $lte: now() },
    }).sort({ expiresAt: 1, _id: 1 }).limit(Math.min(500, Math.max(1, batchSize))).lean().exec();
    let released = 0;
    let deferred = 0;
    for (const reservation of expired) {
      const knownOrder = await repository.findStaffOrder(reservation.orderId);
      if (!knownOrder || knownOrder.paymentMethod !== 'payos' || knownOrder.status !== 'pending'
        || ['paid', 'refund_pending', 'refunded', 'partially_refunded'].includes(knownOrder.paymentStatus)) {
        deferred += 1;
        continue;
      }
      let verifiedStatus;
      try {
        verifiedStatus = await ports.payment.getReservationExpiryStatus(knownOrder);
      } catch {
        deferred += 1;
        continue;
      }
      if (!['expired', 'failed', 'cancelled'].includes(verifiedStatus)) { deferred += 1; continue; }
      const outcome = await repository.transaction(async (session) => {
        const order = await repository.findStaffOrder(reservation.orderId, { session });
        const currentReservation = await repository.models.StockReservation.findOne({
          _id: reservation._id, status: 'held', expiresAt: { $lte: now() },
        }).session(session).exec();
        if (!order || !currentReservation || order.paymentMethod !== 'payos' || order.status !== 'pending'
          || ['paid', 'refund_pending', 'refunded', 'partially_refunded'].includes(order.paymentStatus)) return false;
        const wasReleased = await repository.release(order._id ?? order.id, { session, reason: 'expired' });
        if (wasReleased) {
          const updated = await repository.updateOrder(order._id ?? order.id, order.version, {
            paymentStatus: verifiedStatus,
          }, { session });
          if (!updated) fail(409, 'VERSION_CONFLICT', 'Đơn hàng đã thay đổi trong lúc hết hạn giữ tồn');
          await ports.outbox.appendOutbox({
            eventKey: `order.reservation_expired:${order._id}:${updated.version}`, type: 'order.reservation_expired',
            aggregateType: 'order', aggregateId: String(order._id), aggregateVersion: updated.version,
            payload: { orderId: String(order._id), code: order.code },
          }, { session });
        }
        return wasReleased;
      });
      if (outcome) released += 1;
      else deferred += 1;
    }
    return { checked: expired.length, released, deferred };
  }

  return Object.freeze({
    repository,
    quoteCheckout,
    createOrder,
    getOwnedOrder,
    getPaymentContext,
    listOwnOrders,
    listStaffOrders,
    getOperationalOrder,
    applyRefundAggregate,
    cancelOwnedOrder,
    transitionOrder,
    recordShippingEvent,
    collectCod,
    adjustInventory,
    applyVerifiedPayment,
    requestReturn,
    transitionReturnOrder,
    restockReturnedItems,
    completeReturn,
    issueOrderAccessChallenge,
    verifyOrderAccessChallenge,
    claimGuestOrder,
    releaseExpiredReservations,
    getAvailability: (ids) => repository.getAvailability(ids),
  });
}

export { TRANSITIONS as orderTransitions, orderSummary };
