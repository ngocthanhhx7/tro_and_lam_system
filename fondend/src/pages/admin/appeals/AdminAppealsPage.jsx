import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { identityApi } from '../../../services/identity/identity.api.js';
import '../users/identity-admin.css';

export default function AdminAppealsPage() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) query.set('status', status);
    try {
      const response = await identityApi.listAppeals(`?${query.toString()}`);
      setItems(response.data); setPagination(response.meta.pagination);
      setError(null);
    } catch (requestError) { setError(requestError); }
    finally { setLoading(false); }
  }, [page, status]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  return <section className="identity-admin"><header className="identity-admin__header"><div><p className="identity-eyebrow">QUẢN TRỊ</p><h1>Kháng nghị tài khoản</h1><p>Mọi quyết định đều cần ghi nhận lý do; mở khóa không khôi phục phiên cũ.</p></div></header>
    <section className="identity-admin__panel"><div className="identity-admin__filters"><label htmlFor="appeal-status">Trạng thái</label><select id="appeal-status" value={status} onChange={(event) => { setLoading(true); setError(null); setPage(1); setStatus(event.target.value); }}><option value="pending">Đang chờ</option><option value="approved">Đã chấp thuận</option><option value="rejected">Đã từ chối</option><option value="">Tất cả</option></select></div>
      {loading && <p className="identity-admin__state" role="status">Đang tải kháng nghị…</p>}
      {error && !loading && <div className="identity-admin__state"><p className="identity-admin__error" role="alert">{error.message}</p><button className="identity-admin__secondary" type="button" onClick={() => { setLoading(true); setError(null); void load(); }}>Thử lại</button></div>}
      {!loading && !error && items.length === 0 && <p className="identity-admin__state">Không có kháng nghị ở trạng thái này.</p>}
      {!loading && !error && items.length > 0 && <>
        <div className="identity-admin__table-wrap"><table><caption>{pagination?.total ?? items.length} kháng nghị</caption><thead><tr><th scope="col">Tài khoản</th><th scope="col">Lý do khóa</th><th scope="col">Nội dung</th><th scope="col">Gửi lúc</th><th scope="col">Trạng thái</th><th scope="col"><span className="identity-visually-hidden">Chi tiết</span></th></tr></thead>
          <tbody>{items.map((appeal) => <tr key={appeal.id}><td data-label="Tài khoản">{appeal.user?.name}<small>{appeal.user?.email}</small></td><td data-label="Lý do khóa">{appeal.user?.blockedReason || 'Không có ghi chú'}</td><td data-label="Nội dung">{appeal.message}</td><td data-label="Gửi lúc">{appeal.submittedAt ? new Date(appeal.submittedAt).toLocaleString('vi-VN') : '—'}</td><td data-label="Trạng thái">{appeal.status}</td><td data-label="Chi tiết"><Link to={`/admin/appeals/${appeal.id}`} state={{ appeal }}>Xem và xử lý</Link></td></tr>)}</tbody>
        </table></div>
        {pagination && pagination.totalPages > 1 && <nav className="identity-admin__pagination" aria-label="Phân trang kháng nghị"><button className="identity-admin__secondary" disabled={page <= 1} type="button" onClick={() => { setLoading(true); setError(null); setPage((value) => value - 1); }}>Trang trước</button><span>Trang {page} / {pagination.totalPages}</span><button className="identity-admin__secondary" disabled={page >= pagination.totalPages} type="button" onClick={() => { setLoading(true); setError(null); setPage((value) => value + 1); }}>Trang sau</button></nav>}
      </>}
    </section>
  </section>;
}
