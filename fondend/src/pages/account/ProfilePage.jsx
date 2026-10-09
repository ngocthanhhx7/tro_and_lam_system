import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { identityApi } from '../../services/identity/identity.api.js';
import { useAuth } from '../../contexts/auth.context.js';
import { useIdentityRequest } from '../../hooks/identity/useIdentityRequest.js';
import '../identity/identity.css';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    birthDate: user?.birthDate || '',
    gender: user?.gender || '',
  });
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const profileRequest = useIdentityRequest();
  const emailRequest = useIdentityRequest();

  async function submitProfile(event) {
    event.preventDefault();
    setProfileSuccess('');
    profileRequest.setError(null);
    const body = {
      name: profile.name,
      phone: profile.phone,
      birthDate: profile.birthDate || null,
      gender: profile.gender || null,
    };
    try {
      const response = await profileRequest.run(() => identityApi.updateProfile(body));
      setUser(response.data);
      setProfileSuccess('Thông tin hồ sơ đã được lưu.');
    } catch { /* The request hook retains the error for the form. */ }
  }

  async function requestEmailVerification(event) {
    event.preventDefault();
    setEmailSuccess('');
    emailRequest.setError(null);
    try {
      const response = await emailRequest.run(() => identityApi.requestEmailChange({ email: newEmail, currentPassword }));
      setChallengeId(response.data.challengeId);
      setVerificationCode('');
      setEmailSuccess(`Mã xác minh đã được gửi tới ${newEmail}. Mã có hiệu lực trong 10 phút.`);
    } catch { /* The request hook retains the error for the form. */ }
  }

  async function verifyEmail(event) {
    event.preventDefault();
    setEmailSuccess('');
    emailRequest.setError(null);
    try {
      const response = await emailRequest.run(() => identityApi.verifyEmailChange({ challengeId, verificationCode }));
      setUser(null);
      setChallengeId('');
      setCurrentPassword('');
      setNewEmail('');
      setVerificationCode('');
      setEmailSuccess('Email đã được đổi. Phiên cũ đã kết thúc; hãy đăng nhập lại bằng email mới.');
      navigate('/dang-nhap', { replace: true, state: { message: `Email đã được đổi thành ${response.data.email}. Hãy đăng nhập lại.` } });
    } catch { /* The request hook retains the error for the form. */ }
  }

  return <section className="identity-page identity-page--wide">
    <div className="identity-card">
      <p className="identity-eyebrow">TÀI KHOẢN</p>
      <h1>Hồ sơ của tôi</h1>
      <p className="identity-description">Email hiện tại: <strong>{user?.email}</strong></p>
      <form className="identity-form" onSubmit={submitProfile}>
        <label className="identity-field" htmlFor="profile-name"><span>Họ và tên</span><input id="profile-name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} autoComplete="name" required maxLength={120} /></label>
        <label className="identity-field" htmlFor="profile-phone"><span>Số điện thoại</span><input id="profile-phone" type="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} autoComplete="tel" maxLength={30} /></label>
        <label className="identity-field" htmlFor="profile-birth-date"><span>Ngày sinh</span><input id="profile-birth-date" type="date" value={profile.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setProfile({ ...profile, birthDate: event.target.value })} /></label>
        <label className="identity-field" htmlFor="profile-gender"><span>Giới tính</span><select id="profile-gender" value={profile.gender} onChange={(event) => setProfile({ ...profile, gender: event.target.value })}>
          <option value="">Chưa cung cấp</option><option value="female">Nữ</option><option value="male">Nam</option><option value="other">Khác</option><option value="prefer_not_to_say">Không muốn tiết lộ</option>
        </select></label>
        {profileRequest.error && <p className="identity-feedback identity-feedback--error" role="alert">{profileRequest.error.message}</p>}
        {profileSuccess && <p className="identity-feedback identity-feedback--success" role="status">{profileSuccess}</p>}
        <button className="identity-primary" disabled={profileRequest.pending}>{profileRequest.pending ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
      </form>
    </div>

    <div className="identity-card identity-card--separated">
      <p className="identity-eyebrow">BẢO MẬT TÀI KHOẢN</p>
      <h2>Đổi email</h2>
      <p className="identity-description">Email mới chỉ được áp dụng sau khi xác minh mã gửi tới hộp thư đó. Bạn sẽ cần đăng nhập lại sau khi đổi thành công.</p>
      {!challengeId ? <form className="identity-form" onSubmit={requestEmailVerification}>
        <label className="identity-field" htmlFor="profile-new-email"><span>Email mới</span><input id="profile-new-email" type="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required maxLength={254} /></label>
        <label className="identity-field" htmlFor="profile-current-password"><span>Mật khẩu hiện tại</span><input id="profile-current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required maxLength={128} /></label>
        <button className="identity-secondary" disabled={emailRequest.pending}>{emailRequest.pending ? 'Đang gửi…' : 'Gửi mã xác minh'}</button>
      </form> : <form className="identity-form" onSubmit={verifyEmail}>
        <label className="identity-field" htmlFor="profile-email-code"><span>Mã xác minh 6 chữ số</span><input id="profile-email-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/gu, '').slice(0, 6))} required maxLength={6} /></label>
        <button className="identity-primary" disabled={emailRequest.pending}>{emailRequest.pending ? 'Đang xác minh…' : 'Xác minh email mới'}</button>
        <button className="identity-secondary" type="button" disabled={emailRequest.pending} onClick={() => { setChallengeId(''); setVerificationCode(''); emailRequest.setError(null); }}>Hủy yêu cầu</button>
      </form>}
      {emailRequest.error && <p className="identity-feedback identity-feedback--error" role="alert">{emailRequest.error.message}</p>}
      {emailSuccess && <p className="identity-feedback identity-feedback--success" role="status">{emailSuccess}</p>}
    </div>
  </section>;
}
