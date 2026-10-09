import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { operationsApi } from '../../services/operations/operationsApi.js';
import '../../components/notifications/operations.css';

const categories = [
  { value: '', label: 'Tất cả' },
  { value: 'order', label: 'Cập nhật đơn hàng' },
  { value: 'promotion', label: 'Ưu đãi' },
  { value: 'support', label: 'Hỗ trợ khách hàng' },
  { value: 'account', label: 'Tài khoản' },
  { value: 'system', label: 'Cập nhật hệ thống' },
];

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const load = useCallback(async (requestedPage, filterUnread, filterCategory) => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const response = await operationsApi.listNotifications({ page: requestedPage, limit: 20, unreadOnly: filterUnread ? true : undefined, category: filterCategory || undefined });
      if (sequence !== requestSequence.current) return;
      setItems(response.data);
      setPagination(response.meta.pagination);
      setPage(requestedPage);
    } catch (requestError) {
      if (sequence !== requestSequence.current) return;
      setError(requestError.message || 'Không thể tải thông báo.');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(page, unreadOnly, category); }, 0);
    return () => { window.clearTimeout(initial); requestSequence.current += 1; };
  }, [load, page, unreadOnly, category]);

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'visible') load(page, unreadOnly, category);
    };
    const timer = window.setInterval(poll, 30_000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [load, page, unreadOnly, category]);

  async function markRead(id) {
    try {
      await operationsApi.markNotificationRead(id);
      await load(page, unreadOnly, category);
    } catch (requestError) {
      setError(requestError.message || 'Không thể cập nhật thông báo.');
    }
  }

  async function markAllRead() {
    try {
      await operationsApi.markAllNotificationsRead();
      await load(1, unreadOnly, category);
    } catch (requestError) {
      setError(requestError.message || 'Không thể cập nhật thông báo.');
    }
  }

  return (
    <section className="operations-page">
      <header className="operations-page__heading">
        <div><p className="operations-eyebrow">Tài khoản</p><h1>Thông báo</h1><p>Chỉ bạn có thể xem và cập nhật trạng thái đã đọc.</p></div>
        <button type="button" className="operations-button operations-button--quiet" onClick={markAllRead} disabled={loading || !items.some((item) => !item.readAt)}>Đánh dấu tất cả đã đọc</button>
      </header>
      <div className="operations-toolbar">
        <div className="notification-category-tabs" role="group" aria-label="Nhóm thông báo">{categories.map((item) => <button key={item.value || 'all'} type="button" className={category === item.value ? 'is-active' : ''} aria-pressed={category === item.value} onClick={() => { setCategory(item.value); setPage(1); }}>{item.label}</button>)}</div>
        <label><input type="checkbox" checked={unreadOnly} onChange={(event) => { setUnreadOnly(event.target.checked); setPage(1); }} /> Chỉ hiện chưa đọc</label>
        <button type="button" className="operations-button operations-button--quiet" onClick={() => load(page, unreadOnly, category)} disabled={loading}>Làm mới</button>
      </div>
      {loading && <p role="status">Đang tải thông báo…</p>}
      {error && <div className="operations-error" role="alert"><p>{error}</p><button type="button" onClick={() => load(page, unreadOnly, category)}>Thử lại</button></div>}
      {!loading && !error && items.length === 0 && <p className="operations-empty">{unreadOnly ? 'Bạn đã đọc tất cả thông báo.' : 'Chưa có thông báo.'}</p>}
      <ul className="operations-notifications">
        {items.map((item) => (
          <li className={item.readAt ? '' : 'is-unread'} key={item.id}>
            <div><span className="operations-badge">{categories.find((value) => value.value === item.category)?.label || 'Cập nhật hệ thống'}</span><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time><h2>{item.title}</h2><p>{item.body}</p></div>
            <div className="operations-notification-actions">
              <Link to={item.href} onClick={() => !item.readAt && markRead(item.id)}>Mở nội dung</Link>
              {!item.readAt && <button className="operations-button operations-button--quiet" type="button" onClick={() => markRead(item.id)}>Đánh dấu đã đọc</button>}
            </div>
          </li>
        ))}
      </ul>
      {pagination && pagination.totalPages > 1 && <nav className="operations-pagination" aria-label="Phân trang thông báo">
        <button className="operations-button operations-button--quiet" type="button" disabled={page <= 1 || loading} onClick={() => load(page - 1, unreadOnly, category)}>Trang trước</button>
        <span>Trang {page} / {pagination.totalPages}</span>
        <button className="operations-button operations-button--quiet" type="button" disabled={page >= pagination.totalPages || loading} onClick={() => load(page + 1, unreadOnly, category)}>Trang sau</button>
      </nav>}
    </section>
  );
}
