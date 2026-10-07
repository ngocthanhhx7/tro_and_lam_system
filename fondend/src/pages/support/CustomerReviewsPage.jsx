import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/catalog/Icon.jsx';
import { supportApi } from '../../services/support/support.api.js';
import './support.css';

async function loadAllPages(fetchPage, filters) {
  const first = await fetchPage({ ...filters, page: 1, limit: 100 });
  const items = [...(first.data || [])];
  const totalPages = first.meta?.pagination?.totalPages || 1;
  for (let page = 2; page <= totalPages; page += 1) {
    const response = await fetchPage({ ...filters, page, limit: 100 });
    items.push(...(response.data || []));
  }
  return items;
}

async function mapLimited(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  }));
  return results;
}

function EligibleReview({ item, onSaved }) {
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await supportApi.createReview({ orderId: item.orderId, productId: item.productId, rating: Number(rating), comment: comment.trim() });
      await onSaved();
    } catch (requestError) { setError(requestError.message || 'Chưa thể gửi đánh giá.'); }
    finally { setBusy(false); }
  }
  return <article className="support-card support-review-card">
    <div><p className="support-eyebrow">ĐƠN {item.orderCode}</p><h3>{item.name}</h3><p>SKU {item.sku} · Số lượng {item.quantity}</p></div>
    <form className="support-form" onSubmit={submit}>
      <label className="support-field">Đánh giá
        <select value={rating} onChange={(event) => setRating(event.target.value)}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} sao</option>)}</select>
      </label>
      <label className="support-field">Chia sẻ trải nghiệm <span className="support-optional">(không bắt buộc)</span>
        <textarea rows="3" maxLength="5000" value={comment} onChange={(event) => setComment(event.target.value)} />
      </label>
      {error && <p className="support-feedback support-feedback--error" role="alert">{error}</p>}
      <button className="support-button" type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi đánh giá'}</button>
    </form>
  </article>;
}

function OwnReview({ review, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(String(review.rating));
  const [comment, setComment] = useState(review.comment || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await supportApi.updateReview(review.id, { rating: Number(rating), comment: comment.trim(), expectedVersion: review.version });
      setEditing(false); await onSaved();
    } catch (requestError) { setError(requestError.message || 'Chưa thể cập nhật đánh giá.'); }
    finally { setBusy(false); }
  }
  const status = { pending: 'Đang chờ duyệt', published: 'Đã công bố', hidden: 'Chưa được công bố' }[review.status] || review.status;
  return <article className="support-card support-own-review">
    <div className="support-own-review__top"><div><p className="support-eyebrow">ĐÁNH GIÁ SẢN PHẨM</p><h3>{review.rating} / 5 sao</h3></div><span className={`support-status support-status--${review.status}`}>{status}</span></div>
    {!editing ? <><p>{review.comment || 'Bạn chưa viết nhận xét.'}</p>{review.moderationReason && <p className="support-note">Ghi chú kiểm duyệt: {review.moderationReason}</p>}<button className="support-link-button" type="button" onClick={() => setEditing(true)}>Chỉnh sửa đánh giá</button></> : <form className="support-form" onSubmit={save}>
      <label className="support-field">Số sao<select value={rating} onChange={(event) => setRating(event.target.value)}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} sao</option>)}</select></label>
      <label className="support-field">Nhận xét<textarea rows="3" maxLength="5000" value={comment} onChange={(event) => setComment(event.target.value)} /></label>
      {error && <p className="support-feedback support-feedback--error" role="alert">{error}</p>}
      <div className="support-actions"><button className="support-button" type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button><button className="support-button support-button--quiet" type="button" onClick={() => setEditing(false)} disabled={busy}>Hủy</button></div>
    </form>}
  </article>;
}

export default function CustomerReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [eligible, setEligible] = useState([]);
  const [incompleteOrderCount, setIncompleteOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [ownReviews, orderSummaries] = await Promise.all([
        loadAllPages(supportApi.listOwnReviews, {}),
        loadAllPages(supportApi.listOwnOrders, { status: 'delivered' }),
      ]);
      const details = await mapLimited(orderSummaries, 8, async (summary) => {
        try { return (await supportApi.getOrder(summary.id)).data; }
        catch { return null; }
      });
      const inaccessible = details.filter((detail) => !detail).length;
      const alreadyReviewed = new Set(ownReviews.map((review) => `${review.orderId}:${review.productId}`));
      const candidates = details.filter(Boolean).flatMap((order) => (order.items || []).map((item) => ({
        orderId: order.id, orderCode: order.code, productId: String(item.productId),
        name: item.name, sku: item.sku, quantity: item.quantity,
      }))).filter((item) => !alreadyReviewed.has(`${item.orderId}:${item.productId}`));
      setReviews(ownReviews); setEligible(candidates); setIncompleteOrderCount(inaccessible);
    } catch (requestError) { setError(requestError.message || 'Không thể tải đánh giá hoặc đơn hàng đã giao.'); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- Starts an async fetch; loading updates accompany the request.
  useEffect(() => { void load(); }, [load]);

  return <section className="support-page">
    <header className="support-intro"><p className="support-eyebrow">TÀI KHOẢN · ĐÁNH GIÁ ĐÃ XÁC MINH</p><h1>Đánh giá sản phẩm</h1><p>Chỉ sản phẩm trong đơn đã giao của tài khoản này mới đủ điều kiện gửi đánh giá. Đánh giá mới sẽ chờ quản trị viên duyệt.</p></header>
    {loading && <p className="support-state" role="status">Đang tải đơn hàng và đánh giá…</p>}
    {error && !loading && <div className="support-feedback support-feedback--error" role="alert"><p>{error}</p><button className="support-button support-button--quiet" type="button" onClick={load}>Thử lại</button></div>}
    {!loading && !error && <>
      {incompleteOrderCount > 0 && <p className="support-feedback" role="status">Một số đơn không thể tải thông tin chi tiết lúc này. Vui lòng thử làm mới trước khi gửi đánh giá.</p>}
      <section className="support-section"><div className="support-section__heading"><div><p className="support-eyebrow">ĐỦ ĐIỀU KIỆN</p><h2>Sản phẩm đã nhận</h2></div><button className="support-button support-button--quiet" type="button" onClick={load}>Làm mới</button></div>
        {eligible.length === 0 && <div className="support-empty"><strong>Chưa có sản phẩm chờ đánh giá</strong><p>Đơn hàng đã giao sẽ xuất hiện tại đây sau khi thông tin được tải.</p><Link className="support-link" to="/tai-khoan/don-hang">Xem đơn hàng của bạn</Link></div>}
        <div className="support-review-grid">{eligible.map((item) => <EligibleReview key={`${item.orderId}:${item.productId}`} item={item} onSaved={load} />)}</div>
      </section>
      <section className="support-section"><div className="support-section__heading"><div><p className="support-eyebrow">LỊCH SỬ</p><h2>Đánh giá đã gửi</h2></div></div>
        {reviews.length === 0 && <p className="support-empty">Bạn chưa gửi đánh giá nào.</p>}
        <div className="support-review-grid">{reviews.map((review) => <OwnReview key={review.id} review={review} onSaved={load} />)}</div>
      </section>
    </>}
  </section>;
}

export function PublicProductReviews({ productId }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(Boolean(productId));
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!productId) {
      setReviews([]); setError(''); setLoading(false);
      return;
    }
    setLoading(true); setError('');
    try { const response = await supportApi.listPublicReviews(productId, { page: 1, limit: 20 }); setReviews(response.data || []); }
    catch (requestError) { setError(requestError.message || 'Không thể tải đánh giá công khai.'); }
    finally { setLoading(false); }
  }, [productId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Starts an async fetch; loading updates accompany the request.
  useEffect(() => { void load(); }, [load]);
  return <section className="support-public-reviews" aria-labelledby="public-reviews-title">
    <div className="support-section__heading"><div><p className="support-eyebrow">TỪ KHÁCH HÀNG ĐÃ MUA</p><h2 id="public-reviews-title">Đánh giá sản phẩm</h2></div></div>
    {loading && <p role="status">Đang tải đánh giá…</p>}
    {error && <div className="support-feedback support-feedback--error" role="alert"><p>{error}</p><button className="support-link-button" type="button" onClick={load}>Thử lại</button></div>}
    {!loading && !error && reviews.length === 0 && <p className="support-empty"><Icon name="message" size={24} />Chưa có đánh giá được công bố.</p>}
    <div className="support-review-grid">{reviews.map((review) => <article className="support-card support-public-review" key={review.id}>
      <p className="support-review-stars" aria-label={`${review.rating} trên 5 sao`}>{'★'.repeat(review.rating)}<span>{'★'.repeat(5 - review.rating)}</span></p>
      <p>{review.comment || 'Khách hàng đã gửi đánh giá cho sản phẩm này.'}</p>
      {review.images?.length > 0 && <div className="support-review-images">{review.images.map((image) => <img key={image.url} src={image.url} alt="Hình ảnh sản phẩm do khách gửi" loading="lazy" />)}</div>}
      <time dateTime={review.createdAt}>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(review.createdAt))}</time>
    </article>)}</div>
  </section>;
}
