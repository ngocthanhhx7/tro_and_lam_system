import test from 'node:test';
import assert from 'node:assert/strict';
import { businessSettingsDrafts, parseBusinessSettingsDrafts } from '../../src/services/operations/businessSettingsForm.js';

test('settings editor leaves absent owner configuration pending and serializes only edited groups', () => {
  const drafts = businessSettingsDrafts({ codEnabled: false, supportWindows: { weekdays: [] } });
  assert.equal(drafts.shippingZones, '');
  assert.deepEqual(parseBusinessSettingsDrafts(drafts, new Set(['codEnabled'])), { codEnabled: false });
});

test('settings editor parses JSON arrays and objects with exact root shapes', () => {
  const values = parseBusinessSettingsDrafts({ shippingZones: '[]', checkoutLimits: '{"maxPendingCodOrders": 4}' }, new Set(['shippingZones', 'checkoutLimits']));
  assert.deepEqual(values, { shippingZones: [], checkoutLimits: { maxPendingCodOrders: 4 } });
  assert.throws(() => parseBusinessSettingsDrafts({ shippingZones: '{}' }, new Set(['shippingZones'])), /danh sách JSON/);
  assert.throws(() => parseBusinessSettingsDrafts({ checkoutLimits: '[]' }, new Set(['checkoutLimits'])), /đối tượng JSON/);
  assert.throws(() => parseBusinessSettingsDrafts({ checkoutLimits: '{"maximumItems": 4}' }, new Set(['checkoutLimits'])), /maxPendingCodOrders/);
  assert.throws(() => parseBusinessSettingsDrafts({ checkoutLimits: '{"maxPendingCodOrders": 0}' }, new Set(['checkoutLimits'])), /số nguyên dương/);
});

test('settings editor validates shipping zone shape, fees, and province uniqueness', () => {
  const values = parseBusinessSettingsDrafts({
    shippingZones: '[{"id":"mien-bac","provinceNames":["Hà Nội"],"feeVnd":30000}]',
  }, new Set(['shippingZones']));
  assert.equal(values.shippingZones[0].feeVnd, 30000);
  assert.deepEqual(parseBusinessSettingsDrafts({ shippingZones: '[]' }, new Set(['shippingZones'])), { shippingZones: [] });
  assert.throws(() => parseBusinessSettingsDrafts({ shippingZones: '[{"id":"zone","provinceNames":["Hà Nội"],"feeVnd":-1}]' }, new Set(['shippingZones'])), /số nguyên VND/);
  assert.throws(() => parseBusinessSettingsDrafts({ shippingZones: '[{"id":"north","provinceNames":["Hà Nội"],"feeVnd":30000},{"id":"south","provinceNames":["Ha Noi"],"feeVnd":40000}]' }, new Set(['shippingZones'])), /chỉ được gán vào một vùng/);
  assert.throws(() => parseBusinessSettingsDrafts({ shippingZones: '[{"id":"zone","name":"Miền Bắc","provinceNames":["Hà Nội"],"feeVnd":30000}]' }, new Set(['shippingZones'])), /chỉ gồm id/);
});

test('settings editor rejects malformed values and unsupported keys before sending the request', () => {
  assert.throws(() => parseBusinessSettingsDrafts({ supportWindows: '{' }, new Set(['supportWindows'])), /JSON hợp lệ/);
  assert.throws(() => parseBusinessSettingsDrafts({ codEnabled: '' }, new Set(['codEnabled'])), /Chọn trạng thái COD/);
  assert.throws(() => parseBusinessSettingsDrafts({ smtpPassword: 'secret' }, new Set(['smtpPassword'])), /không được hỗ trợ/);
});
