const BUSINESS_SETTING_KEYS = Object.freeze(['shippingZones', 'codEnabled', 'checkoutLimits', 'supportWindows']);

function normalizeProvinceName(value) {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/đ/giu, 'd').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('vi-VN');
}

function validateShippingZones(zones) {
  if (zones.length > 100) throw new TypeError('shippingZones không được vượt quá 100 vùng.');
  const ids = new Set();
  const provinces = new Set();
  zones.forEach((zone, index) => {
    if (!zone || typeof zone !== 'object' || Array.isArray(zone)) throw new TypeError(`shippingZones[${index}] cần là đối tượng.`);
    const keys = Object.keys(zone);
    if (keys.length !== 3 || keys.some((key) => !['id', 'provinceNames', 'feeVnd'].includes(key))) {
      throw new TypeError(`shippingZones[${index}] chỉ gồm id, provinceNames và feeVnd.`);
    }
    if (typeof zone.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(zone.id) || zone.id.length > 80) {
      throw new TypeError(`shippingZones[${index}].id cần là mã chữ/số hợp lệ.`);
    }
    const id = zone.id.toLowerCase();
    if (ids.has(id)) throw new TypeError('id vùng giao hàng không được trùng.');
    ids.add(id);
    if (!Array.isArray(zone.provinceNames) || zone.provinceNames.length < 1 || zone.provinceNames.length > 100) {
      throw new TypeError(`shippingZones[${index}].provinceNames cần có từ 1 đến 100 tỉnh/thành.`);
    }
    for (const name of zone.provinceNames) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
        throw new TypeError('Tên tỉnh/thành cần có từ 1 đến 100 ký tự.');
      }
      const normalized = normalizeProvinceName(name);
      if (provinces.has(normalized)) throw new TypeError('Mỗi tỉnh/thành chỉ được gán vào một vùng giao hàng.');
      provinces.add(normalized);
    }
    if (!Number.isSafeInteger(zone.feeVnd) || zone.feeVnd < 0) {
      throw new TypeError(`shippingZones[${index}].feeVnd cần là số nguyên VND không âm.`);
    }
  });
}

/** Parse only changed fields so an unset setting stays pending until an admin configures it. */
export function parseBusinessSettingsDrafts(drafts, dirtyKeys) {
  const values = {};
  for (const key of dirtyKeys) {
    if (!BUSINESS_SETTING_KEYS.includes(key)) throw new TypeError(`Cấu hình ${key} không được hỗ trợ`);
    if (key === 'codEnabled') {
      if (drafts[key] !== 'true' && drafts[key] !== 'false') throw new TypeError('Chọn trạng thái COD trước khi lưu.');
      values[key] = drafts[key] === 'true';
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(drafts[key]);
    } catch {
      throw new TypeError(`Nội dung ${key} cần là JSON hợp lệ.`);
    }
    const validRoot = key === 'shippingZones'
      ? Array.isArray(parsed)
      : parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
    if (!validRoot) {
      throw new TypeError(key === 'shippingZones' ? 'shippingZones cần là một danh sách JSON.' : `${key} cần là một đối tượng JSON.`);
    }
    if (key === 'shippingZones') validateShippingZones(parsed);
    if (key === 'checkoutLimits') {
      if (Object.keys(parsed).some((name) => name !== 'maxPendingCodOrders')) {
        throw new TypeError('checkoutLimits chỉ hỗ trợ maxPendingCodOrders.');
      }
      if (parsed.maxPendingCodOrders !== undefined
        && (!Number.isSafeInteger(parsed.maxPendingCodOrders) || parsed.maxPendingCodOrders < 1)) {
        throw new TypeError('maxPendingCodOrders cần là số nguyên dương.');
      }
    }
    values[key] = parsed;
  }
  if (Object.keys(values).length === 0) throw new TypeError('Chưa có thay đổi để lưu.');
  return values;
}

export function businessSettingsDrafts(values = {}) {
  return {
    shippingZones: values.shippingZones === undefined ? '' : JSON.stringify(values.shippingZones, null, 2),
    codEnabled: values.codEnabled === undefined ? '' : String(values.codEnabled),
    checkoutLimits: values.checkoutLimits === undefined ? '' : JSON.stringify(values.checkoutLimits, null, 2),
    supportWindows: values.supportWindows === undefined ? '' : JSON.stringify(values.supportWindows, null, 2),
  };
}
