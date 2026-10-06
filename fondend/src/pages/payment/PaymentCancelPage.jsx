import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { paymentsApi } from '../../services/payments/payments.api.js';
import '../../components/payment/payment.css';

const ORDER_ID = /^[a-f\d]{24}$/iu;

export default function PaymentCancelPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ORDER_ID.test(orderId)) return undefined;
    const controller = new AbortController();
    paymentsApi.getPaymentStatus(orderId, { signal: controller.signal })
      .then((response) => setPayment(response.data))
      .catch((requestError) => { if (requestError.name !== 'AbortError') setError(requestError.message); });
    return () => controller.abort();
  }, [orderId]);

  return <main className="payment-page">
    <div className="payment-card">
      <p className="payment-eyebrow">TRO &amp; LAM · PayOS</p>
      <h1>{payment?.paymentStatus === 'paid' ? 'Thanh toán đã được xác nhận' : 'Chưa hoàn tất thanh toán'}</h1>
      {error ? <p className="payment-error" role="alert">{error}</p>
        : payment?.paymentStatus === 'paid' ? <p role="status">Hệ thống đã nhận xác nhận từ PayOS. Bạn không cần thanh toán lại.</p>
          : <p role="status">Trang quay lại không thay đổi trạng thái giao dịch. Đơn của bạn vẫn được lưu; hãy tiếp tục từ trang đơn hàng khi sẵn sàng.</p>}
      <div className="payment-actions">
        {ORDER_ID.test(orderId) && <Link className="payment-link" to={`/tra-cuu-don-hang?orderId=${encodeURIComponent(orderId)}`}>Mở đơn hàng</Link>}
        <Link className="payment-link" to="/">Về trang chủ</Link>
      </div>
    </div>
  </main>;
}
