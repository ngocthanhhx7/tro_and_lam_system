import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { identityApi } from '../../../services/identity/identity.api.js';
import './identity-admin.css';

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [statusChange, setStatusChange] = useState({ status: 'blocked', reason: '', confirmed: false });
  const [roleChange, setRoleChange] = useState({ role: '', reason: '', confirmed: false });
  const [resetRequest, setResetRequest] = useState({ reason: '', confirmed: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await identityApi.getUser(id);
      setUser(response.data);
      setProfile({ name: response.data.name, phone: response.data.phone || '' });
      setStatusChange((current) => ({ ...current, status: response.data.status === 'active' ? 'blocked' : 'active', confirmed: false }));
      setRoleChange((current) => ({ ...current, role: response.data.role, confirmed: false }));
      setError(null);
    } catch (requestError) { setError(requestError); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function saveProfile(event) {
    event.preventDefault(); setBusy('profile'); setError(null); setSuccess('');
    try {
      const response = await identityApi.updateUser(id, { ...profile, expectedVersion: user.version });
      setUser(response.data); setSuccess('Thông tin người dùng đã được lưu.');
    } catch (requestError) { setError(requestError); }
    finally { setBusy(''); }
  }

  async function saveStatus(event) {
    event.preventDefault(); setBusy('status'); setError(null); setSuccess('');
    try {
      const response = await identityApi.updateUserStatus(id, { status: statusChange.status, reason: statusChange.reason, expectedVersion: user.version });
      setUser(response.data); setSuccess('Trạng thái đã cập nhật; các phiên cũ đã bị thu hồi.');
      setStatusChange((current) => ({ ...current, reason: '', confirmed: false, status: response.data.status === 'active' ? 'blocked' : 'active' }));
    } catch (requestError) { setError(requestError); }
    finally { setBusy(''); }
  }

  async function saveRole(event) {
    event.preventDefault(); setBusy('role'); setError(null); setSuccess('');
    try {
      const response = await identityApi.updateUserRole(id, { role: roleChange.role, reason: roleChange.reason, expectedVersion: user.version });
      setUser(response.data); setSuccess('Vai trò đã cập nhật; các phiên cũ đã bị thu hồi.');
      setRoleChange((current) => ({ ...current, reason: '', confirmed: false }));
    } catch (requestError) { setError(requestError); }
    finally { setBusy(''); }
  }

  async function requestPasswordReset(event) {
    event.preventDefault(); setBusy('reset'); setError(null); setSuccess('');
    try {
      const response = await identityApi.requestAdminPasswordReset(id, { reason: resetRequest.reason });
      setSuccess(response.data?.queued
        ? `Liên kết đặt lại đã được xếp gửi tới email đã xác minh của ${user.email}. Việc xếp hàng không xác nhận thư đã được giao.`
        : `Đã tiếp nhận yêu cầu hỗ trợ cho ${user.email}.`);
      setResetRequest({ reason: '', confirmed: false });
    } catch (requestError) { setError(requestError); }
    finally { setBusy(''); }
  }

  const currentUser = user?.id?.toLowerCase() === id?.toLowerCase() ? user : null;
  if (loading || !currentUser && !error) return <main className="identity-admin__state" role="status">Đang tải tài khoản…</main>;
  if (error && !currentUser) return <main className="identity-admin__state"><p role="alert" className="identity-admin__error">{error.message}</p><button className="identity-admin__secondary" onClick={() => { setLoading(true); setError(null); void load(); }} type="button">Thử lại</button></main>;
  if (!currentUser) return null;

  return <section className="identity-admin"><header className="identity-admin__header"><div><p className="identity-eyebrow">QUẢN TRỊ NGƯỜI DÙNG</p><h1>{user.name}</h1><p>{user.email} · {user.status} · {user.role}</p></div><Link to="/admin/users">Quay lại danh sách</Link></header>
    {error && <p role="alert" className="identity-admin__error">{error.message}</p>}{success && <p role="status" className="identity-admin__success">{success}</p>}
    <section className="identity-admin__panel"><h2>Thông tin được phép chỉnh sửa</h2><p>Không thể xem hoặc đặt mật khẩu. Dùng lời mời hoặc luồng khôi phục để quản lý thông tin đăng nhập.</p>
      <form className="identity-admin__form" onSubmit={saveProfile}>
        <label>Tên<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required maxLength={120} /></label>
        <label>Điện thoại<input type="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} maxLength={30} /></label>
        <button className="identity-admin__primary" disabled={busy !== ''}>{busy === 'profile' ? 'Đang lưu…' : 'Lưu thông tin'}</button>
      </form>
    </section>
    <section className="identity-admin__panel identity-admin__reset-panel"><h2>Hỗ trợ đặt lại mật khẩu</h2>
      <p>Hệ thống chỉ gửi liên kết dùng một lần đến email đã xác minh. Quản trị viên không thể xem hoặc đặt mật khẩu mới.</p>
      {!user.emailVerifiedAt && <p className="identity-admin__notice">Email tài khoản chưa được xác minh; không thể gửi liên kết đặt lại.</p>}
      <form className="identity-admin__form identity-admin__reset-form" onSubmit={requestPasswordReset}>
        <label>Lý do hỗ trợ<textarea value={resetRequest.reason} onChange={(event) => setResetRequest({ ...resetRequest, reason: event.target.value, confirmed: false })} required minLength={1} maxLength={1000} /></label>
        <label className="identity-admin__check"><input type="checkbox" checked={resetRequest.confirmed} onChange={(event) => setResetRequest({ ...resetRequest, confirmed: event.target.checked })} /> Tôi xác nhận gửi liên kết đặt lại tới {user.email}.</label>
        <button className="identity-admin__secondary" type="submit" disabled={busy !== '' || !resetRequest.confirmed || !user.emailVerifiedAt}>{busy === 'reset' ? 'Đang xếp gửi…' : 'Gửi liên kết đặt lại'}</button>
      </form>
    </section>
    <section className="identity-admin__grid">
      <form className="identity-admin__panel identity-admin__form" onSubmit={saveStatus}><h2>Trạng thái</h2>
        <label>Trạng thái mới<select value={statusChange.status} onChange={(event) => setStatusChange({ ...statusChange, status: event.target.value, confirmed: false })}><option value="active">Đang hoạt động</option><option value="blocked">Khóa tài khoản</option></select></label>
        <label>Lý do bắt buộc<textarea value={statusChange.reason} onChange={(event) => setStatusChange({ ...statusChange, reason: event.target.value })} required minLength={1} maxLength={1000} /></label>
        <label className="identity-admin__check"><input type="checkbox" checked={statusChange.confirmed} onChange={(event) => setStatusChange({ ...statusChange, confirmed: event.target.checked })} /> Tôi xác nhận thay đổi này sẽ thu hồi mọi phiên hiện tại.</label>
        <button className="identity-admin__primary" disabled={busy !== '' || !statusChange.confirmed}>{busy === 'status' ? 'Đang cập nhật…' : 'Cập nhật trạng thái'}</button>
      </form>
      <form className="identity-admin__panel identity-admin__form" onSubmit={saveRole}><h2>Vai trò</h2>
        <label>Vai trò mới<select value={roleChange.role} onChange={(event) => setRoleChange({ ...roleChange, role: event.target.value, confirmed: false })}><option value="customer">Khách hàng</option><option value="staff">Nhân viên</option><option value="admin">Quản trị viên</option></select></label>
        <label>Lý do bắt buộc<textarea value={roleChange.reason} onChange={(event) => setRoleChange({ ...roleChange, reason: event.target.value })} required minLength={1} maxLength={1000} /></label>
        <label className="identity-admin__check"><input type="checkbox" checked={roleChange.confirmed} onChange={(event) => setRoleChange({ ...roleChange, confirmed: event.target.checked })} /> Tôi xác nhận vai trò mới sẽ có hiệu lực khi người dùng đăng nhập lại.</label>
        <button className="identity-admin__primary" disabled={busy !== '' || !roleChange.confirmed}>{busy === 'role' ? 'Đang cập nhật…' : 'Cập nhật vai trò'}</button>
      </form>
    </section>
    <p className="identity-admin__footnote">Tài khoản có lịch sử không bị xóa cứng. Chỉ trạng thái và vai trò cho phép được quản lý tại đây.</p>
  </section>;
}
