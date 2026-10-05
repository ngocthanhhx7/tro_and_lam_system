import { randomUUID } from 'node:crypto';

export function requestContext(_req, res, next) {
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
