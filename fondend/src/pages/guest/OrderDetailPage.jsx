import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import { commerceApi, createIdempotencyKey } from '../../services/commerce/commerce.api.js';
import { errorText, formatDate, formatMoney, orderStatusLabel, paymentStatusLabel } from '../commerce/commerce.format.js';
import '../commerce/commerce.css';

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user, loading: authLoading, errorCode: authErrorCode } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setOrder(await commerceApi.getOrder(id)); }
    catch (requestError) { setError(requestError); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    if (authLoading || authErrorCode === 'ACCOUNT_BLOCKED') return;
    void Promise.resolve().then(load);
  }, [authLoading, authErrorCode, load]);

  async function cancel(event) {
    event.preventDefault();
    setBusy('cancel');
    setError(null);
    try {
      setOrder(await commerceApi.cancelOrder(id, { reason: cancelReason.trim(), expectedVersion: order.version }, createIdempotencyKey()));
      setCancelReason('');
    } catch (requestError) { setError(requestError); }
    finally { setBusy(''); }
  }

  async function claim() {
    setBusy('claim');
    setError(null);
    try {
      setOrder(await commerceApi.claimGuestOrder(id, createIdempotencyKey()));
    } catch (requestError) { setError(requestError); }
    finally { setBusy(''); }
  }

  async function createPaymentLink() {
    setBusy('payment');
    setError(null);
    try {
      const attempt = await commerceApi.createPaymentAttempt(id, createIdempotencyKey());
      if (attempt.checkoutUrl && new URL(attempt.checkoutUrl).protocol !== 'https:') throw new Error('Đường dẫn thanh toán không dùng HTTPS nên đã bị chặn.');
      if (attempt.checkoutUrl) window.location.assign(attempt.checkoutUrl);
      else setError(new Error('Nhà cung cấp chưa trả về đường dẫn thanh toán. Đơn vẫn đang chờ xác minh.'));
    } catch (requestError) { setError(requestError); }
    finally { setBusy(''); }
  }

  if (authErrorCode === 'ACCOUNT_BLOCKED') return <section className="commerce-page commerce-narrow">
    <p className="commerce-eyebrow">TÀI KHOẢN</p><h1>Tài khoản đang bị khóa</h1>
    <p>Quyền xem đơn trong tài khoản bị tạm dừng. Hãy mở hướng dẫn kháng nghị để tiếp tục.</p>
    <Link className="commerce-secondary" to="/tai-khoan/bi-khoa">Mở hướng dẫn kháng nghị</Link>
  </section>;
  if (authLoading || loading) return <section className="commerce-page" role="status"><p>Đang tải chi tiết đơn…</p></section>;
  if (error && !order) return <section className="commerce-page commerce-narrow">
    <p className="commerce-eyebrow">ĐƠN HÀNG</p><h1>Không thể mở đơn hàng</h1>
    <p className="commerce-error" role="alert">{errorText(error, 'Quyền xem đơn chưa được xác minh.')}</p>
    <p>Khách đặt hàng có thể xác minh bằng email đã dùng khi mua.</p>
    <Link className="commerce-primary" to="/tra-cuu-don-hang">Tra cứu đơn bằng email</Link>
  </section>;

  const canClaim = Boolean(user?.id && user.emailVerifiedAt && user.email?.trim().toLowerCase() === order.recipient?.email?.trim().toLowerCase());
  return <section className="commerce-page">
    <div className="commerce-heading-row">
      <div><p className="commerce-eyebrow">CHI TIẾT ĐƠN HÀNG</p><h1>{order.code}</h1><p className="commerce-lede">Tạo lúc {formatDate(order.createdAt)}</p></div>
      <span className={`commerce-status commerce-status--${order.status}`}>{orderStatusLabel[order.status] || order.status}</span>
    </div>
    <div className="commerce-detail-layout">
      <div className="commerce-panel">
        <h2>Sản phẩm</h2>
        <ul className="commerce-line-items">{order.items.map((item) => <li key={item.productId}>
          <span><strong>{item.name}</strong><small>SKU {item.sku} · Số lượng {item.quantity}</small></span>
          <span>{formatMoney(item.unitPriceVnd * item.quantity)}</span>
        </li>)}</ul>
        <dl className="commerce-totals">
          <div><dt>Tạm tính</dt><dd>{formatMoney(order.subtotalVnd)}</dd></div>
          <div><dt>Phí giao hàng</dt><dd>{formatMoney(order.shippingFeeVnd)}</dd></div>
          <div><dt>Giảm giá</dt><dd>{formatMoney(order.discountVnd)}</dd></div>
          <div className="commerce-total"><dt>Tổng cộng</dt><dd>{formatMoney(order.totalVnd)}</dd></div>
        </dl>
      </div>
      <div className="commerce-panel">
        <h2>Thanh toán và người nhận</h2>
        <dl className="commerce-facts">
          <div><dt>Trạng thái thanh toán</dt><dd>{paymentStatusLabel[order.paymentStatus] || order.paymentStatus}</dd></div>
          <div><dt>Đã thu</dt><dd>{formatMoney(order.paidAmountVnd)}</dd></div>
          <div><dt>Đã hoàn</dt><dd>{formatMoney(order.refundedAmountVnd)}</dd></div>
          <div><dt>Người nhận</dt><dd>{order.recipient.recipientName}</dd></div>
          <div><dt>Email</dt><dd>{order.recipient.email}</dd></div>
          <div><dt>Điện thoại</dt><dd>{order.recipient.phone}</dd></div>
          <div><dt>Địa chỉ</dt><dd>{order.recipient.formattedAddress}</dd></div>
        </dl>
        {order.paymentMethod === 'payos' && order.paymentStatus === 'pending' && <button className="commerce-primary" type="button" disabled={busy !== ''} onClick={() => void createPaymentLink()}>
          {busy === 'payment' ? 'Đang tạo đường dẫn…' : 'Tiếp tục thanh toán'}
        </button>}
      </div>
    </div>

    <section className="commerce-panel commerce-timeline"><h2>Lịch sử trạng thái</h2>
      {order.statusHistory.length === 0 ? <p>Chưa có cập nhật trạng thái.</p> : <ol>{order.statusHistory.map((entry, index) => <li key={`${entry.toStatus}-${entry.createdAt}-${index}`}>
        <strong>{orderStatusLabel[entry.toStatus] || entry.toStatus}</strong><time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
      </li>)}</ol>}
      {order.shipping?.trackingNumber && <p>Theo dõi vận chuyển: {order.shipping.carrier} · {order.shipping.trackingNumber}</p>}
      {order.shipping?.events?.map((event, index) => <p key={`${event.occurredAt}-${index}`}><strong>{event.status}</strong> · {event.message} · {formatDate(event.occurredAt)}</p>)}
    </section>

    {order.status === 'pending' && <form className="commerce-panel commerce-form commerce-danger-panel" onSubmit={cancel}>
      <h2>Hủy đơn đang chờ</h2>
      <label className="commerce-field" htmlFor="cancel-reason"><span>Lý do hủy</span><textarea id="cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={1000} required rows={3} /></label>
      <button className="commerce-danger" type="submit" disabled={busy !== ''}>{busy === 'cancel' ? 'Đang hủy…' : 'Hủy đơn hàng'}</button>
    </form>}

    {canClaim && user?.id && <button className="commerce-secondary" type="button" disabled={busy !== ''} onClick={() => void claim()}>
      {busy === 'claim' ? 'Đang liên kết…' : 'Liên kết đơn với tài khoản của tôi'}
    </button>}
    {error && <p className="commerce-error" role="alert">{errorText(error, 'Không thể cập nhật đơn hàng.')}{error.requestId && <small>Mã yêu cầu: {error.requestId}</small>}</p>}
    <p className="commerce-actions"><Link to="/tai-khoan/don-hang">Đơn hàng của tôi</Link><Link to="/tra-cuu-don-hang">Tra cứu đơn khác</Link></p>
  </section>;
}
