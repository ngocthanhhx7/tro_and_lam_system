import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { API_PREFIX } from './constants/http.js';
import { createHealthRouter } from './routes/health.routes.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import { requestContext } from './middlewares/request-context.middleware.js';
import { isDatabaseReady as defaultReadiness } from './config/database.js';
import { ServiceError } from './utils/serviceError.js';

function normalizeOrigins(corsOrigin) {
  const entries = Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin];
  return new Set(entries.flatMap((value) => String(value ?? '').split(',')).map((origin) => origin.trim()).filter(Boolean));
}

export function createApp({
  corsOrigin = 'http://localhost:5173',
  trustProxy = 0,
  isDatabaseReady = defaultReadiness,
  domainRouters = [],
  mediaStaticDirectory,
  apiRateLimitLimit = 100,
  apiRateLimitWindowMs = 15 * 60 * 1000,
} = {}) {
  if (!Number.isSafeInteger(apiRateLimitLimit) || apiRateLimitLimit < 1) {
    throw new TypeError('API rate limit must be a positive safe integer');
  }
  if (!Number.isSafeInteger(apiRateLimitWindowMs) || apiRateLimitWindowMs < 1) {
    throw new TypeError('API rate limit window must be a positive safe integer');
  }
  const app = express();
  const allowedOrigins = normalizeOrigins(corsOrigin);
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use(helmet());
  app.use(requestContext);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(Object.assign(new Error('Origin không được phép'), { status: 403, code: 'CORS_ORIGIN_DENIED' }));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  }));
  app.use(`${API_PREFIX}/health`, createHealthRouter(isDatabaseReady));
  if (mediaStaticDirectory) {
    app.use('/media/products', express.static(mediaStaticDirectory, {
      dotfiles: 'deny',
      fallthrough: true,
      index: false,
      immutable: true,
      maxAge: '1y',
    }));
  }
  app.use(API_PREFIX, rateLimit({
    windowMs: apiRateLimitWindowMs,
    limit: apiRateLimitLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new ServiceError(429, 'RATE_LIMITED', 'Quá nhiều yêu cầu. Vui lòng thử lại sau')),
  }));
  app.use(express.json({ limit: '100kb' }));
  for (const route of domainRouters) {
    if (!route || typeof route.router !== 'function') throw new TypeError('Domain router phải có Express router hợp lệ');
    const prefix = typeof route.prefix === 'string' ? route.prefix : '';
    if (prefix && !prefix.startsWith('/')) throw new TypeError('Domain route prefix phải bắt đầu bằng /');
    app.use(`${API_PREFIX}${prefix}`, route.router);
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
