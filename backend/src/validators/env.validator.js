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

  const configuredOutboxKey = source.OUTBOX_ENCRYPTION_KEY || '';
  if (configuredOutboxKey) {
    const decoded = Buffer.from(configuredOutboxKey, 'base64');
    if (decoded.length !== 32 || decoded.toString('base64').replace(/=+$/u, '') !== configuredOutboxKey.replace(/=+$/u, '')) {
      throw new Error('OUTBOX_ENCRYPTION_KEY phải là Base64 của 32 byte ngẫu nhiên');
    }
  } else if (nodeEnv === 'production') {
    throw new Error('Cần cấu hình OUTBOX_ENCRYPTION_KEY trong production');
  }

  const smtpHost = source.SMTP_HOST || '';
  const smtpPortSource = source.SMTP_PORT || '';
  const smtpUser = source.SMTP_USER || '';
  const smtpPassword = source.SMTP_PASSWORD || '';
  const smtpFrom = source.SMTP_FROM || '';
  const smtpConfigured = [smtpHost, smtpPortSource, smtpUser, smtpPassword, smtpFrom].some(Boolean);
  const smtpSecure = booleanSetting(source, 'SMTP_SECURE', false);
  const smtpTimeoutMs = Number(source.SMTP_TIMEOUT_MS || 15_000);
  let smtpPort;
  if (smtpConfigured) {
    if (![smtpHost, smtpPortSource, smtpUser, smtpPassword, smtpFrom].every(Boolean)) {
      throw new Error('Cấu hình SMTP cần có đầy đủ SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD và SMTP_FROM');
    }
    smtpPort = Number(smtpPortSource);
    if (!/^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/u.test(smtpHost)
      || !Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535
      || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u.test(smtpFrom)
      || /[\r\n]/u.test(smtpUser) || /[\r\n]/u.test(smtpPassword)) {
      throw new Error('Cấu hình SMTP không hợp lệ');
    }
  }
  if (!Number.isInteger(smtpTimeoutMs) || smtpTimeoutMs < 100 || smtpTimeoutMs > 120_000) {
    throw new Error('SMTP_TIMEOUT_MS phải nằm trong 100–120000');
  }

  const supportInboxEmail = source.SUPPORT_INBOX_EMAIL || '';
  if (supportInboxEmail && !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u.test(supportInboxEmail)) {
    throw new Error('SUPPORT_INBOX_EMAIL không hợp lệ');
  }

  const payosEnabled = booleanSetting(source, 'PAYOS_ENABLED', false);
  const payosClientId = source.PAYOS_CLIENT_ID || '';
  const payosApiKey = source.PAYOS_API_KEY || '';
  const payosChecksumKey = source.PAYOS_CHECKSUM_KEY || '';
  const payosTimeoutMs = Number(source.PAYOS_TIMEOUT_MS || 10_000);
  if (payosEnabled && ![payosClientId, payosApiKey, payosChecksumKey].every(Boolean)) {
    throw new Error('PAYOS_ENABLED yêu cầu cấu hình PAYOS_CLIENT_ID, PAYOS_API_KEY và PAYOS_CHECKSUM_KEY');
  }
  if (!Number.isInteger(payosTimeoutMs) || payosTimeoutMs < 100 || payosTimeoutMs > 60_000) {
    throw new Error('PAYOS_TIMEOUT_MS phải nằm trong 100–60000');
  }

  const geminiApiKey = source.GEMINI_API_KEY || '';
  const geminiModel = source.GEMINI_MODEL || '';
  if (geminiModel && !/^[A-Za-z0-9._-]{1,128}$/u.test(geminiModel)) throw new Error('GEMINI_MODEL không hợp lệ');
  const aiTimeoutMs = Number(source.AI_TIMEOUT_MS || 10_000);
  const aiDailyBudget = Number(source.AI_DAILY_BUDGET || 0);
  if (!Number.isInteger(aiTimeoutMs) || aiTimeoutMs < 100 || aiTimeoutMs > 15_000) {
    throw new Error('AI_TIMEOUT_MS phải nằm trong 100–15000');
  }
  if (!Number.isSafeInteger(aiDailyBudget) || aiDailyBudget < 0 || aiDailyBudget > 100_000_000) {
    throw new Error('AI_DAILY_BUDGET phải là số nguyên từ 0 đến 100000000');
  }

  const reservationSweepIntervalMs = Number(source.RESERVATION_SWEEP_INTERVAL_MS || 30_000);
  const paymentReconciliationIntervalMs = Number(source.PAYMENT_RECONCILIATION_INTERVAL_MS || 60_000);
  for (const [name, value] of Object.entries({ reservationSweepIntervalMs, paymentReconciliationIntervalMs })) {
    if (!Number.isInteger(value) || value < 1_000 || value > 3_600_000) {
      throw new Error(`${name === 'reservationSweepIntervalMs' ? 'RESERVATION_SWEEP_INTERVAL_MS' : 'PAYMENT_RECONCILIATION_INTERVAL_MS'} phải nằm trong 1000–3600000`);
    }
  }
  const backgroundWorkersEnabled = booleanSetting(source, 'BACKGROUND_WORKERS_ENABLED', true);

  return {
    nodeEnv, port, mongoUri, corsOrigin, origins, trustProxy, csrfSecret, publicWebUrl: publicWebOrigin,
    sessionCookieName: cookieName(source, 'SESSION_COOKIE_NAME', 'tl_session'),
    restrictedCookieName: cookieName(source, 'RESTRICTED_COOKIE_NAME', 'tl_appeal'),
    guestOrderCookieName: cookieName(source, 'GUEST_ORDER_COOKIE_NAME', 'tl_guest_order'),
    csrfCookieName: cookieName(source, 'CSRF_COOKIE_NAME', 'tl_csrf'),
    cookiePath, sameSite, secureCookies,
    outboxEncryptionKey: configuredOutboxKey || randomBytes(32).toString('base64'),
    smtpConfigured, smtpHost, smtpPort, smtpUser, smtpPassword, smtpFrom, smtpSecure, smtpTimeoutMs,
    supportInboxEmail,
    payosEnabled, payosClientId, payosApiKey, payosChecksumKey, payosTimeoutMs,
    geminiApiKey, geminiModel, aiTimeoutMs, aiDailyBudget,
    reservationSweepIntervalMs, paymentReconciliationIntervalMs,
    backgroundWorkersEnabled,
  };
}
