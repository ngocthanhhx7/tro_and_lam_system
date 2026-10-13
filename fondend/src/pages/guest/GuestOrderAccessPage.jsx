import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { commerceApi } from '../../services/commerce/commerce.api.js';
import { errorText, orderStatusLabel } from '../commerce/commerce.format.js';
import '../commerce/commerce.css';

export default function GuestOrderAccessPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(null);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [trackingError, setTrackingError] = useState(null);

  async function track(event) {
    event.preventDefault();
    setTrackingBusy(true);
    setTrackingError(null);
    setProgress(null);
    try { setProgress(await commerceApi.trackOrder(code)); }
    catch (requestError) { setTrackingError(requestError); }
    finally { setTrackingBusy(false); }
  }

  async function requestCode(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      const result = await commerceApi.issueOrderChallenge({ code: code.trim(), email: email.trim() });
      setChallengeId(result.challengeId);
      setMessage('Nếu mã đơn và email trùng khớp, hướng dẫn xác minh sẽ được gửi tới email đó.');
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  }

  async function verify(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await commerceApi.verifyOrderChallenge({ challengeId, verificationCode });
      navigate(`/don-hang/${encodeURIComponent(result.orderId)}`, { replace: true });
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  }

  return <section className="commerce-page commerce-narrow">
    <p className="commerce-eyebrow">TRA CỨU ĐƠN HÀNG</p>
    <h1>Theo dõi đơn hàng</h1>
    <p className="commerce-lede">Nhập mã trong email xác nhận để xem tiến trình đơn hàng. Bạn không cần đăng nhập.</p>
    <form className="commerce-panel commerce-form" onSubmit={track}>
      <label className="commerce-field" htmlFor="tracking-code"><span>Mã đơn hàng</span><input id="tracking-code" value={code} onChange={event => { setCode(event.target.value.toUpperCase()); setProgress(null); }} placeholder="TL-…" required maxLength={32} autoComplete="off" /></label>
      <button className="commerce-primary" disabled={trackingBusy}>{trackingBusy ? 'Đang tra cứu…' : 'Tra cứu trạng thái'}</button>
    </form>
    {trackingError && <p className="commerce-error" role="alert">{errorText(trackingError, 'Chưa thể tra cứu đơn hàng.')}</p>}
    {progress && <section className="commerce-panel commerce-timeline" aria-label="Tiến trình đơn hàng"><p className="commerce-eyebrow">{progress.code}</p><h2>{orderStatusLabel[progress.status] || progress.status}</h2><ol>{progress.history.map((item, index) => <li key={`${item.at}-${index}`}><strong>{orderStatusLabel[item.status] || item.status}</strong><time dateTime={item.at}>{new Date(item.at).toLocaleString('vi-VN')}</time></li>)}</ol></section>}
    <details className="commerce-panel commerce-timeline"><summary>Xác minh email để xem thông tin chi tiết</summary><p className="commerce-note">Địa chỉ, người nhận và chi tiết thanh toán chỉ được mở sau khi xác minh email đặt hàng.</p>
    {!challengeId ? <form className="commerce-form" onSubmit={requestCode}>
      <label className="commerce-field" htmlFor="order-code"><span>Mã đơn hàng</span><input id="order-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required maxLength={32} autoComplete="off" /></label>
      <label className="commerce-field" htmlFor="order-email"><span>Email đặt hàng</span><input id="order-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="email" /></label>
      <button className="commerce-primary" type="submit" disabled={busy}>{busy ? 'Đang gửi yêu cầu…' : 'Gửi mã xác minh'}</button>
    </form> : <form className="commerce-panel commerce-form" onSubmit={verify}>
      <p role="status" className="commerce-note">{message}</p>
      <label className="commerce-field" htmlFor="order-otp"><span>Mã xác minh gồm 6 chữ số</span><input id="order-otp" inputMode="numeric" pattern="[0-9]{6}" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/gu, '').slice(0, 6))} required autoComplete="one-time-code" maxLength={6} /></label>
      <button className="commerce-primary" type="submit" disabled={busy || verificationCode.length !== 6}>{busy ? 'Đang xác minh…' : 'Xác minh và xem đơn'}</button>
      <button className="commerce-link-button" type="button" disabled={busy} onClick={() => { setChallengeId(''); setVerificationCode(''); setMessage(''); }}>Dùng mã đơn hoặc email khác</button>
    </form>}
    {error && <p className="commerce-error" role="alert">{errorText(error, 'Không thể xác minh đơn hàng.')}</p>}
    <p className="commerce-note">Không thấy email? Kiểm tra thư rác hoặc thử lại sau. Yêu cầu xác minh được giới hạn để bảo vệ hộp thư.</p>
    </details>
    <Link to="/">Về trang chủ</Link>
  </section>;
}
