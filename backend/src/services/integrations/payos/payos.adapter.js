import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const API_BASE_URL = 'https://api-merchant.payos.vn';
const CHECKOUT_HOSTS = new Set(['pay.payos.vn']);

export class PayosAdapterError extends Error {
  constructor(code, { retryable = true, statusCode } = {}) {
    super(code);
    this.name = 'PayosAdapterError';
    this.code = code;
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

function stableScalar(value) {
  if (value === null || value === undefined) throw new TypeError('PayOS signature data must not contain null values');
  if (!['string', 'number', 'boolean'].includes(typeof value)) throw new TypeError('PayOS signature data must contain scalar values');
  return String(value);
}

export function canonicalPayosData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('PayOS data object is required');
  return Object.keys(data).sort().map((key) => `${key}=${stableScalar(data[key])}`).join('&');
}

export function createPayosSignature(data, checksumKey) {
  if (typeof checksumKey !== 'string' || checksumKey.length === 0) throw new TypeError('PayOS checksum key is required');
  return createHmac('sha256', checksumKey).update(canonicalPayosData(data)).digest('hex');
}

export function verifyPayosSignature(data, signature, checksumKey) {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/iu.test(signature)) return false;
  const actual = Buffer.from(signature.toLowerCase(), 'hex');
  const expected = Buffer.from(createPayosSignature(data, checksumKey), 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function providerData(response) {
  if (!response || typeof response !== 'object' || response.code !== '00'
    || !response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
    throw new PayosAdapterError('PAYOS_API_REJECTED', { retryable: false });
  }
  return response.data;
}

function checkoutUrl(value) {
  if (typeof value !== 'string') throw new PayosAdapterError('PAYOS_RESPONSE_INVALID', { retryable: false });
  let parsed;
  try { parsed = new URL(value); } catch { throw new PayosAdapterError('PAYOS_RESPONSE_INVALID', { retryable: false }); }
  if (parsed.protocol !== 'https:' || !CHECKOUT_HOSTS.has(parsed.hostname) || parsed.username || parsed.password) {
    throw new PayosAdapterError('PAYOS_RESPONSE_INVALID', { retryable: false });
  }
  return parsed.toString();
}

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function createPayosAdapter({ config = {}, fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  const enabled = config.enabled === true
    && typeof config.clientId === 'string' && config.clientId.length > 0
    && typeof config.apiKey === 'string' && config.apiKey.length > 0
    && typeof config.checksumKey === 'string' && config.checksumKey.length > 0;
  const timeoutMs = Number.isSafeInteger(config.timeoutMs) && config.timeoutMs > 0 ? config.timeoutMs : 8000;

  async function request(path, { method = 'GET', body } = {}) {
    if (!enabled) throw new PayosAdapterError('PAYMENT_PROVIDER_UNAVAILABLE', { retryable: false });
    if (typeof fetchImpl !== 'function') throw new PayosAdapterError('PAYMENT_PROVIDER_UNAVAILABLE', { retryable: false });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    try {
      let response;
      try {
        response = await fetchImpl(`${API_BASE_URL}${path}`, {
          method,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'x-client-id': config.clientId,
            'x-api-key': config.apiKey,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal,
        });
      } catch {
        throw new PayosAdapterError('PAYMENT_PROVIDER_UNAVAILABLE');
      }
      if (!response.ok) {
        throw new PayosAdapterError('PAYOS_API_REJECTED', {
          retryable: response.status >= 500 || response.status === 429,
          statusCode: response.status,
        });
      }
      let result;
      try { result = await response.json(); }
      catch { throw new PayosAdapterError('PAYOS_RESPONSE_INVALID', { retryable: false }); }
      return providerData(result);
    } finally {
      clearTimeout(timer);
    }
  }

  async function createLink(attempt) {
    if (!safeInteger(attempt?.amountVnd) || attempt.amountVnd < 1
      || !safeInteger(attempt?.providerOrderCode) || attempt.providerOrderCode < 1
      || !Number.isSafeInteger(attempt?.expiresAt?.getTime?.())) {
      throw new PayosAdapterError('PAYMENT_ATTEMPT_INVALID', { retryable: false });
    }
    const signedFields = {
      amount: attempt.amountVnd,
      cancelUrl: attempt.cancelUrl,
      description: attempt.description,
      orderCode: attempt.providerOrderCode,
      returnUrl: attempt.returnUrl,
    };
    const data = await request('/v2/payment-requests', {
      method: 'POST',
      body: {
        ...signedFields,
        expiredAt: Math.floor(attempt.expiresAt.getTime() / 1000),
        signature: createPayosSignature(signedFields, config.checksumKey),
      },
    });
    if (data.orderCode !== attempt.providerOrderCode || data.amount !== attempt.amountVnd
      || typeof data.paymentLinkId !== 'string' || data.paymentLinkId.length === 0
      || data.status !== 'PENDING') {
      throw new PayosAdapterError('PAYOS_RESPONSE_MISMATCH', { retryable: false });
    }
    return {
      paymentLinkId: data.paymentLinkId,
      checkoutUrl: checkoutUrl(data.checkoutUrl),
      status: 'pending',
    };
  }

  async function getLink(attempt) {
    if (typeof attempt?.paymentLinkId !== 'string' || attempt.paymentLinkId.length === 0) {
      return { status: 'unknown' };
    }
    const data = await request(`/v2/payment-requests/${encodeURIComponent(attempt.paymentLinkId)}`);
    const responseLinkId = data.id ?? data.paymentLinkId;
    if (responseLinkId !== attempt.paymentLinkId || data.orderCode !== attempt.providerOrderCode
      || data.amount !== attempt.amountVnd) {
      throw new PayosAdapterError('PAYOS_RESPONSE_MISMATCH', { retryable: false });
    }
    const amountPaidVnd = safeInteger(data.amountPaid) ? data.amountPaid : undefined;
    const currency = typeof data.currency === 'string' ? data.currency : 'VND';
    const status = data.status === 'PAID' && amountPaidVnd === attempt.amountVnd && currency === 'VND'
      ? 'paid'
      : ({ PENDING: 'pending', EXPIRED: 'expired', CANCELLED: 'cancelled', FAILED: 'failed' }[data.status] || 'unknown');
    return {
      status,
      providerOrderCode: data.orderCode,
      paymentLinkId: responseLinkId,
      amountVnd: data.amount,
      amountPaidVnd,
      currency,
      ...(typeof data.checkoutUrl === 'string' ? { checkoutUrl: checkoutUrl(data.checkoutUrl) } : {}),
    };
  }

  async function cancelLink(attempt, cancellationReason = 'Order cancelled') {
    if (typeof attempt?.paymentLinkId !== 'string' || attempt.paymentLinkId.length === 0) {
      throw new PayosAdapterError('PAYMENT_LINK_UNKNOWN', { retryable: false });
    }
    const data = await request(`/v2/payment-requests/${encodeURIComponent(attempt.paymentLinkId)}/cancel`, {
      method: 'POST', body: { cancellationReason: String(cancellationReason).slice(0, 500) },
    });
    return { paymentLinkId: attempt.paymentLinkId, status: data.status };
  }

  function verifyWebhook(body) {
    if (!body || typeof body !== 'object' || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
      throw new PayosAdapterError('PAYOS_WEBHOOK_INVALID', { retryable: false });
    }
    const { data } = body;
    if (!verifyPayosSignature(data, body.signature, config.checksumKey)) {
      throw new PayosAdapterError('PAYOS_SIGNATURE_INVALID', { retryable: false });
    }
    if (!safeInteger(data.orderCode) || data.orderCode < 1 || !safeInteger(data.amount) || data.amount < 1
      || typeof data.paymentLinkId !== 'string' || data.paymentLinkId.length === 0
      || typeof data.code !== 'string' || typeof data.currency !== 'string') {
      throw new PayosAdapterError('PAYOS_WEBHOOK_INVALID', { retryable: false });
    }
    const canonical = canonicalPayosData(data);
    const payloadDigest = createHash('sha256').update(canonical).digest('hex');
    // Keep a stable, bounded key without storing provider references or raw payloads.
    const providerEventKey = `event:${payloadDigest}`;
    const occurredAt = typeof data.transactionDateTime === 'string'
      && Number.isFinite(Date.parse(data.transactionDateTime))
      ? new Date(data.transactionDateTime)
      : now();
    return {
      provider: 'payos',
      providerEventKey,
      providerOrderCode: data.orderCode,
      paymentLinkId: data.paymentLinkId,
      amountVnd: data.amount,
      currency: data.currency,
      status: data.code === '00' ? 'paid' : 'unsettled',
      occurredAt,
      payloadDigest,
    };
  }

  return Object.freeze({
    isConfigured: () => enabled,
    createLink,
    getLink,
    cancelLink,
    verifyWebhook,
  });
}
