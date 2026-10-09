import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/auth.context.js';
import Icon from '../../../components/catalog/Icon.jsx';
import { downloadCsv } from '../../../components/workspace/workspaceUtils.js';
import { commerceApi, createIdempotencyKey } from '../../../services/commerce/commerce.api.js';
import { errorText, formatDate, formatMoney, orderStatusLabel, paymentStatusLabel } from '../../commerce/commerce.format.js';
import '../../commerce/commerce.css';

const allowedNext = Object.freeze({
  pending: ['confirmed', 'cancelled'], confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [],
});

export default function StaffOrdersPage() {
  const { id: routeOrderId } = useParams();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [queue, setQueue] = useState('');
  const [filters, setFilters] = useState({ q: initialQuery, paymentStatus: '', from: '', to: '' });
  const [submitted, setSubmitted] = useState(filters);
  const [page, setPage] = useState(1);
  const requestId = useRef(0);
  const listRequestId = useRef(0);
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
    const sequence = ++listRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const response = await commerceApi.listStaffOrders({ page, limit: 20, queue: queue || undefined, ...submitted,
        from: submitted.from ? new Date(`${submitted.from}T00:00:00+07:00`).toISOString() : undefined,
        to: submitted.to ? new Date(`${submitted.to}T23:59:59.999+07:00`).toISOString() : undefined, sort: 'newest' });
      if (sequence !== listRequestId.current) return;
      setOrders(Array.isArray(response.data) ? response.data : []);
      setPagination(response.meta?.pagination || null);
    } catch (requestError) { if (sequence === listRequestId.current) setError(requestError); }
    finally { if (sequence === listRequestId.current) setLoading(false); }
  }, [page, queue, submitted]);

  const openOrder = useCallback(async (id) => {
    const sequence = ++requestId.current;
    setSelectedId(id);
    setOrder(null);
    setBusy('detail');
    setError(null);
    try {
      const result = await commerceApi.getOperationalOrder(id);
      if (sequence !== requestId.current) return;
      setOrder(result);
      setToStatus(allowedNext[result.status]?.[0] || '');
    } catch (requestError) { if (sequence === requestId.current) setError(requestError); }
    finally { if (sequence === requestId.current) setBusy(''); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void loadOrders(); }, 0); return () => { window.clearTimeout(timer); listRequestId.current += 1; }; }, [loadOrders]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((value) => ({ ...value, q: initialQuery }));
      setSubmitted((value) => ({ ...value, q: initialQuery }));
      setPage(1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialQuery]);

  useEffect(() => {
    if (routeOrderId) void Promise.resolve().then(() => openOrder(routeOrderId));
  }, [openOrder, routeOrderId]);

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
    <header className="operations-page__heading"><div><p className="commerce-eyebrow">{user.role === 'admin' ? 'QUẢN TRỊ' : 'VẬN HÀNH'}</p><h1>Quản lý đơn hàng</h1><p>Theo dõi, xử lý và cập nhật đơn hàng của TRO &amp; LAM.</p></div><button className="commerce-secondary" type="button" disabled={!orders.length || loading} onClick={() => downloadCsv('tro-lam-don-hang.csv', [['Mã đơn', 'Khách hàng', 'Ngày đặt', 'Tổng tiền', 'Trạng thái'], ...orders.map((item) => [item.code, item.recipient?.recipientName, formatDate(item.createdAt), item.totalVnd, orderStatusLabel[item.status]])])}><Icon name="download" size={16} /> Xuất trang hiện tại</button></header>
    <nav className="admin-tabs" aria-label="Trạng thái đơn hàng">{[['', 'Tất cả'], ...Object.entries(orderStatusLabel)].map(([status, label]) => <button type="button" className={queue === status ? 'is-active' : ''} key={status} onClick={() => { setQueue(status); setPage(1); }}>{label}</button>)}</nav>
    <form className="commerce-staff-toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSubmitted({ ...filters }); }}>
      <label className="commerce-field"><span>Tìm đơn hàng</span><input type="search" placeholder="Mã đơn hoặc tên khách hàng" value={filters.q} maxLength={120} onChange={(event) => setFilters({ ...filters, q: event.target.value })} /></label>
      <label className="commerce-field" htmlFor="staff-order-queue"><span>Hàng đợi</span>
        <select id="staff-order-queue" value={queue} onChange={(event) => { setQueue(event.target.value); setPage(1); }}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(orderStatusLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
      <label className="commerce-field"><span>Thanh toán</span><select value={filters.paymentStatus} onChange={(event) => setFilters({ ...filters, paymentStatus: event.target.value })}><option value="">Tất cả</option>{Object.entries(paymentStatusLabel).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      <label className="commerce-field"><span>Từ ngày</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label><label className="commerce-field"><span>Đến ngày</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
      <button className="commerce-primary" type="submit" disabled={loading}>Lọc</button><button className="commerce-secondary" type="button" disabled={loading} onClick={() => void loadOrders()}>Làm mới</button>
    </form>
    {error && <p className="commerce-error" role="alert">{errorText(error, 'Không thể tải hoặc cập nhật đơn hàng.')}{error.requestId && <small>Mã yêu cầu: {error.requestId}</small>}</p>}
    {loading && <p role="status" className="commerce-note">Đang tải hàng đợi…</p>}
    {!loading && !error && orders.length === 0 && <div className="commerce-panel commerce-empty"><h2>Không có đơn trong hàng đợi này</h2><p>Thử chọn trạng thái khác hoặc làm mới sau.</p></div>}
    {(!loading || selectedId) && <div className="commerce-staff-layout">
      <section className="commerce-panel commerce-staff-list" aria-label="Danh sách đơn hàng">
        <div className="workspace-table-wrap"><table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày đặt</th><th>Tác phẩm</th><th>Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{orders.map((item) => <tr className={`workspace-order-row${selectedId === item.id ? ' is-selected' : ''}`} key={item.id}>
          <td><button type="button" onClick={() => void openOrder(item.id)}><strong>{item.code}</strong></button></td><td>{item.recipient?.recipientName || '—'}<small>{item.recipient?.phone}</small></td><td>{formatDate(item.createdAt)}</td><td>{item.firstItem?.name || '—'}<small>{item.itemCount} sản phẩm</small></td><td>{formatMoney(item.totalVnd)}</td><td><span className={`workspace-badge workspace-badge--${item.paymentStatus}`}>{paymentStatusLabel[item.paymentStatus]}</span></td><td><span className={`workspace-badge workspace-badge--${item.status}`}>{orderStatusLabel[item.status]}</span></td><td><button type="button" onClick={() => void openOrder(item.id)}>Chi tiết</button></td>
        </tr>)}</tbody></table></div>
        <nav className="operations-pagination" aria-label="Phân trang đơn hàng"><span>{pagination?.total ?? orders.length} đơn · Trang {page} / {pagination?.totalPages || 1}</span><div><button className="commerce-secondary" type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Trước</button><button className="commerce-secondary" type="button" disabled={page >= (pagination?.totalPages || 1) || loading} onClick={() => setPage(page + 1)}>Sau</button></div></nav>
      </section>
      {selectedId && <section className="commerce-panel commerce-staff-detail" aria-live="polite">
        <header className="workspace-detail-heading"><div><p className="commerce-eyebrow">CHI TIẾT ĐƠN HÀNG</p><strong>{order?.code}</strong></div><button type="button" aria-label="Đóng chi tiết đơn hàng" onClick={() => { requestId.current += 1; setSelectedId(''); setOrder(null); setBusy(''); }}><Icon name="close" size={18} /></button></header>
        {!order && <p>{busy === 'detail' ? 'Đang tải chi tiết đơn…' : 'Chọn một đơn để xem thông tin vận hành.'}</p>}
        {order && <>
          <p className="commerce-eyebrow">{order.code}</p><h2>{orderStatusLabel[order.status] || order.status}</h2>
          <p>{order.recipient?.recipientName} · {order.recipient?.phone}</p>
          <p>{order.recipient?.email}</p><p>{order.recipient?.formattedAddress}</p>
          <p>{paymentStatusLabel[order.paymentStatus] || order.paymentStatus} · Đã thu {formatMoney(order.paidAmountVnd)}</p>
          {order.paymentReview?.required && <p className="commerce-error">Cần kiểm tra thanh toán: {order.paymentReview.reasonCode}</p>}
          <ul className="commerce-line-items">{order.items.map((item) => <li key={item.productId}><span>{item.name}<small>{item.sku} · SL {item.quantity}</small></span><span>{formatMoney(item.unitPriceVnd * item.quantity)}</span></li>)}</ul>
          <div className="workspace-summary"><div><span>Tạm tính</span><span>{formatMoney(order.subtotalVnd)}</span></div><div><span>Phí vận chuyển</span><span>{formatMoney(order.shippingFeeVnd)}</span></div><div><span>Giảm giá</span><span>{formatMoney(order.discountVnd)}</span></div><div><span>Tổng cộng</span><strong>{formatMoney(order.totalVnd)}</strong></div></div>
          {order.note && <div className="commerce-notice"><strong>Ghi chú khách hàng</strong><p>{order.note}</p></div>}
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
          <button className="commerce-secondary" type="button" onClick={() => window.print()}><Icon name="print" size={16} /> In phiếu đơn hàng</button>
        </>}
      </section>}
    </div>}
  </section>;
}
