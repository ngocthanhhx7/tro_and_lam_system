import { unavailable } from '../../utils/serviceError.js';

function normalizeProvinceName(value) {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/đ/giu, 'd').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('vi-VN');
}

function unavailableQuote(message) {
  throw unavailable('DATABASE_UNAVAILABLE', message);
}

/** Quote only from owner-configured zones and an explicit recipient province. */
export function quoteConfiguredShippingFeeVnd(settings, recipient) {
  const zones = settings?.shippingZones;
  if (!Array.isArray(zones) || zones.length === 0) {
    unavailableQuote('Phí giao hàng chưa được chủ dự án cấu hình và xác nhận');
  }
  if (typeof recipient?.province !== 'string' || !recipient.province.trim()) {
    unavailableQuote('Cần tỉnh/thành đã xác nhận để tính phí giao hàng');
  }

  const zoneIds = new Set();
  const configuredProvinces = new Map();
  for (const zone of zones) {
    if (!zone || typeof zone !== 'object' || Array.isArray(zone)
      || typeof zone.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(zone.id)
      || !Array.isArray(zone.provinceNames) || zone.provinceNames.length === 0
      || !Number.isSafeInteger(zone.feeVnd) || zone.feeVnd < 0) {
      unavailableQuote('Cấu hình vùng hoặc phí giao hàng chưa hợp lệ');
    }
    const zoneId = zone.id.toLowerCase();
    if (zoneIds.has(zoneId)) unavailableQuote('Cấu hình vùng giao hàng bị trùng');
    zoneIds.add(zoneId);
    for (const name of zone.provinceNames) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
        unavailableQuote('Tên tỉnh/thành trong cấu hình giao hàng chưa hợp lệ');
      }
      const normalizedName = normalizeProvinceName(name);
      if (configuredProvinces.has(normalizedName)) unavailableQuote('Tỉnh/thành được gán vào nhiều vùng giao hàng');
      configuredProvinces.set(normalizedName, zone.feeVnd);
    }
  }

  const feeVnd = configuredProvinces.get(normalizeProvinceName(recipient.province));
  if (feeVnd === undefined) unavailableQuote('Không tìm thấy phí giao hàng đã cấu hình cho tỉnh/thành này');
  return feeVnd;
}

export function createShippingZoneQuotePort() {
  return Object.freeze({
    async quoteFeeVnd({ settings, recipient }) {
      return quoteConfiguredShippingFeeVnd(settings, recipient);
    },
  });
}
