import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { commerceApi, createIdempotencyKey } from '../../../services/commerce/commerce.api.js';
import { errorText, formatDate, formatMoney, orderStatusLabel, paymentStatusLabel } from '../../commerce/commerce.format.js';
import '../../commerce/commerce.css';

const allowedNext = Object.freeze({
  pending: ['confirmed', 'cancelled'], confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [],
});

export default function StaffOrdersPage() {
  const [queue, setQueue] = useState('pending');
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [order, setOrder] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [toStatus, setToStatus] = useState('');
  const [reason, setReason] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await commerceApi.listStaffOrders({ page: 1, limit: 50, queue: queue || undefined });
      setOrders(Array.isArray(response.data) ? response.data : []);
      setPagination(response.meta?.pagination || null);
    } catch (requestError) { setError(requestError); }
    finally { setLoading(false); }
  }, [queue]);

  useEffect(() => { void Promise.resolve().then(loadOrders); }, [loadOrders]);

  async function openOrder(id) {
    setSelectedId(id);
    setBusy('detail');
    setError(null);
    try {
      const result = await commerceApi.getOperationalOrder(id);
      setOrder(result);
      setToStatus(allowedNext[result.status]?.[0] || '');
    } catch (requestError) { setError(requestError); }
    finally { setBusy(''); }
  }

  async function transition(event) {
    event.preventDefault();
    if (!order || !toStatus) return;
    setBusy('transition');
    setError(null);
    try {
      const input = {
        toStatus, expectedVersion: order.version,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(toStatus === 'shipped' && carrier.trim() && trackingNumber.trim()
          ? { shipping: { carrier: carrier.trim(), trackingNumber: trackingNumber.trim() } } : {}),
      };
      const updated = await commerceApi.transitionOrder(order.id, input, createIdempotencyKey());
      setOrder(updated);
      setReason('');
      setTrackingNumber('');
      await loadOrders();
    } catch (requestError) { setError(requestError); }
    finally { setBusy(''); }
  }

  async function collectCod(event) {
    event.preventDefault();
    if (!order) return;
    setBusy('cod');
    setError(null);
    try {
      const updated = await commerceApi.collectCod(order.id, {
        amountVnd: order.totalVnd - order.paidAmountVnd,
        evidenceReference: evidenceReference.trim(), expectedVersion: order.version,
      }, createIdempotencyKey());
      setOrder(updated);
      setEvidenceReference('');
      await loadOrders();
    } catch (requestError) { setError(requestError); }
    finally { setBusy(''); }
  }

  return <section className="commerce-page commerce-staff-page">
    <p className="commerce-eyebrow">VẬN HÀNH</p><h1>Đơn hàng</h1>
    <p className="commerce-lede">Cập nhật trạng thái theo đúng luồng đơn, phiên bản và chứng từ vận chuyển.</p>
    <div className="commerce-staff-toolbar">
      <label className="commerce-field" htmlFor="staff-order-queue"><span>Hàng đợi</span>
        <select id="staff-order-queue" value={queue} onChange={(event) => { setQueue(event.target.value); setSelectedId(''); setOrder(null); }}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(orderStatusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
      <button className="commerce-secondary" type="button" disabled={loading} onClick={() => void loadOrders()}>Làm mới</button>
    </div>
    {error && <p className="commerce-error" role="alert">{errorText(error, 'Không thể tải hoặc cập nhật đơn hàng.')}{error.requestId && <small>Mã yêu cầu: {error.requestId}</small>}</p>}
    {loading && <p role="status" className="commerce-note">Đang tải hàng đợi…</p>}
    {!loading && !error && orders.length === 0 && <div className="commerce-panel commerce-empty"><h2>Không có đơn trong hàng đợi này</h2><p>Thử chọn trạng thái khác hoặc làm mới sau.</p></div>}
    {!loading && orders.length > 0 && <div className="commerce-staff-layout">
      <section className="commerce-panel commerce-staff-list" aria-label="Danh sách đơn hàng">
        <p>{pagination?.total ?? orders.length} đơn</p>
        {orders.map((item) => <button className={`commerce-staff-order${selectedId === item.id ? ' is-selected' : ''}`} type="button" key={item.id} onClick={() => void openOrder(item.id)}>
          <strong>{item.code}</strong><span>{orderStatusLabel[item.status] || item.status}</span><span>{formatMoney(item.totalVnd)} · {formatDate(item.createdAt)}</span>
        </button>)}
      </section>
      <section className="commerce-panel commerce-staff-detail" aria-live="polite">
        {!order && <p>{busy === 'detail' ? 'Đang tải chi tiết đơn…' : 'Chọn một đơn để xem thông tin vận hành.'}</p>}
        {order && <>
          <p className="commerce-eyebrow">{order.code}</p><h2>{orderStatusLabel[order.status] || order.status}</h2>
          <p>{order.recipient?.recipientName} · {order.recipient?.phone}</p>
          <p>{order.recipient?.email}</p><p>{order.recipient?.formattedAddress}</p>
          <p>{paymentStatusLabel[order.paymentStatus] || order.paymentStatus} · Đã thu {formatMoney(order.paidAmountVnd)}</p>
          {order.paymentReview?.required && <p className="commerce-error">Cần kiểm tra thanh toán: {order.paymentReview.reasonCode}</p>}
          <ul className="commerce-line-items">{order.items.map((item) => <li key={item.productId}><span>{item.name}<small>{item.sku} · SL {item.quantity}</small></span><span>{formatMoney(item.unitPriceVnd * item.quantity)}</span></li>)}</ul>
          {order.internalNote && <div className="commerce-notice"><strong>Ghi chú nội bộ</strong><p>{order.internalNote}</p></div>}
          {allowedNext[order.status]?.length > 0 && <form className="commerce-form commerce-action-form" onSubmit={transition}>
            <h3>Cập nhật trạng thái</h3>
            <label className="commerce-field" htmlFor="staff-next-status"><span>Trạng thái tiếp theo</span><select id="staff-next-status" value={toStatus} onChange={(event) => setToStatus(event.target.value)}>
              {allowedNext[order.status].map((status) => <option value={status} key={status}>{orderStatusLabel[status]}</option>)}
            </select></label>
            {toStatus === 'shipped' && <>
              <label className="commerce-field" htmlFor="staff-carrier"><span>Đơn vị vận chuyển</span><input id="staff-carrier" value={carrier} onChange={(event) => setCarrier(event.target.value)} maxLength={120} /></label>
              <label className="commerce-field" htmlFor="staff-tracking"><span>Mã vận đơn</span><input id="staff-tracking" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} maxLength={100} /></label>
              <p className="commerce-note">Để giao thủ công, bỏ trống thông tin vận chuyển và nhập lý do.</p>
            </>}
            {(toStatus === 'cancelled' || (toStatus === 'shipped' && (!carrier.trim() || !trackingNumber.trim()))) && <label className="commerce-field" htmlFor="staff-transition-reason"><span>Lý do</span><textarea id="staff-transition-reason" value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={1000} rows={2} /></label>}
            <button className="commerce-primary" type="submit" disabled={busy !== ''}>{busy === 'transition' ? 'Đang cập nhật…' : 'Lưu trạng thái'}</button>
          </form>}
          {order.paymentMethod === 'cod' && order.paymentStatus === 'pending' && ['shipped', 'delivered'].includes(order.status) && <form className="commerce-form commerce-action-form" onSubmit={collectCod}>
            <h3>Đối soát COD</h3><p>Số tiền phải thu toàn bộ: <strong>{formatMoney(order.totalVnd - order.paidAmountVnd)}</strong>.</p>
            <label className="commerce-field" htmlFor="cod-evidence"><span>Mã chứng từ thu tiền</span><input id="cod-evidence" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} required maxLength={500} /></label>
            <button className="commerce-secondary" type="submit" disabled={busy !== ''}>{busy === 'cod' ? 'Đang ghi nhận…' : 'Ghi nhận đã thu đủ COD'}</button>
          </form>}
          <Link to={`/don-hang/${encodeURIComponent(order.id)}`}>Mở trang chi tiết dành cho khách</Link>
        </>}
      </section>
    </div>}
  </section>;
}
