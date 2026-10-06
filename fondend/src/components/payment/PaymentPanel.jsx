import { useState } from 'react';
import { paymentsApi } from '../../services/payments/payments.api.js';
import './payment.css';

function createIdempotencyKey(orderId) {
  const storageKey = `tro-lam:payment-attempt:${orderId}`;
  try {
    const existing = globalThis.sessionStorage.getItem(storageKey);
    if (existing && /^[a-f\d]{48}$/iu.test(existing)) return existing;
  } catch { /* Storage can be disabled in private browsing; request remains idempotent in this view. */ }
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  const key = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  try { globalThis.sessionStorage.setItem(storageKey, key); } catch { /* Keep this key in component state. */ }
  return key;
}

export default function PaymentPanel({ orderId, paymentMethod, paymentStatus, orderStatus, reviewRequired = false }) {
  const [requestKey] = useState(() => createIdempotencyKey(orderId));
  const [attempt, setAttempt] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (paymentMethod !== 'payos') return null;
  const canCreate = orderStatus === 'pending' && ['pending', 'failed', 'expired', 'cancelled'].includes(paymentStatus);

  async function createAttempt() {
    setBusy(true);
    setError('');
    try {
      const response = await paymentsApi.createPaymentAttempt(orderId, requestKey);
      setAttempt(response.data);
    } catch (requestError) {
      setError(requestError.message || 'Không thể tạo liên kết thanh toán. Đơn hàng vẫn được giữ để thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="payment-panel" aria-labelledby="payment-panel-title">
    <div>
      <p className="payment-eyebrow">Thanh toán trực tuyến</p>
      <h2 id="payment-panel-title">PayOS</h2>
      <p className="payment-copy">TRO &amp; LAM chỉ xác nhận đơn sau khi nhận được thông báo đã ký từ PayOS.</p>
    </div>
    {paymentStatus === 'paid' && <div className="payment-result" role="status">
      {reviewRequired ? <p>Khoản thanh toán đã đến nhưng cần được kiểm tra trước khi đơn được xác nhận giao.</p>
        : <p>Thanh toán đã được xác nhận từ PayOS.</p>}
    </div>}
    {paymentStatus !== 'paid' && attempt?.checkoutUrl ? <div className="payment-result">
      <p>Liên kết thanh toán đã sẵn sàng. Hoàn tất tại trang PayOS để chúng tôi tự đối soát.</p>
      <a className="payment-button" href={attempt.checkoutUrl} target="_blank" rel="noopener noreferrer">Mở PayOS</a>
      <p className="payment-expiry">Liên kết hết hạn: {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(attempt.expiresAt))}</p>
    </div> : paymentStatus !== 'paid' && <div className="payment-result">
      {error && <p className="payment-error" role="alert">{error}</p>}
      {!canCreate && <p role="status">Đơn hàng không còn ở trạng thái có thể tạo liên kết mới.</p>}
      <button type="button" className="payment-button" onClick={createAttempt} disabled={busy || !canCreate}>
        {busy ? 'Đang kết nối PayOS…' : 'Tạo liên kết thanh toán'}
      </button>
    </div>}
  </section>;
}
