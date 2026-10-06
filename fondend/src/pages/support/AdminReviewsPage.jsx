import { useCallback, useEffect, useState } from 'react';
import { supportApi } from '../../services/support/support.api.js';
import './support.css';

const STATUS = { pending: 'Chờ duyệt', published: 'Đã công bố', hidden: 'Đang ẩn' };

function ReviewModerationCard({ review, onUpdated }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function moderate(status) {
    if (!reason.trim()) { setError('Nhập lý do kiểm duyệt trước khi cập nhật.'); return; }
    setBusy(true); setError('');
    try {
      await supportApi.moderateReview(review.id, { status, reason: reason.trim(), expectedVersion: review.version });
      setReason(''); await onUpdated();
    } catch (requestError) { setError(requestError.message || 'Không thể cập nhật trạng thái đánh giá.'); }
    finally { setBusy(false); }
  }
  return <article className="support-card support-moderation-card">
    <div className="support-own-review__top"><div><p className="support-eyebrow">ĐƠN {review.orderId} · SẢN PHẨM {review.productId}</p><h2>{review.rating} / 5 sao</h2></div><span className={`support-status support-status--${review.status}`}>{STATUS[review.status] || review.status}</span></div>
    <blockquote>{review.comment || 'Khách hàng chưa viết nhận xét.'}</blockquote>
    <dl className="support-review-meta"><div><dt>Đã gửi</dt><dd>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(review.createdAt))}</dd></div><div><dt>Ảnh đính kèm</dt><dd>{review.attachmentIds?.length || 0}</dd></div></dl>
    <label className="support-field">Lý do kiểm duyệt<textarea rows="2" maxLength="1000" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    {error && <p className="support-feedback support-feedback--error" role="alert">{error}</p>}
    <div className="support-actions">
      {review.status !== 'published' && <button className="support-button" type="button" disabled={busy} onClick={() => moderate('published')}>{busy ? 'Đang lưu…' : 'Công bố'}</button>}
      {review.status !== 'hidden' && <button className="support-button support-button--quiet" type="button" disabled={busy} onClick={() => moderate('hidden')}>Ẩn đánh giá</button>}
    </div>
  </article>;
}

export default function AdminReviewsPage() {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await supportApi.listAdminReviews({ status: status || undefined, page, limit: 20 });
      setItems(response.data || []); setPagination(response.meta?.pagination || null);
    } catch (requestError) { setError(requestError.message || 'Không thể tải hàng đợi kiểm duyệt.'); }
    finally { setLoading(false); }
  }, [status, page]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Starts an async fetch; loading updates accompany the request.
  useEffect(() => { void load(); }, [load]);
  return <section className="support-page">
    <header className="support-intro support-intro--split"><div><p className="support-eyebrow">QUẢN TRỊ · NỘI DUNG DO KHÁCH GỬI</p><h1>Kiểm duyệt đánh giá</h1><p>Chỉ đánh giá từ đơn đã giao mới được tạo. Việc công bố và ẩn đều lưu lý do cùng phiên bản dữ liệu.</p></div><label className="support-field">Trạng thái<select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}><option value="pending">Chờ duyệt</option><option value="published">Đã công bố</option><option value="hidden">Đang ẩn</option><option value="">Tất cả</option></select></label></header>
    {loading && <p className="support-state" role="status">Đang tải đánh giá…</p>}
    {error && !loading && <div className="support-feedback support-feedback--error" role="alert"><p>{error}</p><button className="support-button support-button--quiet" type="button" onClick={load}>Thử lại</button></div>}
    {!loading && !error && items.length === 0 && <div className="support-empty"><strong>Không có đánh giá trong hàng đợi này</strong><p>Đánh giá đã được lọc theo trạng thái đang chọn.</p></div>}
    {!loading && !error && <div className="support-review-grid">{items.map((review) => <ReviewModerationCard key={review.id} review={review} onUpdated={load} />)}</div>}
    {pagination?.totalPages > 1 && <nav className="support-pagination" aria-label="Phân trang đánh giá"><button className="support-button support-button--quiet" disabled={page <= 1 || loading} type="button" onClick={() => setPage((value) => value - 1)}>Trang trước</button><span>Trang {page} / {pagination.totalPages}</span><button className="support-button support-button--quiet" disabled={page >= pagination.totalPages || loading} type="button" onClick={() => setPage((value) => value + 1)}>Trang sau</button></nav>}
  </section>;
}
