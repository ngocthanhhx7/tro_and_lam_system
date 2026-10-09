import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { operationsApi } from '../../../services/operations/operationsApi.js';
import { commerceApi } from '../../../services/commerce/commerce.api.js';
import { supportApi } from '../../../services/support/support.api.js';
import { WorkspaceMetric, WorkspacePanel, RecentOrders } from '../../../components/workspace/WorkspaceParts.jsx';
import { count } from '../../../components/workspace/workspaceUtils.js';
import Icon from '../../../components/catalog/Icon.jsx';
import '../../../components/notifications/operations.css';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const before = (days) => { const value = new Date(`${today()}T12:00:00+07:00`); value.setDate(value.getDate() - days + 1); return value.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); };
const dateTime = (date, end = false) => new Date(`${date}T${end ? '23:59:59.999' : '00:00:00'}+07:00`).toISOString();
const time = (date) => new Date(date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });

export default function StaffDashboardPage() {
  const [draft, setDraft] = useState({ from: today(), to: today() });
  const [range, setRange] = useState(draft);
  const [preset, setPreset] = useState(1);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [updatedAt, setUpdatedAt] = useState(null);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    const filters = { from: dateTime(range.from), to: dateTime(range.to, true) };
    const names = ['dashboard', 'orders', 'tickets', 'contacts', 'notifications', 'returns'];
    const values = await Promise.allSettled([
      operationsApi.getStaffDashboard(filters),
      commerceApi.listStaffOrders({ ...filters, queue: 'pending', limit: 5 }),
      supportApi.listStaffTickets({ status: 'open', page: 1, limit: 5 }),
      supportApi.listStaffContacts({ status: 'new', page: 1, limit: 4 }),
      operationsApi.listNotifications({ unreadOnly: true, limit: 4 }),
      supportApi.listStaffReturns({ status: 'requested', limit: 3 }),
    ]);
    if (sequence !== requestSequence.current) return;
    setResults(Object.fromEntries(values.map((value, index) => [names[index], value.status === 'fulfilled' ? value.value : null])));
    setErrors(Object.fromEntries(values.map((value, index) => [names[index], value.status === 'rejected' ? 'Chưa tải được dữ liệu. Hãy thử làm mới.' : ''])));
    setUpdatedAt(new Date());
    setLoading(false);
  }, [range]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => { window.clearTimeout(timer); requestSequence.current += 1; }; }, [load]);
  const data = results.dashboard?.data;
  const setDays = (days) => { const next = { from: before(days), to: today() }; setDraft(next); setRange(next); setPreset(days); };

  return <section className="operations-page">
    <header className="operations-page__heading"><div><p className="operations-eyebrow">TRO &amp; LAM · VẬN HÀNH</p><h1>Bảng công việc</h1><p>Tổng hợp công việc và yêu cầu cần xử lý trong ca trực.</p></div><button className="operations-button operations-button--quiet" onClick={() => void load()} disabled={loading}>Làm mới</button></header>
    <form className="operations-toolbar" onSubmit={(event) => { event.preventDefault(); setRange({ ...draft }); }}>
      <div className="admin-overview__presets">{[[1, 'Hôm nay'], [7, '7 ngày qua'], [30, '30 ngày qua']].map(([days, label]) => <button type="button" className={`admin-overview__preset${preset === days ? ' is-active' : ''}`} aria-pressed={preset === days} key={days} onClick={() => setDays(days)}>{label}</button>)}</div>
      <label>Từ ngày<input type="date" required max={draft.to} value={draft.from} onChange={(event) => { setDraft({ ...draft, from: event.target.value }); setPreset(null); }} /></label><label>Đến ngày<input type="date" required min={draft.from} value={draft.to} onChange={(event) => { setDraft({ ...draft, to: event.target.value }); setPreset(null); }} /></label><button className="operations-button" type="submit">Áp dụng</button>
    </form>
    {loading && <p role="status">Đang tải công việc…</p>}
    {errors.dashboard && <p role="alert" className="operations-error">{errors.dashboard}</p>}
    {!loading && <>
      <div className="operations-metrics">
        <WorkspaceMetric label="Đơn cần xử lý" value={data ? count(data.orderQueues.pending + data.orderQueues.processing) : '—'} detail={data ? `${count(data.orderQueues.pending)} chờ xác nhận · ${count(data.orderQueues.processing)} đang xử lý` : 'Dữ liệu chưa khả dụng'} to="/staff/orders" />
        <WorkspaceMetric label="Yêu cầu hỗ trợ" icon="message" value={data ? count(data.ticketQueues.unassigned + data.ticketQueues.assignedToMe) : '—'} detail={data ? `${count(data.ticketQueues.unassigned)} chưa phân công · ${count(data.ticketQueues.assignedToMe)} của tôi` : 'Dữ liệu chưa khả dụng'} to="/staff/support" />
        <WorkspaceMetric label="Liên hệ mới" icon="users" value={count(data?.operationalCounts.newContacts)} detail="Yêu cầu tư vấn được tạo trong kỳ" to="/staff/contacts" />
        <WorkspaceMetric label="Thông báo chưa đọc" icon="bell" value={count(data?.operationalCounts.unreadNotifications)} detail="Cập nhật riêng cho tài khoản của bạn" to="/staff/notifications" />
      </div>
      <div className="workspace-grid"><RecentOrders orders={results.orders?.data || []} error={errors.orders} home="/staff" title="Đơn hàng chờ xác nhận" /><WorkspacePanel title="Yêu cầu đổi trả" description="Hồ sơ đang chờ xem xét, trên toàn bộ thời gian." to="/staff/returns">
        {errors.returns ? <p role="alert">{errors.returns}</p> : results.returns?.data?.length ? results.returns.data.map((item) => <Link className="workspace-ticket" to={`/staff/support/${item.ticketId}`} key={item.id}><Icon name="return" size={20} /><div><strong>Đơn {item.orderId}</strong><p>{item.message}</p><small>Chờ xem xét · {time(item.createdAt)}</small></div><Icon name="arrow" size={17} /></Link>) : <p className="workspace-empty">Không có yêu cầu đổi trả chờ xử lý.</p>}
      </WorkspacePanel></div>
      <div className="workspace-grid"><WorkspacePanel title="Khách hàng cần hỗ trợ" description="Cuộc trao đổi mới tiếp nhận, trên toàn bộ thời gian." to="/staff/support">
        {errors.tickets ? <p role="alert">{errors.tickets}</p> : results.tickets?.data?.length ? results.tickets.data.map((ticket) => <Link className="workspace-ticket" to={`/staff/support/${ticket.id}`} key={ticket.id}><span className="workspace-initials"><Icon name="message" size={15} /></span><div><strong>{ticket.subject || ticket.type || 'Yêu cầu hỗ trợ'}</strong><small>{time(ticket.createdAt)}</small><p>{ticket.message || ticket.description}</p></div><span className="workspace-badge workspace-badge--pending">Mới tiếp nhận</span><Icon name="arrow" size={17} /></Link>) : <p className="workspace-empty">Không có cuộc trao đổi mới.</p>}
      </WorkspacePanel><WorkspacePanel title="Liên hệ mới" description="Yêu cầu tư vấn chưa xử lý, trên toàn bộ thời gian." to="/staff/contacts">
        {errors.contacts ? <p role="alert">{errors.contacts}</p> : results.contacts?.data?.length ? results.contacts.data.map((contact) => <Link className="workspace-ticket" to={`/staff/contacts?contact=${contact.id}`} key={contact.id}><div><strong>{contact.name}</strong><small>{contact.phone || contact.email}</small><p>{contact.message}</p></div><Icon name="arrow" size={17} /></Link>) : <p className="workspace-empty">Chưa có yêu cầu tư vấn mới.</p>}
      </WorkspacePanel></div>
      <div className="workspace-grid"><WorkspacePanel title="Tồn kho cần chú ý" description="Tồn khả dụng hiện tại ≤ 5 sản phẩm · Tối đa 10 mã hàng cần ưu tiên.">
        {data?.inventoryAlerts?.items?.length ? <div className="workspace-table-wrap" tabIndex="0" role="region" aria-label="Bảng tồn kho cần chú ý"><table><thead><tr><th>Tác phẩm</th><th>Mã SKU</th><th>Tồn kho</th><th>Đã giữ</th><th>Khả dụng</th></tr></thead><tbody>{data.inventoryAlerts.items.map((item) => <tr key={item.productId}><td>{item.name}</td><td>{item.sku}</td><td>{count(item.onHand)}</td><td>{count(item.reserved)}</td><td><span className={`workspace-badge workspace-badge--${item.available <= 0 ? 'failed' : 'pending'}`}>{count(item.available)} · {item.available <= 0 ? 'Hết hàng' : 'Sắp hết'}</span></td></tr>)}</tbody></table></div> : <p className="workspace-empty">{data?.inventoryAlerts ? 'Không có mã hàng nào có tồn khả dụng từ 5 trở xuống.' : 'Chưa tải được dữ liệu tồn kho.'}</p>}
      </WorkspacePanel><WorkspacePanel title="Thông báo ca trực" description="Cập nhật mới cho tài khoản của bạn." to="/staff/notifications">
        {errors.notifications ? <p role="alert">{errors.notifications}</p> : results.notifications?.data?.length ? results.notifications.data.map((item) => <Link key={item.id} className="workspace-notification" to="/staff/notifications"><strong>{item.title}</strong><small>{time(item.createdAt)}</small></Link>) : <p className="workspace-empty">Bạn đã đọc tất cả thông báo.</p>}
      </WorkspacePanel></div>
      <p className="admin-overview__range-note">{updatedAt && `Đã tải dữ liệu lúc ${updatedAt.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`} · Các số đếm đơn hàng và liên hệ áp dụng khoảng ngày đã chọn.</p>
    </>}
  </section>;
}
