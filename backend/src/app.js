import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { API_PREFIX } from './constants/http.js';
import { createHealthRouter } from './routes/health.routes.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import { isDatabaseReady as defaultReadiness } from './config/database.js';

export function createApp({ corsOrigin = 'http://localhost:5173', trustProxy = 0, isDatabaseReady = defaultReadiness } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use(helmet());
  app.use(cors({ origin: corsOrigin }));
  app.use(`${API_PREFIX}/health`, createHealthRouter(isDatabaseReady));
  app.use(API_PREFIX, rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
