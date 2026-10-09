import { useEffect, useMemo, useRef, useState } from 'react';
import { operationsApi } from '../../../services/operations/operationsApi.js';
import RevenueTrendChart from './RevenueTrendChart.jsx';
import { commerceApi } from '../../../services/commerce/commerce.api.js';
import Icon from '../../../components/catalog/Icon.jsx';
import { WorkspaceMetric, WorkspacePanel, RecentOrders, OrderBreakdown } from '../../../components/workspace/WorkspaceParts.jsx';
import { count, downloadCsv } from '../../../components/workspace/workspaceUtils.js';
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

function dateDaysBefore(dateValue, days) {
  const date = new Date(`${dateValue}T12:00:00+07:00`);
  date.setDate(date.getDate() - days);
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function dateDaysBetween(fromValue, toValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(fromValue) || !/^\d{4}-\d{2}-\d{2}$/u.test(toValue)) return 0;
  const fromDate = new Date(`${fromValue}T12:00:00+07:00`);
  const toDate = new Date(`${toValue}T12:00:00+07:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())
    || fromDate.toISOString().slice(0, 10) !== fromValue
    || toDate.toISOString().slice(0, 10) !== toValue) return 0;
  const days = Math.round((toDate - fromDate) / 86_400_000) + 1;
  return Number.isSafeInteger(days) && days > 0 ? days : 0;
}

const DATE_PRESETS = [
  { key: 'today', label: 'Hôm nay', days: 1 },
  { key: '7d', label: '7 ngày', days: 7 },
  { key: '30d', label: '30 ngày', days: 30 },
  { key: '90d', label: '90 ngày', days: 90 },
];

export default function AdminOverviewPage({ report = false }) {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [activePreset, setActivePreset] = useState('30d');
  const [statistics, setStatistics] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [ordersError, setOrdersError] = useState('');
  const [statisticsError, setStatisticsError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshSequence, setRefreshSequence] = useState(0);
  const requestSequence = useRef(0);
  const rangeDays = useMemo(() => dateDaysBetween(from, to), [from, to]);
  const rangeKey = `${from}|${to}`;
  const visibleStatistics = statistics?.rangeKey === rangeKey ? statistics.data : null;
  const visibleError = statisticsError?.rangeKey === rangeKey ? statisticsError.message : '';
  const isLoading = rangeDays >= 1 && rangeDays <= 367
    && (loading || (!visibleStatistics && !visibleError));

  const applyPreset = (days, key) => {
    const end = today();
    setTo(end);
    setFrom(dateDaysBefore(end, days - 1));
    setActivePreset(key);
  };

  useEffect(() => {
    const sequence = ++requestSequence.current;
    if (rangeDays < 1 || rangeDays > 367) return undefined;

    let cancelled = false;
    const currentRangeKey = `${from}|${to}`;
    const filters = { from: dateTime(from), to: dateTime(to, true) };
    const initial = window.setTimeout(async () => {
      try {
        const [result, ordersResult] = await Promise.allSettled([
          operationsApi.getAdminStatistics(filters),
          commerceApi.listStaffOrders({ ...filters, limit: 5, sort: 'newest' }),
        ]);
        if (!cancelled && requestSequence.current === sequence) {
          if (result.status === 'rejected') throw result.reason;
          setStatistics({ rangeKey: currentRangeKey, data: result.value.data });
          setRecentOrders(ordersResult.status === 'fulfilled' ? ordersResult.value.data : []);
          setOrdersError(ordersResult.status === 'rejected' ? 'Không tải được đơn hàng gần đây.' : '');
          setStatisticsError(null);
        }
      } catch (error) {
        if (!cancelled && requestSequence.current === sequence) {
          setStatistics(null);
          setStatisticsError({ rangeKey: currentRangeKey, message: error.message || 'Số liệu quản trị chưa khả dụng.' });
        }
      } finally {
        if (!cancelled && requestSequence.current === sequence) setLoading(false);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
    };
  }, [from, rangeDays, refreshSequence, to]);

  const load = () => {
    if (rangeDays < 1 || rangeDays > 367) return;
    setLoading(true);
    setRefreshSequence((sequence) => sequence + 1);
  };

  return (
    <section className="operations-page">
      <header className="operations-page__heading">
        <div><p className="operations-eyebrow">TRO &amp; LAM · QUẢN TRỊ</p><h1>{report ? 'Báo cáo & Phân tích kinh doanh' : 'Tổng quan vận hành'}</h1><p>Theo dõi hoạt động kinh doanh, tác phẩm và đơn hàng của TRO &amp; LAM.</p></div>
        <div className="operations-page__actions"><button className="operations-button" disabled={!visibleStatistics || isLoading} onClick={() => downloadCsv(`tro-lam-bao-cao-${from}-${to}.csv`, [['Chỉ số', 'Giá trị'], ['Từ ngày', from], ['Đến ngày', to], ['Tiền đã thu', visibleStatistics.grossCollectedVnd], ['Tiền đã hoàn', visibleStatistics.refundedVnd], ['Thu ròng sau hoàn', visibleStatistics.netCollectedVnd], ...Object.entries(visibleStatistics.orderCounts).map(([key, value]) => [key, value])])}><Icon name="download" size={16} /> Xuất báo cáo</button></div>
      </header>
      <div className="operations-toolbar admin-overview__filters" aria-label="Bộ lọc thời gian">
        <div className="admin-overview__presets" role="group" aria-label="Khoảng thời gian nhanh" aria-busy={isLoading}>
          {DATE_PRESETS.map((preset) => <button
            key={preset.key}
            type="button"
            className={`admin-overview__preset${activePreset === preset.key ? ' is-active' : ''}`}
            aria-pressed={activePreset === preset.key}
            onClick={() => applyPreset(preset.days, preset.key)}
          >{preset.label}</button>)}
        </div>
        <label>Từ ngày <input type="date" value={from} max={to} onChange={(event) => { setFrom(event.target.value); setActivePreset(''); }} /></label>
        <label>Đến ngày <input type="date" value={to} min={from} onChange={(event) => { setTo(event.target.value); setActivePreset(''); }} /></label>
        <button type="button" className="operations-button" onClick={load} disabled={isLoading || rangeDays < 1 || rangeDays > 367}>Cập nhật</button>
      </div>
      <p className="admin-overview__range-note">Đang xem {rangeDays} ngày · So sánh với {rangeDays} ngày liền trước · Múi giờ Việt Nam</p>
      {rangeDays > 367 && <p className="operations-error" role="alert">Khoảng thống kê tối đa là 367 ngày. Hãy chọn khoảng ngắn hơn.</p>}
      {rangeDays < 1 && <p className="operations-error" role="alert">Hãy chọn khoảng ngày hợp lệ.</p>}
      {isLoading && <p role="status">Đang tải tổng quan…</p>}
      {visibleError && <div className="operations-error" role="alert"><p>{visibleError}</p><button type="button" onClick={load}>Thử lại</button></div>}
      {visibleStatistics && <div className="admin-overview__financial">
        <div className="operations-metrics">
          <WorkspaceMetric label="Tiền đã thu" icon="receipt" value={numberVnd(visibleStatistics.grossCollectedVnd)} detail={`Kỳ trước: ${numberVnd(visibleStatistics.comparison?.grossCollectedVnd)}${Number.isFinite(visibleStatistics.comparison?.changePercent) ? ` · ${visibleStatistics.comparison.changePercent > 0 ? '+' : ''}${visibleStatistics.comparison.changePercent}%` : ''}`} />
          <WorkspaceMetric label="Đơn hàng" icon="bag" value={count(Object.values(visibleStatistics.orderCounts || {}).reduce((sum, value) => sum + value, 0))} detail={`${count(visibleStatistics.orderCounts.pending)} đơn chờ xác nhận`} to="/admin/orders" />
          <WorkspaceMetric label="Khách hàng mới" icon="users" value={count(visibleStatistics.customerCount)} detail="Tài khoản khách hàng được tạo trong kỳ" to="/admin/users" />
          <WorkspaceMetric label="Đã bàn giao" icon="leaf" value={count(visibleStatistics.orderCounts.delivered)} detail="Đơn tạo trong kỳ đã giao thành công" />
        </div>
        <div className="workspace-grid"><RevenueTrendChart trend={visibleStatistics.revenueTrend} /><OrderBreakdown counts={visibleStatistics.orderCounts} /></div>
        <div className="workspace-grid"><RecentOrders orders={recentOrders} error={ordersError} /><WorkspacePanel title="Tác phẩm được đặt nhiều" description="Xếp hạng theo số lượng đặt trong kỳ, loại trừ đơn hủy." to="/admin/products">
          {visibleStatistics.topProducts?.length ? <ol className="workspace-ranked">{visibleStatistics.topProducts.map((product, index) => <li key={product.productId}><span className="rank">{index + 1}</span><div className="rank-name"><strong>{product.name}</strong><small>{product.sku} · {count(product.orderCount)} đơn</small><progress aria-label={`Số lượng ${product.name}`} value={product.quantity} max={visibleStatistics.topProducts[0].quantity || 1} /></div><b>{count(product.quantity)}</b></li>)}</ol> : <p className="workspace-empty">Chưa có tác phẩm được đặt trong kỳ.</p>}
        </WorkspacePanel></div>
        {report && <WorkspacePanel title="Đối soát trong kỳ" description="Tiền đã thu và tiền hoàn từ sổ thanh toán; thu ròng không phải lợi nhuận."><div className="operations-metrics"><WorkspaceMetric label="Tiền đã thu" value={numberVnd(visibleStatistics.grossCollectedVnd)} /><WorkspaceMetric label="Tiền đã hoàn" value={numberVnd(visibleStatistics.refundedVnd)} icon="return" /><WorkspaceMetric label="Thu ròng sau hoàn" value={numberVnd(visibleStatistics.netCollectedVnd)} icon="chart" /></div></WorkspacePanel>}
      </div>}
    </section>
  );
}
