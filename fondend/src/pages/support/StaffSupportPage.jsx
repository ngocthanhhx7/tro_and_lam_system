import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import { supportApi } from '../../services/support/support.api.js';
import SupportAttachmentPicker from './SupportAttachmentPicker.jsx';
import './support.css';

const TICKET_STATUS = {
  open: 'Mới tiếp nhận', assigned: 'Đã phân công', in_progress: 'Đang xử lý',
  waiting_customer: 'Chờ khách phản hồi', resolved: 'Đã giải quyết', closed: 'Đã đóng',
};
const RETURN_STATUS = { requested: 'Chờ xem xét', approved: 'Đã duyệt', rejected: 'Đã từ chối', received: 'Đã kiểm nhận', closed: 'Đã đóng' };

function formatTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

function StaffThread({ ticketId }) {
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [attachmentIds, setAttachmentIds] = useState([]);
  const [attachmentPickerKey, setAttachmentPickerKey] = useState(0);
  const [visibility, setVisibility] = useState('customer');
  const [nextStatus, setNextStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [ticketResponse, messageResponse] = await Promise.all([
        supportApi.getTicket(ticketId), supportApi.listTicketMessages(ticketId),
      ]);
      setTicket(ticketResponse.data); setMessages(messageResponse.data || []);
    } catch (requestError) { setError(requestError.message || 'Không thể tải yêu cầu.'); }
    finally { setLoading(false); }
  }, [ticketId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Starts an async fetch; loading updates accompany the request.
  useEffect(() => { void load(); }, [load]);

  async function claimTicket() {
    if (!user?.id || !ticket) return;
    setBusy(true); setError('');
    try {
      const status = ticket.status === 'open' ? 'assigned' : ticket.status;
      const response = await supportApi.updateStaffTicket(ticket.id, { status, assignedTo: user.id, expectedVersion: ticket.version });
      setTicket(response.data);
    } catch (requestError) { setError(requestError.message || 'Không thể nhận yêu cầu.'); }
    finally { setBusy(false); }
  }

  async function sendMessage(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await supportApi.createTicketMessage(ticketId, { body: body.trim(), attachmentIds, visibility });
      setBody(''); setAttachmentIds([]); setAttachmentPickerKey((key) => key + 1); await load();
    } catch (requestError) { setError(requestError.message || 'Không thể gửi tin nhắn.'); }
    finally { setBusy(false); }
  }

  if (loading && !ticket) return <p className="support-state" role="status">Đang tải yêu cầu hỗ trợ…</p>;
  if (error && !ticket) return <div className="support-feedback support-feedback--error" role="alert"><p>{error}</p><button className="support-button support-button--quiet" type="button" onClick={load}>Thử lại</button></div>;
  if (!ticket) return <p className="support-empty">Không tìm thấy yêu cầu.</p>;
  const allowedStatuses = {
    open: ['in_progress'], assigned: ['in_progress'], in_progress: ['waiting_customer', 'resolved'],
    waiting_customer: ['in_progress', 'resolved'], resolved: ['in_progress', 'closed'], closed: [],
  }[ticket.status] || [];
  return <section className="support-thread">
    <header className="support-card support-thread__header"><div><p className="support-eyebrow">{ticket.code} · {ticket.kind}</p><h1>{ticket.subject}</h1><p>{TICKET_STATUS[ticket.status] || ticket.status} · {formatTime(ticket.createdAt)}</p></div><Link className="support-link" to="/staff/support">← Hàng đợi</Link></header>
    <div className="support-card support-staff-ticket-tools"><p>{ticket.orderId ? <>Đơn liên quan: <Link to={`/staff/orders/${ticket.orderId}`}>{ticket.orderId}</Link></> : 'Không gắn với đơn hàng'}</p><p>Người phụ trách: {ticket.assignedTo || 'Chưa phân công'}</p><div className="support-actions">
      {!ticket.assignedTo && <button className="support-button" type="button" disabled={busy} onClick={claimTicket}>Nhận xử lý</button>}
      {allowedStatuses.length > 0 && <><select aria-label="Trạng thái tiếp theo" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}><option value="">Chọn trạng thái</option>{allowedStatuses.map((status) => <option key={status} value={status}>{TICKET_STATUS[status]}</option>)}</select><button className="support-button support-button--quiet" type="button" disabled={busy || !nextStatus} onClick={async () => {
        setBusy(true); setError('');
        try { const response = await supportApi.updateStaffTicket(ticket.id, { status: nextStatus, expectedVersion: ticket.version }); setTicket(response.data); setNextStatus(''); }
        catch (requestError) { setError(requestError.message || 'Không thể cập nhật trạng thái.'); }
        finally { setBusy(false); }
      }}>Cập nhật</button></>}
    </div></div>
    <section className="support-card support-conversation" aria-label="Trao đổi hỗ trợ">
      {messages.length === 0 && <p className="support-state">Chưa có tin nhắn.</p>}
      {messages.map((message) => <article className={`support-message${message.visibility === 'internal' ? ' support-message--internal' : ''}`} key={message.id}>
        <div><strong>{message.authorRole === 'customer' || message.authorRole === 'guest' ? 'Khách hàng' : message.authorRole === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</strong><span className="support-status">{message.visibility === 'internal' ? 'Ghi chú nội bộ' : 'Khách có thể xem'}</span><time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time></div>
        <p>{message.body}</p>
        {message.attachmentIds?.length > 0 && <ul className="support-attachment-list">{message.attachmentIds.map((id) => <li key={id}><a href={`/api/v1/attachments/${encodeURIComponent(id)}/download`} target="_blank" rel="noreferrer">Mở ảnh đính kèm</a></li>)}</ul>}
      </article>)}
    </section>
    {ticket.status !== 'closed' && <form className="support-card support-form" onSubmit={sendMessage}>
      <div className="support-form__grid"><label className="support-field">Loại tin nhắn<select value={visibility} onChange={(event) => { setVisibility(event.target.value); setAttachmentIds([]); setAttachmentPickerKey((key) => key + 1); }}><option value="customer">Phản hồi khách hàng</option><option value="internal">Ghi chú nội bộ</option></select></label></div>
      <label className="support-field">Nội dung<textarea required rows="4" maxLength="10000" value={body} onChange={(event) => setBody(event.target.value)} /></label>
      <SupportAttachmentPicker key={`${ticketId}-${visibility}-${attachmentPickerKey}`} ticketId={ticketId} orderId={ticket.orderId} visibility={visibility} onAttachmentsChange={setAttachmentIds} disabled={busy} />
      {error && <p className="support-feedback support-feedback--error" role="alert">{error}</p>}
      <button className="support-button" type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi tin nhắn'}</button>
    </form>}
  </section>;
}

function ReturnsQueue() {
  const [status, setStatus] = useState('requested');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await supportApi.listStaffReturns({ page: 1, limit: 50, status: status || undefined }); setItems(response.data || []); }
    catch (requestError) { setError(requestError.message || 'Không thể tải yêu cầu đổi trả.'); }
    finally { setLoading(false); }
  }, [status]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Starts an async fetch; loading updates accompany the request.
  useEffect(() => { void load(); }, [load]);
  const [draft, setDraft] = useState({});
  async function act(request, action) {
    const value = draft[request.id] || {};
    setError('');
    try {
      if (action === 'approve' || action === 'reject') {
        await supportApi.decideReturn(request.id, { decision: action === 'approve' ? 'approved' : 'rejected', reason: (value.reason || '').trim(), expectedVersion: request.version });
      } else if (action === 'inspect') {
        await supportApi.inspectReturn(request.id, {
          items: request.items.map((item) => ({ productId: item.productId, receivedQuantity: Number(value[`received:${item.productId}`] ?? item.quantity), resellableQuantity: Number(value[`resellable:${item.productId}`] ?? item.quantity) })),
          evidenceReference: (value.evidenceReference || '').trim(), expectedVersion: request.version,
        });
      } else if (action === 'close') {
        await supportApi.closeReturn(request.id, { reason: (value.reason || '').trim(), expectedVersion: request.version });
      }
      await load();
    } catch (requestError) { setError(requestError.message || 'Không thể cập nhật yêu cầu đổi trả.'); }
  }
  return <section className="support-section">
    <div className="support-section__heading"><div><p className="support-eyebrow">ĐƠN HÀNG</p><h2>Yêu cầu đổi trả</h2></div><label className="support-field">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value)}>{Object.entries(RETURN_STATUS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}<option value="">Tất cả</option></select></label></div>
    {loading && <p className="support-state" role="status">Đang tải yêu cầu…</p>}
    {error && <p className="support-feedback support-feedback--error" role="alert">{error}</p>}
    {!loading && !error && items.length === 0 && <p className="support-empty">Không có yêu cầu trong trạng thái này.</p>}
    <div className="support-review-grid">{items.map((request) => <article className="support-card support-return-card" key={request.id}>
      <div className="support-own-review__top"><div><p className="support-eyebrow">ĐƠN {request.orderId}</p><h3>{RETURN_STATUS[request.status]}</h3></div><Link className="support-link" to={`/staff/support/${request.ticketId}`}>Mở cuộc trao đổi</Link></div>
      <p>{request.message}</p>
      <ul>{request.items.map((item) => <li key={item.productId}>{item.productId} · yêu cầu {item.quantity} · {item.reason}</li>)}</ul>
      {request.status === 'requested' && <><label className="support-field">Lý do quyết định<textarea rows="2" maxLength="1000" value={draft[request.id]?.reason || ''} onChange={(event) => setDraft({ ...draft, [request.id]: { ...draft[request.id], reason: event.target.value } })} /></label><div className="support-actions"><button className="support-button" type="button" onClick={() => act(request, 'approve')}>Duyệt</button><button className="support-button support-button--quiet" type="button" onClick={() => act(request, 'reject')}>Từ chối</button></div></>}
      {request.status === 'approved' && <div className="support-form">
        {request.items.map((item) => <div className="support-form__grid" key={item.productId}><p>{item.productId} · tối đa {item.quantity}</p><label className="support-field">Đã nhận<input type="number" min="0" max={item.quantity} step="1" value={draft[request.id]?.[`received:${item.productId}`] ?? item.quantity} onChange={(event) => setDraft({ ...draft, [request.id]: { ...draft[request.id], [`received:${item.productId}`]: event.target.value } })} /></label><label className="support-field">Có thể bán lại<input type="number" min="0" max={item.quantity} step="1" value={draft[request.id]?.[`resellable:${item.productId}`] ?? item.quantity} onChange={(event) => setDraft({ ...draft, [request.id]: { ...draft[request.id], [`resellable:${item.productId}`]: event.target.value } })} /></label></div>)}
        <label className="support-field">Mã chứng từ kiểm nhận<input required maxLength="500" value={draft[request.id]?.evidenceReference || ''} onChange={(event) => setDraft({ ...draft, [request.id]: { ...draft[request.id], evidenceReference: event.target.value } })} /></label><button className="support-button" type="button" onClick={() => act(request, 'inspect')}>Lưu kết quả kiểm nhận</button>
      </div>}
      {request.status === 'received' && <><label className="support-field">Lý do đóng hồ sơ<textarea rows="2" required maxLength="1000" value={draft[request.id]?.reason || ''} onChange={(event) => setDraft({ ...draft, [request.id]: { ...draft[request.id], reason: event.target.value } })} /></label><button className="support-button" type="button" onClick={() => act(request, 'close')}>Đóng hồ sơ đổi trả</button></>}
    </article>)}</div>
  </section>;
}

function TicketQueue() {
  const [status, setStatus] = useState('open');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await supportApi.listStaffTickets({ page: 1, limit: 50, status: status || undefined }); setItems(response.data || []); }
    catch (requestError) { setError(requestError.message || 'Không thể tải hàng đợi hỗ trợ.'); }
    finally { setLoading(false); }
  }, [status]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Starts an async fetch; loading updates accompany the request.
  useEffect(() => { void load(); }, [load]);
  return <section className="support-section"><div className="support-section__heading"><div><p className="support-eyebrow">HỖ TRỢ KHÁCH HÀNG</p><h2>Cuộc trao đổi</h2></div><label className="support-field">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">Mới tiếp nhận</option><option value="assigned">Đã phân công</option><option value="in_progress">Đang xử lý</option><option value="waiting_customer">Chờ khách phản hồi</option><option value="resolved">Đã giải quyết</option><option value="closed">Đã đóng</option><option value="">Tất cả</option></select></label></div>
    {loading && <p className="support-state" role="status">Đang tải hàng đợi…</p>}{error && <p className="support-feedback support-feedback--error" role="alert">{error}</p>}
    {!loading && !error && items.length === 0 && <p className="support-empty">Không có yêu cầu trong trạng thái này.</p>}
    <ul className="support-ticket-list">{items.map((ticket) => <li key={ticket.id}><Link to={`/staff/support/${ticket.id}`}><span><strong>{ticket.subject}</strong><small>{ticket.code} · {ticket.kind} · {formatTime(ticket.latestMessageAt)}</small></span><span className="support-status">{TICKET_STATUS[ticket.status] || ticket.status}</span></Link></li>)}</ul>
  </section>;
}

export default function StaffSupportPage() {
  const { id } = useParams();
  const [tab, setTab] = useState('tickets');
  if (id) return <section className="support-page"><StaffThread ticketId={id} /></section>;
  return <section className="support-page"><header className="support-intro support-intro--split"><div><p className="support-eyebrow">TRO &amp; LAM · VẬN HÀNH</p><h1>Hỗ trợ khách hàng</h1><p>Tiếp nhận yêu cầu, trao đổi với khách và ghi chú nội bộ theo đúng quyền.</p></div><nav className="support-tabs" aria-label="Các hàng đợi"><button type="button" className={tab === 'tickets' ? 'is-active' : ''} onClick={() => setTab('tickets')}>Yêu cầu hỗ trợ</button><button type="button" className={tab === 'returns' ? 'is-active' : ''} onClick={() => setTab('returns')}>Đổi trả</button></nav></header>
    {tab === 'tickets' ? <TicketQueue /> : <ReturnsQueue />}</section>;
}
