const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let csrfToken;
let csrfRequest;

export class ApiError extends Error {
  constructor({ status, code, message, details, requestId }) {
    super(message || 'Yêu cầu không thành công');
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'REQUEST_FAILED';
    this.details = details || [];
    this.requestId = requestId;
  }
}

function apiUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    throw new TypeError('Đường dẫn API phải là path tương đối bắt đầu bằng /');
  }
  return `${baseUrl}${path}`;
}

async function readResponse(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return response.json();
}

async function loadCsrfToken(signal) {
  if (csrfToken) return csrfToken;
  csrfRequest ||= fetch(apiUrl('/auth/csrf'), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  }).then(async (response) => {
    const body = await readResponse(response);
    if (!response.ok || typeof body?.data?.csrfToken !== 'string') {
      throw new ApiError({
        status: response.status,
        code: body?.error?.code || 'CSRF_UNAVAILABLE',
        message: body?.error?.message || 'Không thể khởi tạo bảo vệ yêu cầu',
        requestId: body?.meta?.requestId,
      });
    }
    csrfToken = body.data.csrfToken;
    return csrfToken;
  }).finally(() => { csrfRequest = undefined; });
  return csrfRequest;
}

export function clearCsrfToken() {
  csrfToken = undefined;
  csrfRequest = undefined;
}

export async function requestJson(path, options = {}) {
  const { signal, headers: inputHeaders, body: inputBody, ...rest } = options;
  const method = (rest.method || 'GET').toUpperCase();
  const headers = new Headers(inputHeaders);
  headers.set('Accept', 'application/json');
  let body = inputBody;

  if (unsafeMethods.has(method)) {
    headers.set('X-CSRF-Token', await loadCsrfToken(signal));
    if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(body);
    }
  }

  const response = await fetch(apiUrl(path), {
    ...rest,
    method,
    body,
    signal,
    headers,
    credentials: 'include',
  });
  const result = await readResponse(response);
  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: result?.error?.code,
      message: result?.error?.message || `Yêu cầu thất bại (${response.status})`,
      details: result?.error?.details,
      requestId: result?.meta?.requestId || response.headers.get('x-request-id'),
    });
  }
  return result;
}

export function getJson(path, { signal } = {}) {
  return requestJson(path, { signal });
}
