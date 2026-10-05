import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { operationsApi } from '../../../services/operations/operationsApi.js';
import '../../../components/notifications/operations.css';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const monthAgo = () => {
  const date = new Date(`${today()}T12:00:00+07:00`);
  date.setDate(date.getDate() - 29);
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
};

function dateTime(date, end = false) {
  return new Date(`${date}T${end ? '23:59:59.999' : '00:00:00'}+07:00`).toISOString();
}

function numberVnd(value) {
  return Number.isSafeInteger(value) ? `${new Intl.NumberFormat('vi-VN').format(value)} ₫` : 'Chưa khả dụng';
}

export default function AdminOverviewPage() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [statistics, setStatistics] = useState(null);
  const [operations, setOperations] = useState(null);
  const [statisticsError, setStatisticsError] = useState('');
  const [operationsError, setOperationsError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setStatisticsError('');
    setOperationsError('');
    const filters = { from: dateTime(from), to: dateTime(to, true) };
    const results = await Promise.allSettled([
      operationsApi.getAdminStatistics(filters),
      operationsApi.getStaffDashboard(filters),
    ]);
    if (results[0].status === 'fulfilled') setStatistics(results[0].value.data);
    else setStatisticsError(results[0].reason.message || 'Số liệu tài chính chưa khả dụng.');
    if (results[1].status === 'fulfilled') setOperations(results[1].value.data);
    else setOperationsError(results[1].reason.message || 'Số liệu vận hành chưa khả dụng.');
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  return (
    <section className="operations-page">
      <header className="operations-page__heading">
        <div><p className="operations-eyebrow">Quản trị</p><h1>Tổng quan</h1><p>Tiền đã thu được tính riêng với số đơn đã đặt; không phải lợi nhuận.</p></div>
        <Link className="operations-button operations-button--quiet" to="/admin/logs">Mở nhật ký audit</Link>
      </header>
      <div className="operations-toolbar">
        <label>Từ ngày <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Đến ngày <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
        <button type="button" className="operations-button" onClick={load} disabled={loading}>Cập nhật</button>
      </div>
      {loading && <p role="status">Đang tải tổng quan…</p>}
      {statisticsError && <div className="operations-error" role="alert"><p>{statisticsError}</p><button type="button" onClick={load}>Thử lại</button></div>}
      {!loading && statistics && <>
        <h2>Đối soát trong kỳ</h2>
        <div className="operations-metrics">
          <article className="operations-metric"><span>Tiền đã thu</span><strong>{numberVnd(statistics.grossCollectedVnd)}</strong></article>
          <article className="operations-metric"><span>Đã hoàn</span><strong>{numberVnd(statistics.refundedVnd)}</strong></article>
          <article className="operations-metric"><span>Thu ròng sau hoàn</span><strong>{numberVnd(statistics.netCollectedVnd)}</strong></article>
          <article className="operations-metric"><span>Đơn được tạo</span><strong>{new Intl.NumberFormat('vi-VN').format(Object.values(statistics.orderCounts || {}).reduce((sum, value) => sum + value, 0))}</strong><small>Đây không phải doanh thu.</small></article>
        </div>
        <h2>Đơn theo trạng thái</h2>
        <dl className="operations-status-list">{Object.entries(statistics.orderCounts || {}).map(([status, value]) => <div key={status}><dt>{status}</dt><dd>{new Intl.NumberFormat('vi-VN').format(value)}</dd></div>)}</dl>
        <h2>Sản phẩm đặt nhiều</h2>
        {statistics.topProducts?.length ? <ul className="operations-top-products">{statistics.topProducts.map((product) => <li key={product.productId}><span>{product.name} <small>{product.sku}</small></span><strong>{new Intl.NumberFormat('vi-VN').format(product.quantity)} sản phẩm</strong></li>)}</ul> : <p className="operations-empty">Chưa có sản phẩm trong kỳ.</p>}
      </>}
      <h2>Hàng đợi vận hành</h2>
      {operationsError && <div className="operations-error" role="alert"><p>{operationsError}</p></div>}
      {!loading && operations && <div className="operations-metrics">
        <article className="operations-metric"><span>Đơn chờ xử lý</span><strong>{operations.orderQueues.pending}</strong></article>
        <article className="operations-metric"><span>Đơn đang xử lý</span><strong>{operations.orderQueues.processing}</strong></article>
        <article className="operations-metric"><span>Ticket chưa phân công</span><strong>{operations.ticketQueues.unassigned}</strong></article>
        <article className="operations-metric"><span>Tồn kho thấp</span><strong>{operations.lowStock === null ? 'Chưa cấu hình' : operations.lowStock}</strong></article>
      </div>}
    </section>
  );
}
