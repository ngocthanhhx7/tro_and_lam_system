import test from 'node:test';
import assert from 'node:assert/strict';
import { createShippingZoneQuotePort, quoteConfiguredShippingFeeVnd } from '../../src/services/commerce/shipping-zones.js';

test('shipping quote matches an explicitly configured province after case, accent, and whitespace normalization', async () => {
  const port = createShippingZoneQuotePort();
  const feeVnd = await port.quoteFeeVnd({
    settings: { shippingZones: [{ id: 'mien-nam', provinceNames: ['Thành phố Hồ Chí Minh'], feeVnd: 28000 }] },
    recipient: { province: '  THANH   PHO HO Chi Minh ' },
  });
  assert.equal(feeVnd, 28000);
});

test('shipping quote accepts an explicitly configured zero fee', () => {
  assert.equal(quoteConfiguredShippingFeeVnd(
    { shippingZones: [{ id: 'noi-thanh', provinceNames: ['Hà Nội'], feeVnd: 0 }] },
    { province: 'Ha Noi' },
  ), 0);
});

test('shipping quote fails closed without a configured zone or an explicit matching province', () => {
  const settings = { shippingZones: [{ id: 'mien-bac', provinceNames: ['Hà Nội'], feeVnd: 30000 }] };
  for (const recipient of [{}, { province: 'Hồ Chí Minh' }]) {
    assert.throws(() => quoteConfiguredShippingFeeVnd(settings, recipient), { status: 503, code: 'DATABASE_UNAVAILABLE' });
  }
  assert.throws(() => quoteConfiguredShippingFeeVnd({ shippingZones: [] }, { province: 'Hà Nội' }), {
    status: 503, code: 'DATABASE_UNAVAILABLE',
  });
});

test('shipping quote fails closed for malformed or overlapping stored zones', () => {
  assert.throws(() => quoteConfiguredShippingFeeVnd({ shippingZones: [{ id: 'zone', provinceNames: ['Hà Nội'], feeVnd: -1 }] }, { province: 'Hà Nội' }), {
    status: 503, code: 'DATABASE_UNAVAILABLE',
  });
  assert.throws(() => quoteConfiguredShippingFeeVnd({ shippingZones: [
    { id: 'north-a', provinceNames: ['Hà Nội'], feeVnd: 30000 },
    { id: 'north-b', provinceNames: ['Ha Noi'], feeVnd: 40000 },
  ] }, { province: 'Hà Nội' }), { status: 503, code: 'DATABASE_UNAVAILABLE' });
});
