export class ServiceError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
    this.code = code;
    if (Array.isArray(details)) this.details = details;
  }
}

export function badRequest(code = 'BAD_REQUEST', message = 'Yêu cầu không hợp lệ', details) {
  return new ServiceError(400, code, message, details);
}

export function forbidden(code = 'FORBIDDEN', message = 'Bạn không có quyền thực hiện thao tác này') {
  return new ServiceError(403, code, message);
}

export function notFound(message = 'Không tìm thấy tài nguyên') {
  return new ServiceError(404, 'NOT_FOUND', message);
}

export function conflict(code = 'VERSION_CONFLICT', message = 'Dữ liệu đã thay đổi. Hãy tải lại và thử lại') {
  return new ServiceError(409, code, message);
}

export function unavailable(code = 'DATABASE_UNAVAILABLE', message = 'Dịch vụ tạm thời chưa sẵn sàng') {
  return new ServiceError(503, code, message);
}
