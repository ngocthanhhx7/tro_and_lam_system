// Public Photon fair use: https://photon.komoot.io/. No customer identity is sent.
export function createPhotonAdapter({ enabled = false, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const cache = new Map();
  let nextRequestAt = 0;
  const text = value => typeof value === 'string' ? value.trim().slice(0, 200) : '';
  return Object.freeze({
    configured: enabled,
    async reverse({ lat, lng, signal }) {
      if (!enabled || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Geocoder unavailable');
      // About 100 m precision is sufficient for a suggestion that the customer must review.
      const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
      const timestamp = now();
      const cached = cache.get(key);
      if (cached && cached.expiresAt > timestamp) return structuredClone(cached.result);
      if (timestamp < nextRequestAt) throw new Error('Geocoder busy');
      nextRequestAt = timestamp + 1000;
      const url = new URL('https://photon.komoot.io/reverse');
      url.search = new URLSearchParams({ lat: lat.toFixed(3), lon: lng.toFixed(3), limit: '1' });
      const response = await fetchImpl(url, { signal, redirect: 'error', headers: {
        Accept: 'application/json', 'User-Agent': 'TRO-LAM/1.0 (https://trovalam.vn)',
      } });
      if (!response.ok) throw new Error('Geocoder unavailable');
      const body = await response.json();
      const properties = body?.features?.[0]?.properties;
      if (!properties || properties.countrycode?.toUpperCase() !== 'VN') throw new Error('No Vietnam address found');
      const line1 = [text(properties.housenumber), text(properties.street)].filter(Boolean).join(' ') || text(properties.name);
      const ward = text(properties.district || properties.locality);
      const province = text(properties.state || properties.city || properties.county);
      if (!line1 || !province) throw new Error('No usable address found');
      const result = { provider: 'Photon / OpenStreetMap', suggestedAddress: {
        line1, ward, province, postalCode: text(properties.postcode),
        formattedAddress: [...new Set([line1, ward, province, text(properties.country)].filter(Boolean))].join(', ').slice(0, 500),
      } };
      for (const [cacheKey, entry] of cache) if (entry.expiresAt <= timestamp) cache.delete(cacheKey);
      if (cache.size >= 128) cache.delete(cache.keys().next().value);
      cache.set(key, { result, expiresAt: timestamp + 15 * 60 * 1000 });
      return structuredClone(result);
    },
  });
}
