import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhotonAdapter } from '../../src/services/integrations/photon/photon.adapter.js';

const feature = { countrycode: 'VN', street: 'Phố Lê Thái Tổ', district: 'Hoàn Kiếm', city: 'Hà Nội', country: 'Việt Nam' };
test('Photon rounds coordinates, sends no identity, caches suggestions and limits provider calls', async () => {
  let calls = 0;
  let clock = 1000;
  const signal = new AbortController().signal;
  const adapter = createPhotonAdapter({ enabled: true, now: () => clock, fetchImpl: async (url, options) => {
    calls += 1;
    assert.equal(url.origin, 'https://photon.komoot.io');
    assert.equal(url.searchParams.get('lat'), '21.028');
    assert.equal(url.searchParams.get('lon'), '105.852');
    assert.deepEqual([...url.searchParams.keys()], ['lat', 'lon', 'limit']);
    assert.equal(options.signal, signal);
    assert.equal(options.redirect, 'error');
    return { ok: true, async json() { return { features: [{ properties: feature }] }; } };
  } });
  const input = { lat: 21.028123, lng: 105.852234, signal };
  const first = await adapter.reverse(input);
  assert.equal(first.suggestedAddress.province, 'Hà Nội');
  first.suggestedAddress.province = 'Changed locally';
  assert.equal((await adapter.reverse(input)).suggestedAddress.province, 'Hà Nội');
  assert.equal(calls, 1);
  await assert.rejects(adapter.reverse({ ...input, lat: 21.029 }), /busy/);
  clock += 15 * 60 * 1000;
  await adapter.reverse(input);
  assert.equal(calls, 2);
});
test('Photon refuses disabled, upstream errors, incomplete and foreign address results', async () => {
  await assert.rejects(createPhotonAdapter().reverse({ lat: 21, lng: 105 }), /unavailable/);
  for (const response of [
    { ok: false },
    { ok: true, json: async () => ({ features: [] }) },
    { ok: true, json: async () => ({ features: [{ properties: { ...feature, countrycode: 'FR' } }] }) },
    { ok: true, json: async () => ({ features: [{ properties: { countrycode: 'VN' } }] }) },
  ]) {
    await assert.rejects(createPhotonAdapter({ enabled: true, fetchImpl: async () => response }).reverse({ lat: 21, lng: 105 }));
  }
});
