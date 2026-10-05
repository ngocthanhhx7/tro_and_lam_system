function requestIdOf(res) {
  return res.locals.requestId;
}

export function sendSuccess(res, data, { status = 200, meta = {} } = {}) {
  return res.status(status).json({ data, meta: { ...meta, requestId: requestIdOf(res) } });
}

export function sendAccepted(res, data, options = {}) {
  return sendSuccess(res, data, { ...options, status: 202 });
}

export function sendCreated(res, data, options = {}) {
  return sendSuccess(res, data, { ...options, status: 201 });
}

export function sendPaginated(res, data, pagination, options = {}) {
  return sendSuccess(res, data, { ...options, meta: { ...options.meta, pagination } });
}

export function sendNoContent(res) {
  return res.status(204).end();
}
