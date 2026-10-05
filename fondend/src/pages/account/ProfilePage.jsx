import { useState } from 'react';
import { identityApi } from '../../services/identity/identity.api.js';
import { useAuth } from '../../contexts/auth.context.js';
import { useIdentityRequest } from '../../hooks/identity/useIdentityRequest.js';
import '../identity/identity.css';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [success, setSuccess] = useState('');
  const { pending, error, setError, run } = useIdentityRequest();
  async function submit(event) {
    event.preventDefault(); setSuccess(''); setError(null);
    try {
      const response = await run(() => identityApi.updateProfile({ name, phone }));
      setUser(response.data);
      setSuccess('Thông tin hồ sơ đã được lưu.');
    } catch { /* The request hook retains the error for the form. */ }
  }
  return <section className="identity-page identity-page--wide"><div className="identity-card">
    <p className="identity-eyebrow">TÀI KHOẢN</p><h1>Hồ sơ của tôi</h1><p className="identity-description">Email đã xác minh: <strong>{user?.email}</strong></p>
    <form className="identity-form" onSubmit={submit}>
      <label className="identity-field" htmlFor="profile-name"><span>Họ và tên</span><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required maxLength={120} /></label>
      <label className="identity-field" htmlFor="profile-phone"><span>Số điện thoại</span><input id="profile-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" maxLength={30} /></label>
      {error && <p className="identity-feedback identity-feedback--error" role="alert">{error.message}</p>}
      {success && <p className="identity-feedback identity-feedback--success" role="status">{success}</p>}
      <button className="identity-primary" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
    </form>
  </div></section>;
}
