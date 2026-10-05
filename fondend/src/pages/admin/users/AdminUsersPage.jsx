import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { identityApi } from '../../../services/identity/identity.api.js';
import './identity-admin.css';

function errorMessage(error) { return error?.message || 'Không thể tải danh sách người dùng.'; }

export default function AdminUsersPage() {
  const [filters, setFilters] = useState({ q: '', role: '', status: '' });
  const [submitted, setSubmitted] = useState({ q: '', role: '', status: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invite, setInvite] = useState({ name: '', email: '', role: 'customer' });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteError, setInviteError] = useState(null);

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (submitted.q.trim()) query.set('q', submitted.q.trim());
    if (submitted.role) query.set('role', submitted.role);
    if (submitted.status) query.set('status', submitted.status);
    try {
      const response = await identityApi.listUsers(`?${query.toString()}`);
      setData(response.data);
      setPagination(response.meta.pagination);
      setError(null);
    } catch (requestError) { setError(requestError); }
    finally { setLoading(false); }
  }, [page, submitted]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function submitInvite(event) {
    event.preventDefault(); setInviteBusy(true); setInviteError(null); setInviteMessage('');
    try {
      const response = await identityApi.inviteUser(invite);
      setInviteMessage(`Lời mời đã được xếp hàng cho ${response.data.user.email}. Trạng thái “xếp hàng” không xác nhận thư đã vào hộp thư.`);
      setInvite({ name: '', email: '', role: 'customer' });
      await load();
    } catch (requestError) { setInviteError(requestError); }
    finally { setInviteBusy(false); }
  }

  return <section className="identity-admin">
    <header className="identity-admin__header"><div><p className="identity-eyebrow">QUẢN TRỊ</p><h1>Người dùng</h1><p>Quản lý vai trò, trạng thái tài khoản và lời mời.</p></div></header>
    <section className="identity-admin__panel"><h2>Mời người dùng</h2>
      <form className="identity-admin__invite" onSubmit={submitInvite}>
        <label>Tên<input value={invite.name} onChange={(event) => setInvite({ ...invite, name: event.target.value })} required maxLength={120} autoComplete="name" /></label>
        <label>Email<input type="email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} required maxLength={254} autoComplete="email" /></label>
        <label>Vai trò<select value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value })}><option value="customer">Khách hàng</option><option value="staff">Nhân viên</option></select></label>
        <button className="identity-admin__primary" type="submit" disabled={inviteBusy}>{inviteBusy ? 'Đang xếp lời mời…' : 'Tạo lời mời'}</button>
      </form>
      {inviteError && <p role="alert" className="identity-admin__error">{errorMessage(inviteError)}</p>}
      {inviteMessage && <p role="status" className="identity-admin__success">{inviteMessage}</p>}
    </section>

    <section className="identity-admin__panel"><h2>Danh sách tài khoản</h2>
      <form className="identity-admin__filters" onSubmit={(event) => {
        event.preventDefault(); setLoading(true); setError(null);
        if (page === 1 && submitted.q === filters.q && submitted.role === filters.role && submitted.status === filters.status) { void load(); return; }
        setPage(1); setSubmitted(filters);
      }}>
        <label htmlFor="admin-users-search">Tìm tên hoặc email</label><input id="admin-users-search" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} maxLength={120} />
        <label htmlFor="admin-users-role">Vai trò</label><select id="admin-users-role" value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}><option value="">Tất cả</option><option value="customer">Khách hàng</option><option value="staff">Nhân viên</option><option value="admin">Quản trị viên</option></select>
        <label htmlFor="admin-users-status">Trạng thái</label><select id="admin-users-status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Tất cả</option><option value="active">Đang hoạt động</option><option value="blocked">Đang khóa</option></select>
        <button className="identity-admin__secondary" type="submit">Lọc</button>
      </form>
      {loading && <p role="status" className="identity-admin__state">Đang tải người dùng…</p>}
      {error && !loading && <div className="identity-admin__state"><p role="alert" className="identity-admin__error">{errorMessage(error)}</p><button type="button" className="identity-admin__secondary" onClick={() => { setLoading(true); setError(null); void load(); }}>Thử lại</button></div>}
      {!loading && !error && data.length === 0 && <p className="identity-admin__state">Chưa có tài khoản phù hợp.</p>}
      {!loading && !error && data.length > 0 && <>
        <div className="identity-admin__table-wrap"><table><caption>{pagination?.total ?? data.length} tài khoản</caption><thead><tr><th scope="col">Tên</th><th scope="col">Email</th><th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col"><span className="identity-visually-hidden">Chi tiết</span></th></tr></thead>
          <tbody>{data.map((user) => <tr key={user.id}><td data-label="Tên">{user.name}</td><td data-label="Email">{user.email}</td><td data-label="Vai trò">{user.role}</td><td data-label="Trạng thái"><span className={`identity-admin__badge identity-admin__badge--${user.status}`}>{user.status === 'active' ? 'Đang hoạt động' : 'Đang khóa'}</span></td><td data-label="Chi tiết"><Link to={`/admin/users/${user.id}`}>Mở tài khoản</Link></td></tr>)}</tbody>
        </table></div>
        {pagination && pagination.totalPages > 1 && <nav className="identity-admin__pagination" aria-label="Phân trang người dùng"><button type="button" className="identity-admin__secondary" disabled={page <= 1} onClick={() => { setLoading(true); setError(null); setPage((value) => value - 1); }}>Trang trước</button><span>Trang {page} / {pagination.totalPages}</span><button type="button" className="identity-admin__secondary" disabled={page >= pagination.totalPages} onClick={() => { setLoading(true); setError(null); setPage((value) => value + 1); }}>Trang sau</button></nav>}
      </>}
    </section>
  </section>;
}
