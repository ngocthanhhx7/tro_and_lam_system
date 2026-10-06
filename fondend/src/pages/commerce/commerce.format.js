export const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
export const formatMoney = (value) => money.format(Number.isSafeInteger(value) ? value : 0);
export const formatDate = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—';

export const orderStatusLabel = Object.freeze({
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', processing: 'Đang chuẩn bị',
  shipped: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy',
  return_requested: 'Đang xử lý yêu cầu trả hàng', returned: 'Đã nhận hàng trả',
});

export const paymentStatusLabel = Object.freeze({
  pending: 'Chờ thanh toán', paid: 'Đã xác minh thanh toán', failed: 'Thanh toán thất bại',
  expired: 'Đã hết hạn', cancelled: 'Đã hủy thanh toán', refund_pending: 'Đang xử lý hoàn tiền',
  refunded: 'Đã hoàn tiền', partially_refunded: 'Đã hoàn một phần',
});

export function errorText(error, fallback) {
  return error?.message || fallback;
}
