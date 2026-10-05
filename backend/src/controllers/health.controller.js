import { getReadiness } from '../services/health.service.js';

export function liveness(_req, res) { res.json({ status: 'ok' }); }
export function readiness(isDatabaseReady) {
  return (_req, res) => {
    const result = getReadiness(isDatabaseReady());
    res.status(result.status === 'ready' ? 200 : 503).json(result);
  };
}
