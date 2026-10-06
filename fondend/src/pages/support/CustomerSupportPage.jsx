import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createSupportIdempotencyKey, supportApi } from '../../services/support/support.api.js';
import './support.css';

const TICKET_STATUS = {
  open: 'Mới tiếp nhận', assigned: 'Đã phân công', in_progress: 'Đang xử lý',
  waiting_customer: 'Chờ phản hồi', resolved: 'Đã giải quyết', closed: 'Đã đóng',
};

function formatTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

function TicketThread({ ticketId }) {
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ticketResponse, messagesResponse] = await Promise.all([
        supportApi.getTicket(ticketId), supportApi.listTicketMessages(ticketId),
      ]);
      setTicket(ticketResponse.data);
      setMessages(messagesResponse.data || []);
    } catch (requestError) {
      setError(requestError.message || 'Không thể tải nội dung yêu cầu hỗ trợ.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- Starts an async fetch; loading updates accompany the request.
  useEffect(() => { void load(); }, [load]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await supportApi.createTicketMessage(ticketId, { body: body.trim(), attachmentIds: [], visibility: 'customer' });
      setBody('');
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Chưa thể gửi phản hồi.');
    } finally {
      setBusy(false);
    }
  }

  if (loading && !ticket) return <p className="support-state" role="status">Đang tải cuộc trao đổi…</p>;
  if (error && !ticket) return <div className="support-feedback support-feedback--error" role="alert"><p>{error}</p><button className="support-button support-button--quiet" type="button" onClick={load}>Thử lại</button></div>;
  if (!ticket) return <p className="support-state">Không tìm thấy yêu cầu này.</p>;

  return <section className="support-thread">
    <header className="support-card support-thread__header">
      <div><p className="support-eyebrow">MÃ YÊU CẦU {ticket.code}</p><h1>{ticket.subject}</h1><p>{TICKET_STATUS[ticket.status] || ticket.status} · Tạo lúc {formatTime(ticket.createdAt)}</p></div>
      <Link className="support-link" to="/tai-khoan/ho-tro">← Danh sách hỗ trợ</Link>
    </header>
    <section className="support-card support-conversation" aria-label="Tin nhắn trong yêu cầu">
      {messages.length === 0 && <p className="support-state">Chưa có tin nhắn.</p>}
      {messages.map((message) => <article className={`support-message${message.authorRole === 'customer' ? ' support-message--own' : ''}`} key={message.id}>
        <div><strong>{message.authorRole === 'customer' ? 'Bạn' : message.authorRole === 'guest' ? 'Bạn (khách)' : 'TRO & LAM'}</strong><time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time></div>
        <p>{message.body}</p>
      </article>)}
    </section>
    {ticket.status !== 'closed' && <form className="support-card support-form" onSubmit={submit}>
      <label className="support-field">Phản hồi
        <textarea rows="4" required maxLength="10000" value={body} onChange={(event) => setBody(event.target.value)} />
      </label>
      {error && <p className="support-feedback support-feedback--error" role="alert">{error}</p>}
      <button className="support-button" type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi phản hồi'}</button>
    </form>}
    {ticket.status === 'closed' && <p className="support-feedback">Yêu cầu này đã đóng. Nếu cần hỗ trợ thêm, hãy tạo yêu cầu mới.</p>}
  </section>;
}

function TicketCreateForm() {
  const [form, setForm] = useState({ kind: 'support', subject: '', body: '', orderId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(''); setCreated(null);
    try {
      const body = {
        kind: form.kind, subject: form.subject.trim(), body: form.body.trim(), attachmentIds: [],
        ...(form.orderId.trim() ? { orderId: form.orderId.trim() } : {}),
      };
      const response = await supportApi.createTicket(body);
      setCreated(response.data.ticket);
      setForm({ kind: 'support', subject: '', body: '', orderId: '' });
    } catch (requestError) {
      setError(requestError.message || 'Chưa thể tạo yêu cầu hỗ trợ.');
    } finally { setBusy(false); }
  }

  return <form className="support-card support-form" onSubmit={submit}>
    <div><p className="support-eyebrow">GỬI YÊU CẦU RIÊNG</p><h2>TRO &amp; LAM có thể hỗ trợ gì?</h2></div>
    <label className="support-field">Chủ đề
      <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
        <option value="support">Câu hỏi chung</option><option value="complaint">Phản ánh về đơn hàng</option>
      </select>
    </label>
    <label className="support-field">Tiêu đề
      <input required maxLength="200" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
    </label>
    <label className="support-field">Mã đơn hàng <span className="support-optional">(nếu liên quan đến đơn)</span>
      <input maxLength="24" value={form.orderId} onChange={(event) => setForm({ ...form, orderId: event.target.value })} />
    </label>
    <label className="support-field">Nội dung
      <textarea required rows="5" maxLength="10000" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
    </label>
    {error && <p className="support-feedback support-feedback--error" role="alert">{error}</p>}
    {created && <p className="support-feedback support-feedback--success" role="status">Đã tạo yêu cầu {created.code}. <Link to={`/tai-khoan/ho-tro/${created.id}`}>Mở cuộc trao đổi</Link></p>}
    <button className="support-button" type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Tạo yêu cầu'}</button>
  </form>;
}

function ReturnRequestForm() {
  const [orderId, setOrderId] = useState('');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [order, setOrder] = useState(null);
  const [returns, setReturns] = useState([]);
  const [reasons, setReasons] = useState({});
  const [message, setMessage] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true); setOrdersError('');
    try {
      const response = await supportApi.listOwnOrders({ status: 'delivered', page: 1, limit: 100 });
      setOrders(response.data || []);
      if (!orderId && response.data?.[0]?.id) setOrderId(response.data[0].id);
    } catch (requestError) { setOrdersError(requestError.message || 'Không thể tải danh sách đơn đã giao.'); }
    finally { setOrdersLoading(false); }
  }, [orderId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- Starts an async fetch; loading updates accompany the request.
  useEffect(() => { void loadOrders(); }, [loadOrders]);

  async function loadOrder(event) {
    event.preventDefault();
    if (!orderId) return;
    setBusy(true); setError(''); setSuccess(''); setOrder(null); setReturns([]);
    try {
      const response = await supportApi.getOrder(orderId.trim());
      setOrder(response.data);
      const returned = await supportApi.listOwnReturnRequests(response.data.id);
      setReturns(returned.data || []);
      setReasons(Object.fromEntries((response.data.items || []).map((item) => [item.productId, ''])));
    } catch (requestError) {
      setError(requestError.message || 'Không tìm thấy đơn hàng hoặc bạn chưa có quyền xem đơn này.');
    } finally { setBusy(false); }
  }

  async function submitReturn(event) {
    event.preventDefault();
    if (!order) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const requestKey = key || createSupportIdempotencyKey();
      setKey(requestKey);
      const body = {
        items: order.items.map((item) => ({ productId: item.productId, quantity: item.quantity, reason: (reasons[item.productId] || '').trim() })),
        message: message.trim(), expectedVersion: order.version,
      };
      const response = await supportApi.createReturnRequest(order.id, body, requestKey);
      setSuccess(`Yêu cầu đổi trả đã được ghi nhận (${response.data.id}).`);
      setKey('');
      const updated = await supportApi.getOrder(order.id);
      setOrder(updated.data);
      const listed = await supportApi.listOwnReturnRequests(order.id);
      setReturns(listed.data || []);
    } catch (requestError) {
      setError(requestError.message || 'Chưa thể gửi yêu cầu đổi trả.');
    } finally { setBusy(false); }
  }

  const alreadyActive = returns.some((request) => request.status !== 'rejected' && request.status !== 'closed');
  return <section className="support-card support-return">
    <div><p className="support-eyebrow">ĐỔI TRẢ · YÊU CẦU RIÊNG</p><h2>Trao đổi về đơn hàng đã nhận</h2><p>Yêu cầu được xem xét theo trạng thái và thông tin lưu trên đơn. Hệ thống chỉ tiếp nhận yêu cầu cho toàn bộ số lượng của từng đơn.</p></div>
    {ordersError && <p className="support-feedback support-feedback--error" role="alert">{ordersError} <button className="support-link-button" type="button" onClick={loadOrders}>Thử lại</button></p>}
    <form className="support-inline-form" onSubmit={loadOrder}>
      <label className="support-field">Đơn đã giao
        <select required value={orderId} onChange={(event) => { setOrderId(event.target.value); setOrder(null); setError(''); }} disabled={ordersLoading || orders.length === 0}>
          <option value="">{ordersLoading ? 'Đang tải đơn…' : orders.length ? 'Chọn đơn cần hỗ trợ' : 'Chưa có đơn đã giao'}</option>
          {orders.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.status}</option>)}
        </select>
      </label>
      <button className="support-button support-button--quiet" type="submit" disabled={busy || ordersLoading || !orderId}>{busy ? 'Đang tải…' : 'Tải thông tin đơn'}</button>
    </form>
    {error && <p className="support-feedback support-feedback--error" role="alert">{error}</p>}
    {success && <p className="support-feedback support-feedback--success" role="status">{success}</p>}
    {order && <div className="support-return__order">
      <p><strong>{order.code}</strong> · {order.status}</p>
      {returns.map((request) => <p className="support-return__existing" key={request.id}>Yêu cầu trước: {request.status}</p>)}
      {order.status !== 'delivered' && <p className="support-feedback">Đơn chưa ở trạng thái đã giao nên hiện chưa đủ điều kiện gửi yêu cầu này.</p>}
      {alreadyActive && <p className="support-feedback">Đơn đang có yêu cầu đổi trả cần xử lý.</p>}
      {order.status === 'delivered' && !alreadyActive && <form className="support-form" onSubmit={submitReturn}>
        <h3>Sản phẩm trong đơn</h3>
        <div className="support-return__items">{order.items.map((item) => <label className="support-field support-return__item" key={item.productId}>
          <span><strong>{item.name}</strong><small>SKU {item.sku} · Số lượng {item.quantity}</small></span>
          <textarea required maxLength="1000" rows="2" aria-label={`Lý do cho ${item.name}`} placeholder="Lý do yêu cầu" value={reasons[item.productId] || ''} onChange={(event) => setReasons({ ...reasons, [item.productId]: event.target.value })} />
        </label>)}</div>
        <label className="support-field">Mô tả thêm<textarea rows="3" required maxLength="5000" value={message} onChange={(event) => setMessage(event.target.value)} /></label>
        <button className="support-button" type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu đổi trả'}</button>
      </form>}
    </div>}
  </section>;
}

function CustomerSupportHome() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await supportApi.listOwnTickets({ page: 1, limit: 20 });
      setTickets(response.data || []);
    } catch (requestError) { setError(requestError.message || 'Không thể tải yêu cầu hỗ trợ.'); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Starts an async fetch; loading updates accompany the request.
  useEffect(() => { void load(); }, [load]);

  return <section className="support-page">
    <header className="support-intro"><p className="support-eyebrow">TÀI KHOẢN · CHĂM SÓC KHÁCH HÀNG</p><h1>Hỗ trợ &amp; đổi trả</h1><p>Xem lại các cuộc trao đổi hoặc gửi một yêu cầu mới. Thông tin đơn hàng được kiểm tra từ tài khoản của bạn.</p></header>
    {error && <div className="support-feedback support-feedback--error" role="alert"><p>{error}</p><button className="support-button support-button--quiet" type="button" onClick={load}>Thử lại</button></div>}
    <div className="support-layout">
      <section className="support-section"><div className="support-section__heading"><div><p className="support-eyebrow">LỊCH SỬ</p><h2>Yêu cầu của bạn</h2></div><button className="support-button support-button--quiet" type="button" onClick={load} disabled={loading}>Làm mới</button></div>
        {loading && <p className="support-state" role="status">Đang tải yêu cầu…</p>}
        {!loading && !error && tickets.length === 0 && <div className="support-empty"><strong>Chưa có cuộc trao đổi nào</strong><p>Biểu mẫu bên cạnh sẽ gửi nội dung tới hàng đợi hỗ trợ.</p></div>}
        <ul className="support-ticket-list">{tickets.map((ticket) => <li key={ticket.id}><Link to={`/tai-khoan/ho-tro/${ticket.id}`}><span><strong>{ticket.subject}</strong><small>{ticket.code} · {formatTime(ticket.createdAt)}</small></span><span className="support-status">{TICKET_STATUS[ticket.status] || ticket.status}</span></Link></li>)}</ul>
      </section>
      <div className="support-stack"><TicketCreateForm /><ReturnRequestForm /></div>
    </div>
  </section>;
}

export default function CustomerSupportPage() {
  const { id } = useParams();
  return id ? <section className="support-page"><TicketThread ticketId={id} /></section> : <CustomerSupportHome />;
}

export function GuestOrderSupportPage() {
  const { orderId } = useParams();
  const [form, setForm] = useState({ kind: 'support', subject: '', body: '' });
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await supportApi.createTicket({ ...form, subject: form.subject.trim(), body: form.body.trim(), orderId, attachmentIds: [] });
      setTicket(response.data.ticket);
    } catch (requestError) { setError(requestError.message || 'Không thể xác minh quyền truy cập đơn hàng.'); }
    finally { setBusy(false); }
  }
  return <section className="support-page support-page--narrow">
    <nav className="support-breadcrumbs" aria-label="Vị trí hiện tại"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span>Yêu cầu hỗ trợ theo đơn</span></nav>
    <header className="support-intro"><p className="support-eyebrow">HỖ TRỢ ĐƠN HÀNG</p><h1>Tiếp tục với TRO &amp; LAM</h1><p>Yêu cầu chỉ được tạo khi trình duyệt đang có quyền truy cập hợp lệ cho đơn này.</p></header>
    <form className="support-card support-form" onSubmit={submit}>
      <label className="support-field">Loại yêu cầu<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option value="support">Hỗ trợ đơn hàng</option><option value="complaint">Phản ánh</option></select></label>
      <label className="support-field">Tiêu đề<input required maxLength="200" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label>
      <label className="support-field">Nội dung<textarea required maxLength="10000" rows="6" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
      {error && <p className="support-feedback support-feedback--error" role="alert">{error}</p>}
      {ticket && <p className="support-feedback support-feedback--success" role="status">Đã tạo yêu cầu {ticket.code}. <Link to={`/tai-khoan/ho-tro/${ticket.id}`}>Mở cuộc trao đổi</Link></p>}
      <button className="support-button" type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
    </form>
  </section>;
}
