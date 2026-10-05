import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { identityApi } from '../../services/identity/identity.api.js';
import { useIdentityRequest } from '../../hooks/identity/useIdentityRequest.js';
import './identity.css';

function ErrorNote({ error }) {
  return error ? <p className="identity-feedback identity-feedback--error" role="alert">{error.message || 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.'}</p> : null;
}

export default function BlockedAppealPage() {
  const navigate = useNavigate();
  const [appeal, setAppeal] = useState(null);
  const [checking, setChecking] = useState(true);
  const [needsIdentity, setNeedsIdentity] = useState(false);
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const { pending, error, setError, run } = useIdentityRequest();

  const loadAppeal = useCallback(async () => {
    try {
      const response = await identityApi.appeal();
      setAppeal(response.data);
      setNeedsIdentity(false);
    } catch (requestError) {
      if (requestError.status === 401 || requestError.code === 'SESSION_EXPIRED') {
        setNeedsIdentity(true);
        setAppeal(null);
      } else {
        setError(requestError);
      }
    } finally {
      setChecking(false);
    }
  }, [setError]);

  useEffect(() => { void Promise.resolve().then(loadAppeal); }, [loadAppeal]);

  async function requestCode(event) {
    event.preventDefault(); setNotice('');
    try {
      const response = await run(() => identityApi.requestAppealChallenge(email));
      setChallengeId(response.data.challengeId);
      setNotice('Nếu email thuộc tài khoản đang bị khóa, mã xác minh đã được xếp gửi.');
    } catch { /* The request hook retains the error for the form. */ }
  }

  async function verifyCode(event) {
    event.preventDefault(); setNotice('');
    try {
      await run(() => identityApi.exchangeAppealAccess({ email, verificationCode, challengeId }));
      setVerificationCode('');
      setChecking(true);
      await loadAppeal();
    } catch { /* The request hook retains the error for the form. */ }
  }

  async function submitAppeal(event) {
    event.preventDefault(); setNotice(''); setError(null);
    try {
      const response = await run(() => identityApi.submitAppeal(message));
      setAppeal((current) => ({ ...current, ...response.data }));
      setMessage('');
      setNotice('Kháng nghị đã được tiếp nhận để quản trị viên xem xét.');
    } catch { /* The request hook retains the error for the form. */ }
  }

  async function logout() {
    try {
      await run(() => identityApi.logout());
      navigate('/dang-nhap', { replace: true });
    } catch { /* The request hook retains the error for the form. */ }
  }

  return <section className="identity-page"><div className="identity-card">
    <p className="identity-eyebrow">TRỢ GIÚP TÀI KHOẢN</p><h1>Tài khoản đang bị khóa</h1>
    <p className="identity-description">Phiên tài khoản thông thường đã bị thu hồi. Màn hình này chỉ cho phép gửi và theo dõi kháng nghị của chính bạn.</p>
    {checking && <p className="identity-loading" role="status">Đang tải trạng thái kháng nghị…</p>}
    {!checking && needsIdentity && <>
      <p className="identity-notice">Đăng nhập bằng mật khẩu đúng để tiếp tục, hoặc xác minh email bằng mã dùng một lần. Cả hai cách chỉ cấp quyền kháng nghị giới hạn.</p>
      <form className="identity-form" onSubmit={requestCode}>
        <label className="identity-field" htmlFor="appeal-email"><span>Email tài khoản</span><input id="appeal-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></label>
        <button className="identity-secondary" type="submit" disabled={pending}>{pending ? 'Đang gửi yêu cầu…' : 'Gửi mã xác minh'}</button>
      </form>
      {challengeId && <form className="identity-form identity-form--compact" onSubmit={verifyCode}>
        <label className="identity-field" htmlFor="appeal-code"><span>Mã 6 chữ số trong email</span><input id="appeal-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} required minLength={6} maxLength={6} /></label>
        <button className="identity-primary" type="submit" disabled={pending}>{pending ? 'Đang xác minh…' : 'Mở màn hình kháng nghị'}</button>
      </form>}
    </>}
    {!checking && appeal && <>
      {appeal.blockedReason && <section className="identity-reason"><h2>Lý do hiển thị</h2><p>{appeal.blockedReason}</p></section>}
      {appeal.status === 'pending' && <section className="identity-appeal-status"><h2>Kháng nghị đang chờ</h2><p>Đã tiếp nhận lúc {appeal.submittedAt ? new Date(appeal.submittedAt).toLocaleString('vi-VN') : 'vừa xong'}.</p>{appeal.message && <blockquote>{appeal.message}</blockquote>}</section>}
      {appeal.status === 'rejected' && <section className="identity-appeal-status"><h2>Kháng nghị đã được xem xét</h2><p>{appeal.reviewNote}</p><p>Bạn có thể gửi thông tin bổ sung để yêu cầu xem xét lại.</p></section>}
      {appeal.status === 'approved' && <section className="identity-appeal-status"><h2>Tài khoản đã được mở</h2><p>Đăng nhập lại để tạo phiên mới.</p><Link className="identity-primary-link" to="/dang-nhap">Đăng nhập</Link></section>}
      {appeal.status !== 'pending' && appeal.status !== 'approved' && <form className="identity-form" onSubmit={submitAppeal}>
        <label className="identity-field" htmlFor="appeal-message"><span>Nội dung kháng nghị</span><textarea id="appeal-message" value={message} onChange={(event) => setMessage(event.target.value)} required minLength={1} maxLength={5000} /></label>
        <p className="identity-footnote">Không gửi mật khẩu, mã xác minh, thông tin thanh toán hoặc tài liệu nhạy cảm trong nội dung này.</p>
        <button className="identity-primary" type="submit" disabled={pending}>{pending ? 'Đang gửi…' : 'Gửi kháng nghị'}</button>
      </form>}
    </>}
    {!checking && error && <><ErrorNote error={error} /><button className="identity-secondary" type="button" onClick={() => { setChecking(true); setError(null); void loadAppeal(); }}>Thử tải lại</button></>}
    {notice && <p className="identity-feedback identity-feedback--success" role="status">{notice}</p>}
    <div className="identity-links"><button className="identity-text-button" type="button" onClick={logout} disabled={pending}>Đăng xuất</button><Link to="/lien-he">Liên hệ hỗ trợ</Link></div>
  </div></section>;
}
