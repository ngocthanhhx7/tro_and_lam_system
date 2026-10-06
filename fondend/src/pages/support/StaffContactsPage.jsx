import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/auth.context.js';
import { supportApi } from '../../services/support/support.api.js';
import './support.css';

const STATUS = { new: 'Mới', assigned: 'Đã phân công', contacted: 'Đã liên hệ', closed: 'Đã đóng' };
const KIND = { general: 'Liên hệ chung', corporate: 'Quà tặng tổ chức', quote: 'Báo giá sản phẩm' };

function ContactCard({ contact, currentUserId, onUpdated }) {
  const [note, setNote] = useState(contact.note || '');
  const [status, setStatus] = useState(contact.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save({ assignment = false } = {}) {
    setBusy(true); setError('');
    try {
      const response = await supportApi.updateStaffContact(contact.id, {
        ...(assignment ? { assignedTo: currentUserId } : { status, note: note.trim() }),
        expectedVersion: contact.version,
      });
      await onUpdated(response.data);
    } catch (requestError) { setError(requestError.message || 'Không thể cập nhật yêu cầu liên hệ.'); }
    finally { setBusy(false); }
  }
  return <article className="support-card support-contact-card">
    <div className="support-own-review__top"><div><p className="support-eyebrow">{KIND[contact.kind] || contact.kind} · {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(contact.createdAt))}</p><h2>{contact.name}</h2></div><span className="support-status">{STATUS[contact.status] || contact.status}</span></div>
    <dl className="support-contact-card__details"><div><dt>Email</dt><dd><a href={`mailto:${contact.email}`}>{contact.email}</a></dd></div>{contact.phone && <div><dt>Điện thoại</dt><dd><a href={`tel:${contact.phone}`}>{contact.phone}</a></dd></div>}{contact.company && <div><dt>Tổ chức</dt><dd>{contact.company}</dd></div>}{contact.productId && <div><dt>Sản phẩm</dt><dd>{contact.productId}</dd></div>}{contact.quantity && <div><dt>Số lượng</dt><dd>{contact.quantity}</dd></div>}</dl>
    <p className="support-contact-card__message">{contact.message}</p>
    <div className="support-form__grid"><label className="support-field">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value)}>{Object.entries(STATUS).map(([key, label]) => <option key={key} value={key} disabled={key === 'assigned' && !contact.assignedTo}>{label}</option>)}</select></label><label className="support-field">Ghi chú nội bộ<textarea rows="2" maxLength="5000" value={note} onChange={(event) => setNote(event.target.value)} /></label></div>
    {contact.assignedTo && <p className="support-optional">Đang phụ trách: {contact.assignedTo}</p>}
    {error && <p className="support-feedback support-feedback--error" role="alert">{error}</p>}
    <div className="support-actions">{contact.assignedTo !== currentUserId && contact.status !== 'closed' && <button className="support-button support-button--quiet" type="button" disabled={busy} onClick={() => save({ assignment: true })}>Nhận yêu cầu</button>}<button className="support-button" type="button" disabled={busy} onClick={() => save()}>{busy ? 'Đang lưu…' : 'Lưu cập nhật'}</button></div>
  </article>;
}

export default function StaffContactsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('new');
  const [kind, setKind] = useState('');
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await supportApi.listStaffContacts({ status: status || undefined, kind: kind || undefined, page, limit: 20 });
      setItems(response.data || []); setPagination(response.meta?.pagination || null);
    } catch (requestError) { setError(requestError.message || 'Không thể tải hàng đợi liên hệ.'); }
    finally { setLoading(false); }
  }, [kind, page, status]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Starts an async fetch; loading updates accompany the request.
  useEffect(() => { void load(); }, [load]);
  async function replaceUpdated(updated) {
    setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
  }
  return <section className="support-page">
    <header className="support-intro support-intro--split"><div><p className="support-eyebrow">TRO &amp; LAM · VẬN HÀNH</p><h1>Liên hệ &amp; tư vấn</h1><p>Các yêu cầu được lưu trước khi email được xử lý bởi hàng đợi gửi thư.</p></div><div className="support-inline-filters"><label className="support-field">Trạng thái<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="new">Mới</option><option value="assigned">Đã phân công</option><option value="contacted">Đã liên hệ</option><option value="closed">Đã đóng</option><option value="">Tất cả</option></select></label><label className="support-field">Loại<select value={kind} onChange={(event) => { setKind(event.target.value); setPage(1); }}><option value="">Tất cả</option><option value="general">Liên hệ chung</option><option value="corporate">Quà tặng tổ chức</option><option value="quote">Báo giá sản phẩm</option></select></label></div></header>
    {loading && <p className="support-state" role="status">Đang tải yêu cầu liên hệ…</p>}
    {error && !loading && <div className="support-feedback support-feedback--error" role="alert"><p>{error}</p><button className="support-button support-button--quiet" type="button" onClick={load}>Thử lại</button></div>}
    {!loading && !error && items.length === 0 && <div className="support-empty"><strong>Không có yêu cầu trong bộ lọc này</strong><p>Thử trạng thái khác hoặc làm mới hàng đợi.</p></div>}
    {!loading && !error && <div className="support-review-grid">{items.map((contact) => <ContactCard key={`${contact.id}:${contact.version}`} contact={contact} currentUserId={user?.id} onUpdated={replaceUpdated} />)}</div>}
    {pagination?.totalPages > 1 && <nav className="support-pagination" aria-label="Phân trang liên hệ"><button className="support-button support-button--quiet" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Trang trước</button><span>Trang {page} / {pagination.totalPages}</span><button className="support-button support-button--quiet" type="button" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Trang sau</button></nav>}
  </section>;
}
