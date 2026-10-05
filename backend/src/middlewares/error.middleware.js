export function notFound(_req, res) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên' } }); }

export function errorHandler(error, _req, res, _next) {
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  const code = status === 413 ? 'PAYLOAD_TOO_LARGE' : status < 500 ? 'BAD_REQUEST' : 'INTERNAL_ERROR';
  res.status(status).json({ error: { code, message: status === 413 ? 'Dữ liệu vượt giới hạn cho phép' : status < 500 ? 'Yêu cầu không hợp lệ' : 'Lỗi máy chủ' } });
}
