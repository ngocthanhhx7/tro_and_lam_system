import test from 'node:test';
import assert from 'node:assert/strict';
import { payosCheckoutUrl, startHostedCheckout } from '../../fondend/src/services/payments/hostedCheckout.js';

test('PayOS checkout creates an attempt for the committed order and automatically opens the returned QR checkout', async () => {
  const calls = [];
  const url = 'https://pay.payos.vn/web/local-test-only';
  const result = await startHostedCheckout({ orderId: 'local-order', requestKey: 'same-idempotency-key',
    createAttempt: async (id, key) => { calls.push(['create', id, key]); return { data: { checkoutUrl: url, status: 'pending' } }; },
    redirect: value => calls.push(['redirect', value]) });
  assert.deepEqual(calls, [['create', 'local-order', 'same-idempotency-key'], ['redirect', url]]);
  assert.equal(result.status, 'pending', 'opening a payment link does not mark payment as paid');
});
test('invalid or failed PayOS link creation never navigates away or creates a second order', async () => {
  for (const url of ['http://pay.payos.vn/web/test', 'https://pay.payos.vn.evil.test/web/test', 'https://evil.test', 'https://secret@pay.payos.vn/web/test', 'javascript:alert(1)', undefined]) {
    assert.throws(() => payosCheckoutUrl(url));
  }
  let navigated = false;
  await assert.rejects(startHostedCheckout({ createAttempt: async () => { throw new Error('Temporary provider failure'); }, redirect: () => { navigated = true; } }), /Temporary provider failure/);
  assert.equal(navigated, false);
});
