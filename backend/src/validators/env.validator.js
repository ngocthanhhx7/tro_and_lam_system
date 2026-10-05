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
  return { nodeEnv, port, mongoUri, corsOrigin, trustProxy };
}
