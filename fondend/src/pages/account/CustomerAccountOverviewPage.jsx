import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import { commerceApi } from '../../services/commerce/commerce.api.js';
import { operationsApi } from '../../services/operations/operationsApi.js';
import { errorText, formatDate, formatMoney, orderStatusLabel, paymentStatusLabel } from '../commerce/commerce.format.js';
import './customer-account-overview.css';

export default function CustomerAccountOverviewPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState({ items: [], loading: true, error: '' });
  const [notifications, setNotifications] = useState({ count: 0, loading: true, error: '' });

  const loadOrders = useCallback(async () => {
    setOrders((current) => ({ ...current, loading: true, error: '' }));
    try {
      const response = await commerceApi.listOwnOrders({ page: 1, limit: 3 });
      setOrders({ items: Array.isArray(response.data) ? response.data : [], loading: false, error: '' });
    } catch (error) {
      setOrders((current) => ({ ...current, loading: false, error: errorText(error, 'Không thể tải đơn hàng gần đây.') }));
    }
  }, []);

  const loadUnreadCount = useCallback(async () => {
    setNotifications((current) => ({ ...current, loading: true, error: '' }));
    try {
      const response = await operationsApi.getUnreadCount();
      setNotifications({ count: Number(response?.data?.count) || 0, loading: false, error: '' });
    } catch (error) {
      setNotifications((current) => ({ ...current, loading: false, error: errorText(error, 'Không thể tải số thông báo chưa đọc.') }));
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    void loadUnreadCount();
  }, [loadOrders, loadUnreadCount]);

  return <section className="customer-overview">
    <header className="customer-overview__heading">
      <p className="customer-overview__eyebrow">KHÔNG GIAN CỦA BẠN</p>
      <h1>Tài khoản của tôi</h1>
      <p>Xin chào {user?.name}. Theo dõi đơn hàng và những cập nhật mới nhất tại đây.</p>
    </header>

    <section className="customer-overview__card customer-overview__orders" aria-labelledby="customer-overview-orders">
      <div className="customer-overview__card-heading">
        <div><p className="customer-overview__eyebrow">MUA SẮM</p><h2 id="customer-overview-orders">Đơn hàng gần đây</h2></div>
        <Link to="/tai-khoan/don-hang">Tất cả đơn hàng</Link>
      </div>
      {orders.loading && <p className="customer-overview__state" role="status">Đang tải đơn hàng…</p>}
      {!orders.loading && orders.error && <div className="customer-overview__state customer-overview__state--error" role="alert">
        <p>{orders.error}</p><button type="button" onClick={() => void loadOrders()}>Thử lại</button>
      </div>}
      {!orders.loading && !orders.error && orders.items.length === 0 && <div className="customer-overview__empty">
        <p>Bạn chưa có đơn hàng nào.</p><Link to="/san-pham">Khám phá sản phẩm</Link>
      </div>}
      {!orders.loading && !orders.error && orders.items.length > 0 && <ul className="customer-overview__order-list">
        {orders.items.map((order) => <li key={order.id}>
          <div className="customer-overview__order-main">
            <Link className="customer-overview__order-code" to={`/don-hang/${encodeURIComponent(order.id)}`}>{order.code}</Link>
            <span>{formatDate(order.createdAt)}</span>
          </div>
          <div className="customer-overview__order-detail">
            <span>{orderStatusLabel[order.status] || order.status}</span>
            <span>{paymentStatusLabel[order.paymentStatus] || order.paymentStatus}</span>
            <strong>{formatMoney(order.totalVnd)}</strong>
          </div>
        </li>)}
      </ul>}
    </section>

    <section className="customer-overview__card" aria-labelledby="customer-overview-notifications">
      <div className="customer-overview__card-heading">
        <div><p className="customer-overview__eyebrow">CẬP NHẬT</p><h2 id="customer-overview-notifications">Thông báo chưa đọc</h2></div>
        <Link to="/tai-khoan/thong-bao">Mở thông báo</Link>
      </div>
      {notifications.loading && <p className="customer-overview__state" role="status">Đang tải thông báo…</p>}
      {!notifications.loading && notifications.error && <div className="customer-overview__state customer-overview__state--error" role="alert">
        <p>{notifications.error}</p><button type="button" onClick={() => void loadUnreadCount()}>Thử lại</button>
      </div>}
      {!notifications.loading && !notifications.error && <p className="customer-overview__unread-count" role="status">
        {notifications.count > 0 ? `Bạn có ${notifications.count} thông báo chưa đọc.` : 'Bạn đã đọc hết thông báo.'}
      </p>}
    </section>

    <nav className="customer-overview__card customer-overview__shortcuts" aria-label="Truy cập nhanh">
      <p className="customer-overview__eyebrow">HỖ TRỢ BẠN</p><h2>Truy cập nhanh</h2>
      <Link to="/tai-khoan/dia-chi"><span>Địa chỉ giao hàng</span><span aria-hidden="true">→</span></Link>
      <Link to="/tai-khoan/ho-tro"><span>Hỗ trợ và khiếu nại</span><span aria-hidden="true">→</span></Link>
    </nav>
  </section>;
}
