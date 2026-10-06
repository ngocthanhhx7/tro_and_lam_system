import { useCallback, useEffect, useState } from 'react';
import { paymentsApi } from '../../../services/payments/payments.api.js';
import '../../../components/payment/payment.css';

const STATUSES = ['', 'requested', 'approved', 'rejected', 'processing', 'completed', 'failed'];
const STATUS_LABELS = {
  requested: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Đã từ chối',
  processing: 'Đang xử lý', completed: 'Đã ghi nhận hoàn', failed: 'Thất bại',
};

function money(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
}

function RefundRow({ refund, onChanged }) {
  const [reason, setReason] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function decide(decision) {
    setBusy(true);
    setError('');
    try {
      await paymentsApi.decideRefund(refund.id, { decision, reason, expectedVersion: refund.version });
      await onChanged();
    } catch (requestError) {
      setError(requestError.message || 'Không thể cập nhật yêu cầu.');
    } finally { setBusy(false); }
  }

  async function complete(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await paymentsApi.completeRefund(refund.id, {
        externalReference, evidenceReference, expectedVersion: refund.version,
      });
      await onChanged();
    } catch (requestError) {
      setError(requestError.message || 'Không thể ghi nhận bằng chứng hoàn tiền.');
    } finally { setBusy(false); }
  }

  return <article className="refund-row">
    <div className="refund-summary">
      <div><span className="refund-label">Mã đơn</span><code>{refund.orderId}</code></div>
      <div><span className="refund-label">Số tiền</span><strong>{money(refund.amountVnd)}</strong></div>
      <div><span className="refund-label">Trạng thái</span><span className={`refund-status refund-status--${refund.status}`}>{STATUS_LABELS[refund.status] || refund.status}</span></div>
      <div><span className="refund-label">Lý do</span><span>{refund.reason}</span></div>
    </div>
    {refund.status === 'requested' && <div className="refund-action">
      <label htmlFor={`reason-${refund.id}`}>Ghi chú quyết định</label>
      <textarea id={`reason-${refund.id}`} value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} />
      <div className="payment-actions">
        <button type="button" className="payment-button" disabled={busy || !reason.trim()} onClick={() => void decide('approved')}>Duyệt yêu cầu</button>
        <button type="button" className="payment-button payment-button--secondary" disabled={busy || !reason.trim()} onClick={() => void decide('rejected')}>Từ chối</button>
      </div>
    </div>}
    {['approved', 'processing'].includes(refund.status) && <form className="refund-action" onSubmit={complete}>
      <p>Đây là hoàn tiền thủ công. Chỉ xác nhận sau khi giao dịch hoàn ngoài hệ thống đã hoàn tất.</p>
      <label htmlFor={`external-${refund.id}`}>Mã giao dịch hoàn</label>
      <input id={`external-${refund.id}`} required maxLength={200} value={externalReference} onChange={(event) => setExternalReference(event.target.value)} />
      <label htmlFor={`evidence-${refund.id}`}>Tham chiếu bằng chứng</label>
      <input id={`evidence-${refund.id}`} required maxLength={500} value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} />
      <button type="submit" className="payment-button" disabled={busy}>Ghi nhận hoàn tất</button>
    </form>}
    {error && <p className="payment-error" role="alert">{error}</p>}
  </article>;
}

export default function AdminRefundsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const response = await paymentsApi.listRefunds({ status, page, limit: 20, signal });
      setData({ items: response.data, pagination: response.meta?.pagination });
      setError('');
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setError(requestError.message || 'Không thể tải danh sách hoàn tiền.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [status, page]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => void load(controller.signal), 0);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [load]);

  return <main className="refunds-page">
    <header className="refunds-heading">
      <div><p className="payment-eyebrow">Quản trị · tài chính</p><h1>Yêu cầu hoàn tiền</h1>
        <p className="payment-copy">Quyết định có audit; hoàn tiền thủ công cần mã giao dịch và tham chiếu bằng chứng.</p></div>
      <label htmlFor="refund-status">Lọc trạng thái
        <select id="refund-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          {STATUSES.map((value) => <option key={value} value={value}>{value ? STATUS_LABELS[value] : 'Tất cả'}</option>)}
        </select>
      </label>
    </header>
    {error && <div className="payment-error" role="alert">{error} <button type="button" onClick={() => void load()}>Thử lại</button></div>}
    {loading && <p role="status">Đang tải yêu cầu hoàn tiền…</p>}
    {!loading && data?.items?.length === 0 && <p className="refunds-empty">Chưa có yêu cầu hoàn tiền ở trạng thái này.</p>}
    <div className="refunds-list">{data?.items?.map((refund) => <RefundRow key={refund.id} refund={refund} onChanged={() => load()} />)}</div>
    {data?.pagination?.totalPages > 1 && <nav className="refund-pagination" aria-label="Phân trang yêu cầu hoàn tiền">
      <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Trang trước</button>
      <span>Trang {page} / {data.pagination.totalPages}</span>
      <button type="button" disabled={page >= data.pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Trang sau</button>
    </nav>}
  </main>;
}
