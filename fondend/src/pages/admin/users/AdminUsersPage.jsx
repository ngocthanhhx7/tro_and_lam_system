import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { identityApi } from '../../../services/identity/identity.api.js';
import './identity-admin.css';

function errorMessage(error) { return error?.message || 'Không thể tải danh sách người dùng.'; }

const ROLE_LABELS = Object.freeze({ customer: 'Khách hàng', staff: 'Nhân viên', admin: 'Quản trị viên' });

export default function AdminUsersPage({ initialRole = 'customer' }) {
  const employees = initialRole === 'staff';
  const [filters, setFilters] = useState({ q: '', role: initialRole, status: '' });
  const [submitted, setSubmitted] = useState({ q: '', role: initialRole, status: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: '', email: '', role: initialRole });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteError, setInviteError] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const closeRef = useRef(null);
  const returnFocusRef = useRef(null);

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

  const openQuickView = useCallback(async (user, trigger) => {
    returnFocusRef.current = trigger;
    setSelectedId(user.id);
    setSelectedUser(null);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await identityApi.getUser(user.id);
      setSelectedUser(response.data);
    } catch (requestError) { setDetailError(requestError); }
    finally { setDetailLoading(false); }
  }, []);

  const closeQuickView = useCallback(() => {
    setSelectedId('');
    setSelectedUser(null);
    setDetailError(null);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!selectedId) return undefined;
    closeRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape') closeQuickView();
      if (event.key !== 'Tab') return;
      const panel = document.querySelector('[data-quick-view]');
      const focusable = panel?.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedId, closeQuickView]);

  async function submitInvite(event) {
    event.preventDefault(); setInviteBusy(true); setInviteError(null); setInviteMessage('');
    try {
      const response = await identityApi.inviteUser(invite);
      setInviteMessage(`Lời mời đã được xếp hàng cho ${response.data.user.email}. Trạng thái “xếp hàng” không xác nhận thư đã vào hộp thư.`);
      setInvite({ name: '', email: '', role: initialRole });
      setInviteOpen(false);
      await load();
    } catch (requestError) { setInviteError(requestError); }
    finally { setInviteBusy(false); }
  }

  const displayedStatus = (status) => status === 'active' ? 'Đang hoạt động' : 'Đang khóa';

  return <section className="identity-admin identity-admin--customers">
    <header className="identity-admin__header identity-admin__customers-header">
      <div><p className="identity-eyebrow">TRO &amp; LAM · QUẢN TRỊ</p><h1>{employees ? 'Quản lý tài khoản nhân viên' : 'Quản lý tài khoản khách hàng'}</h1><p>Tra cứu hồ sơ, quản lý trạng thái và hỗ trợ quyền truy cập.</p></div>
      <button className="identity-admin__primary" type="button" onClick={() => { setInviteOpen((value) => !value); setInviteError(null); }}>＋ {employees ? 'Thêm nhân viên' : 'Mời khách hàng'}</button>
    </header>
    {inviteMessage && <p role="status" className="identity-admin__success">{inviteMessage}</p>}
    {inviteOpen && <section className="identity-admin__panel identity-admin__invite-panel" aria-labelledby="admin-invite-title">
      <div className="identity-admin__section-heading"><div><h2 id="admin-invite-title">Mời tài khoản</h2><p>Lời mời sẽ được gửi qua email để người nhận tự kích hoạt và tạo mật khẩu.</p></div><button className="identity-admin__text-button" type="button" onClick={() => setInviteOpen(false)}>Đóng</button></div>
      <form className="identity-admin__invite" onSubmit={submitInvite}>
        <label>Tên<input value={invite.name} onChange={(event) => setInvite({ ...invite, name: event.target.value })} required maxLength={120} autoComplete="name" /></label>
        <label>Email<input type="email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} required maxLength={254} autoComplete="email" /></label>
        <label>Vai trò<select value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value })}><option value="customer">Khách hàng</option><option value="staff">Nhân viên</option></select></label>
        <button className="identity-admin__primary" type="submit" disabled={inviteBusy}>{inviteBusy ? 'Đang xếp lời mời…' : 'Gửi lời mời'}</button>
      </form>
      {inviteError && <p role="alert" className="identity-admin__error">{errorMessage(inviteError)}</p>}
    </section>}

    <section className="identity-admin__panel identity-admin__customer-list"><div className="identity-admin__section-heading"><div><h2>Danh sách tài khoản</h2><p>Thông tin dưới đây lấy từ hồ sơ tài khoản hiện có.</p></div>{pagination && <span className="identity-admin__count">{pagination.total} tài khoản</span>}</div>
      <form className="identity-admin__filters identity-admin__customer-filters" onSubmit={(event) => {
        event.preventDefault(); setLoading(true); setError(null);
        if (page === 1 && submitted.q === filters.q && submitted.role === filters.role && submitted.status === filters.status) { void load(); return; }
        setPage(1); setSubmitted(filters);
      }}>
        <label className="identity-admin__search-label" htmlFor="admin-users-search">Tìm khách hàng<input id="admin-users-search" type="search" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} maxLength={120} placeholder="Tên hoặc email" /></label>
        <label htmlFor="admin-users-role">Vai trò<select id="admin-users-role" value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}><option value="">Tất cả</option><option value="customer">Khách hàng</option><option value="staff">Nhân viên</option><option value="admin">Quản trị viên</option></select></label>
        <label htmlFor="admin-users-status">Trạng thái<select id="admin-users-status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Tất cả</option><option value="active">Đang hoạt động</option><option value="blocked">Đang khóa</option></select></label>
        <button className="identity-admin__secondary" type="submit">Lọc kết quả</button>
      </form>
      {loading && <p role="status" className="identity-admin__state">Đang tải tài khoản…</p>}
      {error && !loading && <div className="identity-admin__state"><p role="alert" className="identity-admin__error">{errorMessage(error)}</p><button type="button" className="identity-admin__secondary" onClick={() => { setLoading(true); setError(null); void load(); }}>Thử lại</button></div>}
      {!loading && !error && data.length === 0 && <p className="identity-admin__state">Chưa có tài khoản phù hợp.</p>}
      {!loading && !error && data.length > 0 && <>
        <div className="identity-admin__table-wrap"><table><caption className="identity-visually-hidden">Danh sách tài khoản khách hàng, nhân viên và quản trị viên</caption><thead><tr><th scope="col">Tài khoản</th><th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col">Ngày tham gia</th><th scope="col"><span className="identity-visually-hidden">Hồ sơ</span></th></tr></thead>
          <tbody>{data.map((user) => <tr key={user.id}><td data-label="Tài khoản"><span className="identity-admin__customer-name">{user.name}</span><small>{user.email}</small></td><td data-label="Vai trò"><span className="identity-admin__role">{ROLE_LABELS[user.role] || user.role}</span></td><td data-label="Trạng thái"><span className={`identity-admin__badge identity-admin__badge--${user.status}`}>{displayedStatus(user.status)}</span></td><td data-label="Ngày tham gia">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : '—'}</td><td data-label="Hồ sơ"><button type="button" className="identity-admin__text-button" onClick={(event) => void openQuickView(user, event.currentTarget)}>Xem nhanh</button></td></tr>)}</tbody>
        </table></div>
        {pagination && pagination.totalPages > 1 && <nav className="identity-admin__pagination" aria-label="Phân trang người dùng"><button type="button" className="identity-admin__secondary" disabled={page <= 1} onClick={() => { setLoading(true); setError(null); setPage((value) => value - 1); }}>Trang trước</button><span>Trang {page} / {pagination.totalPages}</span><button type="button" className="identity-admin__secondary" disabled={page >= pagination.totalPages} onClick={() => { setLoading(true); setError(null); setPage((value) => value + 1); }}>Trang sau</button></nav>}
      </>}
    </section>
    {selectedId && <div className="identity-admin__quick-view-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeQuickView(); }}>
      <aside className="identity-admin__quick-view" role="dialog" aria-modal="true" aria-labelledby="quick-view-title" data-quick-view>
        <header className="identity-admin__quick-view-header"><div><p className="identity-eyebrow">HỒ SƠ TÀI KHOẢN</p><h2 id="quick-view-title">{selectedUser?.name || 'Thông tin khách hàng'}</h2></div><button ref={closeRef} className="identity-admin__icon-button" type="button" aria-label="Đóng hồ sơ nhanh" onClick={closeQuickView}>×</button></header>
        {detailLoading && <p className="identity-admin__state" role="status">Đang tải hồ sơ…</p>}
        {detailError && <div><p role="alert" className="identity-admin__error">{errorMessage(detailError)}</p><button className="identity-admin__secondary" type="button" onClick={() => { const row = data.find((item) => item.id === selectedId); if (row) void openQuickView(row, returnFocusRef.current); }}>Thử lại</button></div>}
        {selectedUser && <>
          <p className="identity-admin__quick-view-email">{selectedUser.email}</p>
          <div className="identity-admin__quick-view-status"><span className={`identity-admin__badge identity-admin__badge--${selectedUser.status}`}>{displayedStatus(selectedUser.status)}</span><span className="identity-admin__role">{ROLE_LABELS[selectedUser.role] || selectedUser.role}</span></div>
          <dl className="identity-admin__facts">
            <div><dt>Điện thoại</dt><dd>{selectedUser.phone || 'Chưa có thông tin'}</dd></div>
            <div><dt>Email xác minh</dt><dd>{selectedUser.emailVerifiedAt ? 'Đã xác minh' : 'Chưa xác minh'}</dd></div>
            <div><dt>Tạo tài khoản</dt><dd>{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString('vi-VN') : 'Chưa có dữ liệu'}</dd></div>
            {selectedUser.blockedReason && <div><dt>Lý do khóa</dt><dd>{selectedUser.blockedReason}</dd></div>}
          </dl>
          <p className="identity-admin__quick-view-note">Hạng khách hàng, ghi chú nội bộ và tổng chi tiêu chưa được cấu hình.</p>
          <footer className="identity-admin__quick-view-actions"><Link className="identity-admin__primary" to={`/admin/users/${selectedUser.id}`}>Mở hồ sơ đầy đủ</Link><button type="button" className="identity-admin__secondary" onClick={closeQuickView}>Đóng</button></footer>
        </>}
      </aside>
    </div>}
  </section>;
}
