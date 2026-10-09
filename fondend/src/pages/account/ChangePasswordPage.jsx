import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import { identityApi } from '../../services/identity/identity.api.js';
import { useIdentityRequest } from '../../hooks/identity/useIdentityRequest.js';
import '../identity/identity.css';

export default function ChangePasswordPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState('');
  const request = useIdentityRequest();

  async function submit(event) {
    event.preventDefault();
    setSuccess('');
    request.setError(null);
    if (newPassword !== confirmPassword) {
      request.setError(new Error('Mật khẩu xác nhận chưa khớp.'));
      return;
    }
    try {
      await request.run(() => identityApi.changePassword({ currentPassword, newPassword }));
      setUser(null);
      setSuccess('Mật khẩu đã được đổi. Hãy đăng nhập lại bằng mật khẩu mới.');
      navigate('/dang-nhap', { replace: true, state: { message: 'Mật khẩu đã được đổi. Hãy đăng nhập lại.' } });
    } catch { /* The request hook retains the error for the form. */ }
  }

  return <section className="identity-page identity-page--wide"><div className="identity-card">
    <p className="identity-eyebrow">TÀI KHOẢN</p><h1>Đổi mật khẩu</h1>
    <p className="identity-description">Mật khẩu mới cần có từ 12 đến 128 ký tự. Sau khi đổi, các phiên đăng nhập hiện có sẽ bị kết thúc.</p>
    <form className="identity-form" onSubmit={submit}>
      <label className="identity-field" htmlFor="current-password"><span>Mật khẩu hiện tại</span><input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required maxLength={128} /></label>
      <label className="identity-field" htmlFor="new-password"><span>Mật khẩu mới</span><input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={12} maxLength={128} /></label>
      <label className="identity-field" htmlFor="confirm-password"><span>Nhập lại mật khẩu mới</span><input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} maxLength={128} /></label>
      {request.error && <p className="identity-feedback identity-feedback--error" role="alert">{request.error.message}</p>}
      {success && <p className="identity-feedback identity-feedback--success" role="status">{success}</p>}
      <button className="identity-primary" disabled={request.pending}>{request.pending ? 'Đang cập nhật…' : 'Đổi mật khẩu'}</button>
    </form>
  </div></section>;
}
