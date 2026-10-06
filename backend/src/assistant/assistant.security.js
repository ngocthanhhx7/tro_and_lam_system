const MAX_TEXT_LENGTH = 5000;

const REDACTORS = Object.freeze([
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, replacement: '[đã ẩn email]' },
  { pattern: /(?<![\p{L}\p{N}])(?:\+?84|0)(?:[\s().-]*\d){8,10}(?!\d)/gu, replacement: '[đã ẩn số điện thoại]' },
  { pattern: /\b(?:\d[ -]?){13,19}\b/gu, replacement: '[đã ẩn số thẻ]' },
  { pattern: /\bTL[- ]?[A-Z0-9]{4,}\b/giu, replacement: '[đã ẩn mã đơn]' },
  { pattern: /\b(?:OTP|mã\s*(?:xác\s*nhận|đơn|OTP)|verification\s*code|password|mật\s*khẩu|API[\s_-]*key|token|bearer)\s*[:=]\s*[^\s,;]{3,200}/giu, replacement: '[đã ẩn thông tin xác thực]' },
  { pattern: /(?:địa\s*chỉ|address|số\s*nhà|line1)\s*[:=]\s*[^\n;]{1,240}/giu, replacement: '[đã ẩn địa chỉ]' },
  { pattern: /(?:tên|name)\s*[:=]\s*[^,;\n]{1,120}/giu, replacement: '[đã ẩn tên]' },
  { pattern: /\b\d{6}\b/gu, replacement: '[đã ẩn mã số]' },
]);

export function redactSensitiveText(value, { maxLength = MAX_TEXT_LENGTH } = {}) {
  let text = String(value ?? '').normalize('NFKC').slice(0, maxLength);
  for (const { pattern, replacement } of REDACTORS) text = text.replace(pattern, replacement);
  return text.replaceAll('\0', ' ').trim();
}

export function safeSlug(value) {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value);
}
