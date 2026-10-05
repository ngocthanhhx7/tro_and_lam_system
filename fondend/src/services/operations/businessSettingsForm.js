const BUSINESS_SETTING_KEYS = Object.freeze(['shippingZones', 'codEnabled', 'checkoutLimits', 'supportWindows']);

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
