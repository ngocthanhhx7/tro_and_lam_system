import { useCallback, useEffect, useState } from 'react';
import { operationsApi } from '../../../services/operations/operationsApi.js';
import '../../../components/notifications/operations.css';

function dateTime(date, end = false) {
  if (!date) return undefined;
  return new Date(`${date}T${end ? '23:59:59.999' : '00:00:00'}+07:00`).toISOString();
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : '—';
}

export default function AdminAuditPage() {
  const [form, setForm] = useState({ action: '', actorId: '', targetType: '', targetId: '', from: '', to: '' });
  const [applied, setApplied] = useState(form);
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async ({ append = false, nextCursor } = {}) => {
    setLoading(true);
    setError('');
    const filters = {
      action: applied.action,
      actorId: applied.actorId,
      targetType: applied.targetType,
      targetId: applied.targetId,
      from: dateTime(applied.from),
      to: dateTime(applied.to, true),
      limit: 20,
      cursor: nextCursor,
    };
    try {
      const response = await operationsApi.listAuditLogs(filters);
      setItems((current) => append ? [...current, ...response.data] : response.data);
      setCursor(response.meta.nextCursor || null);
    } catch (requestError) {
      setError(requestError.message || 'Không tải được nhật ký audit.');
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    setApplied({ ...form });
  }

  return (
    <section className="operations-page">
      <header className="operations-page__heading">
        <div><p className="operations-eyebrow">Quản trị · Chỉ đọc</p><h1>Nhật ký audit</h1><p>Nhật ký chỉ thêm mới; dữ liệu nhạy cảm được che trước khi lưu và khi trả về.</p></div>
      </header>
      <form className="operations-filters" onSubmit={applyFilters}>
        <label>Hành động <input value={form.action} onChange={(event) => update('action', event.target.value)} maxLength={100} /></label>
        <label>Actor ID <input value={form.actorId} onChange={(event) => update('actorId', event.target.value)} maxLength={120} /></label>
        <label>Loại đối tượng <input value={form.targetType} onChange={(event) => update('targetType', event.target.value)} maxLength={80} /></label>
        <label>Đối tượng ID <input value={form.targetId} onChange={(event) => update('targetId', event.target.value)} maxLength={120} /></label>
        <label>Từ ngày <input type="date" value={form.from} max={form.to || undefined} onChange={(event) => update('from', event.target.value)} /></label>
        <label>Đến ngày <input type="date" value={form.to} min={form.from || undefined} onChange={(event) => update('to', event.target.value)} /></label>
        <button className="operations-button" type="submit" disabled={loading}>Lọc nhật ký</button>
      </form>
      {loading && <p role="status">Đang tải nhật ký…</p>}
      {error && <div className="operations-error" role="alert"><p>{error}</p><button type="button" onClick={() => load()}>Thử lại</button></div>}
      {!loading && !error && items.length === 0 && <p className="operations-empty">Không có sự kiện phù hợp bộ lọc.</p>}
      {items.length > 0 && <div className="operations-table-wrap"><table className="operations-table">
        <thead><tr><th scope="col">Thời gian</th><th scope="col">Actor</th><th scope="col">Hành động</th><th scope="col">Đối tượng</th><th scope="col">Kết quả</th><th scope="col">Chi tiết đã che</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}>
          <td><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></td>
          <td><code>{item.actorId || 'system'}</code><small>{item.actorRole || ''}</small></td>
          <td><code>{item.action}</code></td>
          <td>{item.targetType}<small>{item.targetId || ''}</small></td>
          <td>{item.outcome}</td>
          <td><details><summary>Xem tóm tắt</summary><pre>{JSON.stringify({ reasonCode: item.reasonCode, changesRedacted: item.changesRedacted, requestId: item.requestId }, null, 2)}</pre></details></td>
        </tr>)}</tbody>
      </table></div>}
      {cursor && <div className="operations-pagination"><button type="button" className="operations-button operations-button--quiet" disabled={loading} onClick={() => load({ append: true, nextCursor: cursor })}>Tải thêm nhật ký</button></div>}
    </section>
  );
}
