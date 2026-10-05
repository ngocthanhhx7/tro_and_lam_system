import { randomBytes } from 'node:crypto';

function booleanSetting(source, name, fallback) {
  if (source[name] === undefined || source[name] === '') return fallback;
  if (source[name] === 'true' || source[name] === '1') return true;
  if (source[name] === 'false' || source[name] === '0') return false;
  throw new Error(`${name} chỉ nhận true/false`);
}

function cookieName(source, name, fallback) {
  const value = source[name] || fallback;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw new Error(`${name} không hợp lệ`);
  return value;
}

export function validateEnv(source) {
  const nodeEnv = source.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV không hợp lệ');
  const port = Number(source.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT phải nằm trong 1–65535');
  const mongoUri = source.MONGODB_URI;
  if (!mongoUri || !/^mongodb(?:\+srv)?:\/\//.test(mongoUri) || /USERNAME|PASSWORD|CLUSTER/.test(mongoUri)) throw new Error('Cần cấu hình MONGODB_URI thật trong backend/.env');
  const corsOrigin = source.CORS_ORIGIN || (nodeEnv === 'production' ? '' : 'http://localhost:5173');
  const origins = corsOrigin.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (origins.length === 0) throw new Error('Cần cấu hình ít nhất một CORS_ORIGIN trong production');
  for (const configuredOrigin of origins) {
    let origin;
    try { origin = new URL(configuredOrigin); } catch { throw new Error('CORS_ORIGIN phải là HTTP(S) origin'); }
    if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== configuredOrigin) {
      throw new Error('Mỗi CORS_ORIGIN phải là HTTP(S) origin, không có path');
    }
  }
  const trustProxy = Number(source.TRUST_PROXY || 0);
  if (![0, 1].includes(trustProxy)) throw new Error('TRUST_PROXY chỉ nhận 0 hoặc 1');

  const configuredCsrfSecret = source.CSRF_SECRET || '';
  if (configuredCsrfSecret && configuredCsrfSecret.length < 32) throw new Error('CSRF_SECRET cần ít nhất 32 ký tự ngẫu nhiên');
  if (nodeEnv === 'production' && !configuredCsrfSecret) throw new Error('Cần cấu hình CSRF_SECRET trong production');
  const csrfSecret = configuredCsrfSecret || randomBytes(32).toString('base64url');

  const publicWebUrl = source.PUBLIC_WEB_URL || (nodeEnv === 'production' ? '' : 'http://localhost:5173');
  let publicWebOrigin;
  try {
    const url = new URL(publicWebUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== publicWebUrl || (nodeEnv === 'production' && url.protocol !== 'https:')) throw new Error('origin');
    publicWebOrigin = url.origin;
  } catch {
    throw new Error('PUBLIC_WEB_URL phải là HTTP(S) origin, HTTPS trong production và không có path');
  }

  const sameSite = source.COOKIE_SAME_SITE || 'Lax';
  if (!['Strict', 'Lax', 'None'].includes(sameSite)) throw new Error('COOKIE_SAME_SITE chỉ nhận Strict, Lax hoặc None');
  const secureCookies = booleanSetting(source, 'SECURE_COOKIES', nodeEnv === 'production');
  if (nodeEnv === 'production' && !secureCookies) throw new Error('SECURE_COOKIES phải bật trong production');
  if (sameSite === 'None' && !secureCookies) throw new Error('SameSite=None yêu cầu SECURE_COOKIES=true');
  const cookiePath = source.COOKIE_PATH || '/api/v1';
  if (!cookiePath.startsWith('/') || /[;\r\n]/.test(cookiePath)) throw new Error('COOKIE_PATH không hợp lệ');

  return {
    nodeEnv, port, mongoUri, corsOrigin, origins, trustProxy, csrfSecret, publicWebUrl: publicWebOrigin,
    sessionCookieName: cookieName(source, 'SESSION_COOKIE_NAME', 'tl_session'),
    restrictedCookieName: cookieName(source, 'RESTRICTED_COOKIE_NAME', 'tl_appeal'),
    guestOrderCookieName: cookieName(source, 'GUEST_ORDER_COOKIE_NAME', 'tl_guest_order'),
    csrfCookieName: cookieName(source, 'CSRF_COOKIE_NAME', 'tl_csrf'),
    cookiePath, sameSite, secureCookies,
  };
}
