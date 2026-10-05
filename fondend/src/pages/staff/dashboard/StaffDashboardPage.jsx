import { useCallback, useEffect, useState } from 'react';
import { operationsApi } from '../../../services/operations/operationsApi.js';
import '../../../components/notifications/operations.css';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const count = (value) => Number.isSafeInteger(value) ? new Intl.NumberFormat('vi-VN').format(value) : 'Chưa kết nối';

function dateTime(date, end = false) {
  if (!date) return undefined;
  return new Date(`${date}T${end ? '23:59:59.999' : '00:00:00'}+07:00`).toISOString();
}

function Metric({ label, value, detail }) {
  return <article className="operations-metric"><span>{label}</span><strong>{count(value)}</strong>{detail && <small>{detail}</small>}</article>;
}

export default function StaffDashboardPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await operationsApi.getStaffDashboard({ from: dateTime(from), to: dateTime(to, true) });
      setData(response.data);
    } catch (requestError) {
      setError(requestError.message || 'Không tải được số liệu vận hành.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  return (
    <section className="operations-page">
      <header className="operations-page__heading">
        <div><p className="operations-eyebrow">Không gian vận hành</p><h1>Bảng công việc</h1><p>Chỉ số lấy từ đơn hàng, yêu cầu hỗ trợ và lead đã lưu.</p></div>
        <button type="button" className="operations-button" onClick={load} disabled={loading}>Làm mới</button>
      </header>
      <div className="operations-toolbar">
        <label>Từ ngày <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Đến ngày <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      {loading && <p role="status">Đang tải dữ liệu vận hành…</p>}
      {error && <div className="operations-error" role="alert"><p>{error}</p><button type="button" onClick={load}>Thử lại</button></div>}
      {!loading && data && <>
        <h2>Đơn hàng</h2>
        <div className="operations-metrics">
          <Metric label="Chờ xử lý" value={data.orderQueues.pending} />
          <Metric label="Đang xử lý" value={data.orderQueues.processing} />
          <Metric label="Giao có sự cố" value={data.orderQueues.deliveryFailed} detail={data.orderQueues.deliveryFailed === null ? 'Nguồn trạng thái giao đang chờ kết nối.' : undefined} />
          <Metric label="Đơn được giao cho tôi" value={data.orderQueues.assignedToMe} detail={data.orderQueues.assignedToMe === null ? 'Tính năng phân công đơn chưa được cấu hình.' : undefined} />
        </div>
        <h2>Chăm sóc khách hàng</h2>
        <div className="operations-metrics">
          <Metric label="Ticket chưa phân công" value={data.ticketQueues.unassigned} />
          <Metric label="Ticket của tôi" value={data.ticketQueues.assignedToMe} />
          <Metric label="Lead mới" value={data.operationalCounts.newContacts} />
          <Metric label="Thông báo chưa đọc" value={data.operationalCounts.unreadNotifications} />
        </div>
        <h2>Tồn kho</h2>
        <div className="operations-empty" role="status">{data.lowStock === null ? 'Chưa cấu hình ngưỡng tồn kho; chưa thể đếm sản phẩm sắp hết hàng.' : `Có ${count(data.lowStock)} sản phẩm dưới ngưỡng đã cấu hình.`}</div>
      </>}
    </section>
  );
}
