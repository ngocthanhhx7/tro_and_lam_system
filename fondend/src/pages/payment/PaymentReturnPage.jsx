import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { paymentsApi } from '../../services/payments/payments.api.js';
import '../../components/payment/payment.css';

const ORDER_ID = /^[a-f\d]{24}$/iu;

export default function PaymentReturnPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState(0);

  const refresh = useCallback(async (signal) => {
    if (!ORDER_ID.test(orderId)) return;
    setChecking(true);
    setError('');
    try {
      const response = await paymentsApi.getPaymentStatus(orderId, { signal });
      setPayment(response.data);
      setChecks((count) => count + 1);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setError(requestError.message || 'Chưa thể đối soát trạng thái thanh toán.');
    } finally {
      if (!signal?.aborted) setChecking(false);
    }
  }, [orderId]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => void refresh(controller.signal), 0);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [refresh]);

  useEffect(() => {
    if (!payment || payment.paymentStatus !== 'pending' || checks >= 5) return undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => void refresh(controller.signal), 2500);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [checks, payment, refresh]);

  const invalid = !ORDER_ID.test(orderId);
  const paid = payment?.paymentStatus === 'paid';
  const review = payment?.reviewRequired;
  return <main className="payment-page">
    <div className="payment-card">
      <p className="payment-eyebrow">TRO &amp; LAM · đơn hàng</p>
      <h1>{paid ? 'Đã xác nhận thanh toán' : review ? 'Đang kiểm tra giao dịch' : 'Đang đối soát với PayOS'}</h1>
      {invalid ? <p role="alert">Liên kết trả về không có mã đơn hợp lệ. Hãy mở lại đơn hàng từ tài khoản hoặc mã tra cứu của bạn.</p>
        : error ? <p className="payment-error" role="alert">{error}</p>
          : paid ? <p role="status">PayOS đã xác nhận. Trạng thái đơn được cập nhật từ hệ thống TRO &amp; LAM.</p>
            : review ? <p role="status">Giao dịch đã đến nhưng cần nhân viên kiểm tra trước khi đơn được xác nhận.</p>
              : payment ? <p role="status">{checking || checks < 5 ? 'PayOS đang hoàn tất thông báo. Trang sẽ kiểm tra thêm trong ít phút.' : 'Chưa nhận được xác nhận. Đơn hàng vẫn được lưu; bạn có thể tải lại trạng thái sau.'}</p>
                : <p role="status">Đang kiểm tra giao dịch đã ký từ PayOS. Tham số trên đường dẫn không xác nhận thanh toán.</p>}
      {!invalid && <div className="payment-actions">
        <button type="button" className="payment-button" onClick={() => void refresh()} disabled={checking}>Kiểm tra lại</button>
        <Link className="payment-link" to={`/don-hang/${encodeURIComponent(orderId)}`}>Mở đơn hàng</Link>
      </div>}
    </div>
  </main>;
}
