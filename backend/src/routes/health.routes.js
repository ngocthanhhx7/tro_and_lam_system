import { Router } from 'express';
import { liveness, readiness } from '../controllers/health.controller.js';

export function createHealthRouter(isDatabaseReady) {
  const router = Router();
  router.get('/', liveness);
  router.get('/live', liveness);
  router.get('/ready', readiness(isDatabaseReady));
  return router;
}
