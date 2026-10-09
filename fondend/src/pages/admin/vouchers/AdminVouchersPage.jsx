import { useCallback, useEffect, useState } from 'react';
import { voucherApi } from '../../../services/commerce/voucher.api.js';
import { formatMoney } from '../../commerce/commerce.format.js';
import Icon from '../../../components/catalog/Icon.jsx';
import { WorkspaceMetric } from '../../../components/workspace/WorkspaceParts.jsx';
import '../../../components/notifications/operations.css';

const blankForm = () => ({ email: '', code: '', title: '', discountType: 'fixed', discountValue: '', maxDiscountVnd: '', minSubtotalVnd: '', expiresAt: '' });
const money = (value) => `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;

function discountLabel(voucher) {
  return voucher.discountType === 'percent'
    ? `${voucher.discountValue}%${voucher.maxDiscountVnd ? ` · tối đa ${money(voucher.maxDiscountVnd)}` : ''}`
    : money(voucher.discountValue);
}

export default function AdminVouchersPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await voucherApi.listAdmin();
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError.message || 'Không thể tải danh sách voucher.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  async function issue(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = {
        email: form.email,
        code: form.code,
        title: form.title,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        ...(form.discountType === 'percent' && form.maxDiscountVnd ? { maxDiscountVnd: Number(form.maxDiscountVnd) } : {}),
        minSubtotalVnd: Number(form.minSubtotalVnd || 0),
        expiresAt: new Date(form.expiresAt).toISOString(),
      };
      await voucherApi.issue(body);
      setForm(blankForm());
      setNotice('Voucher đã được cấp cho customer.');
      setFormOpen(false);
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Không thể cấp voucher.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(voucher) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await voucherApi.revoke(voucher.id);
      setNotice(`Đã thu hồi voucher ${voucher.code}.`);
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Không thể thu hồi voucher.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="operations-page">
    <header className="operations-page__heading"><div><p className="operations-eyebrow">TRO &amp; LAM · ƯU ĐÃI</p><h1>Quản lý mã Voucher</h1><p>Quản lý ưu đãi dành cho khách hàng và theo dõi trạng thái sử dụng.</p></div><button className="operations-button" type="button" onClick={() => setFormOpen(!formOpen)}><Icon name={formOpen ? 'close' : 'plus'} size={16} />{formOpen ? 'Đóng biểu mẫu' : 'Cấp voucher mới'}</button></header>
    {!loading && <div className="operations-metrics"><WorkspaceMetric label="Tổng voucher" icon="ticket" value={items.length} detail="Trong danh sách đã tải" /><WorkspaceMetric label="Khả dụng" icon="gift" value={items.filter((item) => item.status === 'available').length} detail="Có thể áp dụng cho đơn hàng" /><WorkspaceMetric label="Đã sử dụng" icon="receipt" value={items.filter((item) => item.status === 'used').length} detail="Voucher đã được áp dụng" /><WorkspaceMetric label="Đã thu hồi / hết hạn" icon="history" value={items.filter((item) => ['revoked', 'expired'].includes(item.status)).length} detail="Không còn khả dụng" /></div>}
    {error && <div className="operations-error" role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>Tải lại</button></div>}
    {notice && <p className="identity-feedback identity-feedback--success" role="status">{notice}</p>}
    {formOpen && <form className="operations-form" onSubmit={issue}>
      <h2>Cấp voucher</h2>
      <label>Email khách hàng<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required maxLength={254} autoComplete="email" /></label>
      <div className="operations-form__row">
        <label>Mã voucher<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/gu, '').slice(0, 40) })} required minLength={3} maxLength={40} /></label>
        <label>Tên ưu đãi<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required maxLength={120} /></label>
      </div>
      <div className="operations-form__row">
        <label>Loại giảm giá<select value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value })}><option value="fixed">Số tiền cố định</option><option value="percent">Phần trăm</option></select></label>
        <label>{form.discountType === 'percent' ? 'Phần trăm giảm' : 'Số tiền giảm (VND)'}<input type="number" min="1" max={form.discountType === 'percent' ? '100' : undefined} step="1" value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} required /></label>
        {form.discountType === 'percent' && <label>Giảm tối đa (VND, không bắt buộc)<input type="number" min="1" step="1" value={form.maxDiscountVnd} onChange={(event) => setForm({ ...form, maxDiscountVnd: event.target.value })} /></label>}
      </div>
      <div className="operations-form__row">
        <label>Đơn tối thiểu (VND)<input type="number" min="0" step="1" value={form.minSubtotalVnd} onChange={(event) => setForm({ ...form, minSubtotalVnd: event.target.value })} /></label>
        <label>Hạn dùng<input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} required /></label>
      </div>
      <p className="operations-note">Giảm giá áp dụng trên tiền hàng; phí giao hàng không đổi. Mỗi voucher dùng một lần. Voucher được trả lại nếu đơn bị hủy trước khi giao.</p>
      <button className="operations-button" disabled={busy}>{busy ? 'Đang xử lý…' : 'Cấp voucher'}</button>
    </form>}
    <div className="operations-toolbar"><label>Tìm voucher<input type="search" placeholder="Mã, tên ưu đãi hoặc email" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label>Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tất cả</option><option value="available">Khả dụng</option><option value="used">Đã sử dụng</option><option value="reserved">Đang giữ</option><option value="revoked">Đã thu hồi</option><option value="expired">Hết hạn</option></select></label><button className="operations-button operations-button--quiet" type="button" onClick={() => void load()} disabled={loading}>Làm mới</button></div>
    {loading && <p role="status">Đang tải…</p>}
    {!loading && items.length === 0 && <p className="operations-empty">Chưa có voucher nào được cấp.</p>}
    {!loading && items.length > 0 && <div className="operations-table-wrap"><table className="operations-table"><thead><tr><th>Mã Voucher</th><th>Khách hàng</th><th>Mức giảm</th><th>Hạn dùng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
      <tbody>{items.filter((item) => (!status || item.status === status) && `${item.code} ${item.title} ${item.customer?.email || ''}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))).map((voucher) => <tr key={voucher.id}><td data-label="Mã"><strong>{voucher.code}</strong><small>{voucher.title}</small></td><td data-label="Khách hàng">{voucher.customer?.email || '—'}</td><td data-label="Mức giảm">{discountLabel(voucher)}{voucher.minSubtotalVnd > 0 && <small>Đơn từ {formatMoney(voucher.minSubtotalVnd)}</small>}</td><td data-label="Hạn dùng">{new Date(voucher.expiresAt).toLocaleString('vi-VN')}</td><td data-label="Trạng thái"><span className="workspace-badge">{({ available: 'Khả dụng', used: 'Đã sử dụng', reserved: 'Đang giữ', revoked: 'Đã thu hồi', expired: 'Hết hạn' })[voucher.status] || voucher.status}</span></td><td data-label="Thao tác">{voucher.status === 'available' && <button className="operations-button operations-button--quiet" type="button" disabled={busy} onClick={() => void revoke(voucher)}>Thu hồi</button>}</td></tr>)}</tbody>
    </table></div>}
  </section>;
}
