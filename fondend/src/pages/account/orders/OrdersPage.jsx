import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { commerceApi } from '../../../services/commerce/commerce.api.js';
import { errorText, formatDate, formatMoney, orderStatusLabel, paymentStatusLabel } from '../../commerce/commerce.format.js';
import '../../commerce/commerce.css';

export default function OrdersPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await commerceApi.listOwnOrders({ page, limit: 20, status });
      setOrders(Array.isArray(response.data) ? response.data : []);
      setPagination(response.meta?.pagination || null);
    } catch (requestError) { setError(requestError); }
    finally { setLoading(false); }
  }, [page, status]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  return <section className="commerce-page">
    <p className="commerce-eyebrow">TÀI KHOẢN</p><h1>Đơn hàng của tôi</h1>
    <p className="commerce-lede">Danh sách này chỉ gồm đơn gắn với tài khoản của bạn.</p>
    <div className="commerce-filter-row">
      <label className="commerce-field" htmlFor="orders-status"><span>Lọc theo trạng thái</span>
        <select id="orders-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">Tất cả</option>
          {Object.entries(orderStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <Link to="/tra-cuu-don-hang">Tra cứu đơn đặt với email khác</Link>
    </div>
    {loading && <p className="commerce-note" role="status">Đang tải đơn hàng…</p>}
    {!loading && error && <div className="commerce-notice"><p className="commerce-error" role="alert">{errorText(error, 'Không thể tải đơn hàng.')}</p><button className="commerce-secondary" type="button" onClick={() => void load()}>Thử lại</button></div>}
    {!loading && !error && orders.length === 0 && <div className="commerce-panel commerce-empty"><h2>Chưa có đơn hàng</h2><p>Đơn hàng của bạn sẽ hiển thị ở đây sau khi đặt thành công.</p><Link className="commerce-primary" to="/san-pham">Khám phá sản phẩm</Link></div>}
    {!loading && !error && orders.length > 0 && <>
      <div className="commerce-order-list">{orders.map((order) => <article className="commerce-order-card" key={order.id}>
        <div><p className="commerce-eyebrow">{order.code}</p><h2><Link to={`/don-hang/${encodeURIComponent(order.id)}`}>{orderStatusLabel[order.status] || order.status}</Link></h2><p>{formatDate(order.createdAt)}</p></div>
        <dl><div><dt>Thanh toán</dt><dd>{paymentStatusLabel[order.paymentStatus] || order.paymentStatus}</dd></div><div><dt>Sản phẩm</dt><dd>{order.itemCount}</dd></div><div><dt>Tổng</dt><dd>{formatMoney(order.totalVnd)}</dd></div></dl>
      </article>)}</div>
      {pagination && pagination.totalPages > 1 && <nav className="commerce-pagination" aria-label="Phân trang đơn hàng">
        <button className="commerce-secondary" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Trang trước</button>
        <span>Trang {page} / {pagination.totalPages}</span>
        <button className="commerce-secondary" type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Trang sau</button>
      </nav>}
    </>}
  </section>;
}
