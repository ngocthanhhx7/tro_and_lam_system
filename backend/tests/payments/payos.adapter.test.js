import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalPayosData,
  createPayosAdapter,
  createPayosSignature,
  verifyPayosSignature,
} from '../../src/services/integrations/payos/payos.adapter.js';

const checksumKey = 'test-checksum-key-only';

function payosConfig(overrides = {}) {
  return { enabled: true, clientId: 'test-client-id', apiKey: 'test-api-key', checksumKey, ...overrides };
}

test('PayOS webhook canonicalization is sorted and signature verification rejects tampering', () => {
  const data = { orderCode: 123456789, amount: 9000, currency: 'VND', code: '00' };
  assert.equal(canonicalPayosData(data), 'amount=9000&code=00&currency=VND&orderCode=123456789');
  const signature = createPayosSignature(data, checksumKey);
  assert.equal(verifyPayosSignature(data, signature, checksumKey), true);
  assert.equal(verifyPayosSignature({ ...data, amount: 1 }, signature, checksumKey), false);
  assert.equal(verifyPayosSignature(data, 'bad', checksumKey), false);
});

test('verified webhook exposes a bounded digest event key and never stores the raw provider reference', () => {
  const data = {
    orderCode: 123456789,
    amount: 9000,
    currency: 'VND',
    paymentLinkId: 'payos-link-001',
    reference: 'TF-SECRET-PROVIDER-REFERENCE',
    code: '00',
    transactionDateTime: '2026-10-06T05:00:00+07:00',
  };
  const adapter = createPayosAdapter({ config: payosConfig() });
  const fact = adapter.verifyWebhook({ data, signature: createPayosSignature(data, checksumKey) });
  assert.equal(fact.status, 'paid');
  assert.equal(fact.currency, 'VND');
  assert.match(fact.providerEventKey, /^event:[a-f\d]{64}$/u);
  assert.equal(fact.providerEventKey.includes(data.reference), false);
  assert.equal(fact.payloadDigest.length, 64);
});

test('PayOS link creation signs the request and accepts only the official checkout origin', async () => {
  let sentRequest;
  const adapter = createPayosAdapter({
    config: payosConfig(),
    fetchImpl: async (url, options) => {
      sentRequest = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        async json() { return { code: '00', data: {
          orderCode: 123456789, amount: 9000, paymentLinkId: 'link-1', status: 'PENDING',
          checkoutUrl: 'https://pay.payos.vn/web/link-1',
        } }; },
      };
    },
  });
  const result = await adapter.createLink({
    amountVnd: 9000, providerOrderCode: 123456789,
    expiresAt: new Date('2026-10-06T06:00:00.000Z'),
    cancelUrl: 'https://shop.example.test/payment/cancel?orderId=1',
    returnUrl: 'https://shop.example.test/payment/return?orderId=1',
    description: 'TL00000001',
  });
  assert.equal(sentRequest.url, 'https://api-merchant.payos.vn/v2/payment-requests');
  assert.equal(sentRequest.options.headers['x-client-id'], 'test-client-id');
  const signed = {
    amount: 9000,
    cancelUrl: 'https://shop.example.test/payment/cancel?orderId=1',
    description: 'TL00000001',
    orderCode: 123456789,
    returnUrl: 'https://shop.example.test/payment/return?orderId=1',
  };
  assert.equal(sentRequest.body.signature, createPayosSignature(signed, checksumKey));
  assert.equal(result.checkoutUrl, 'https://pay.payos.vn/web/link-1');
});

test('PayOS link creation rejects a provider response that could redirect away from PayOS', async () => {
  const adapter = createPayosAdapter({
    config: payosConfig(),
    fetchImpl: async () => ({
      ok: true,
      async json() { return { code: '00', data: {
        orderCode: 123456789, amount: 9000, paymentLinkId: 'link-1', status: 'PENDING',
        checkoutUrl: 'https://payos.evil.example/checkout',
      } }; },
    }),
  });
  await assert.rejects(adapter.createLink({
    amountVnd: 9000, providerOrderCode: 123456789,
    expiresAt: new Date('2026-10-06T06:00:00.000Z'),
    cancelUrl: 'https://shop.example.test/payment/cancel',
    returnUrl: 'https://shop.example.test/payment/return',
    description: 'TL00000001',
  }), (error) => error.code === 'PAYOS_RESPONSE_INVALID');
});
