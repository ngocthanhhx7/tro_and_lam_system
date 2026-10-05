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

test('settings editor rejects malformed values and unsupported keys before sending the request', () => {
  assert.throws(() => parseBusinessSettingsDrafts({ supportWindows: '{' }, new Set(['supportWindows'])), /JSON hợp lệ/);
  assert.throws(() => parseBusinessSettingsDrafts({ codEnabled: '' }, new Set(['codEnabled'])), /Chọn trạng thái COD/);
  assert.throws(() => parseBusinessSettingsDrafts({ smtpPassword: 'secret' }, new Set(['smtpPassword'])), /không được hỗ trợ/);
});
