import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { identityApi } from '../../services/identity/identity.api.js';
import { useAuth } from '../../contexts/auth.context.js';
import { useIdentityRequest } from '../../hooks/identity/useIdentityRequest.js';
import './identity.css';

function Frame({ title, description, children }) {
  return <section className="identity-page"><div className="identity-card"><p className="identity-eyebrow">TRO &amp; LAM · TÀI KHOẢN</p><h1>{title}</h1>{description && <p className="identity-description">{description}</p>}{children}</div></section>;
}

function Feedback({ error, success }) {
  if (error) return <p className="identity-feedback identity-feedback--error" role="alert">{error.message || 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.'}</p>;
  if (success) return <p className="identity-feedback identity-feedback--success" role="status">{success}</p>;
  return null;
}

function Field({ label, name, type = 'text', value, onChange, autoComplete, required = true, minLength, maxLength }) {
  return <label className="identity-field" htmlFor={`identity-${name}`}><span>{label}</span><input id={`identity-${name}`} name={name} type={type} value={value} onChange={onChange} autoComplete={autoComplete} required={required} minLength={minLength} maxLength={maxLength} /></label>;
}

export function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const { pending, error, run } = useIdentityRequest();
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    try {
      const response = await run(() => identityApi.login(form));
      setUser(response.data.user);
      navigate(response.data.user.role === 'customer' ? '/tai-khoan' : '/staff', { replace: true });
    } catch (requestError) {
      if (requestError.code === 'ACCOUNT_BLOCKED') {
        setUser(null);
        navigate('/tai-khoan/bi-khoa', { replace: true });
      }
    }
  }
  return <Frame title="Đăng nhập" description="Sử dụng tài khoản đã xác minh để tiếp tục.">
    <form className="identity-form" onSubmit={submit}>
      <Field label="Email" name="email" type="email" value={form.email} onChange={update} autoComplete="email" maxLength={254} />
      <Field label="Mật khẩu" name="password" type="password" value={form.password} onChange={update} autoComplete="current-password" maxLength={128} />
      <Feedback error={error} />
      <button className="identity-primary" type="submit" disabled={pending}>{pending ? 'Đang xác minh…' : 'Đăng nhập'}</button>
    </form>
    <nav className="identity-links" aria-label="Liên kết tài khoản"><Link to="/quen-mat-khau">Quên mật khẩu?</Link><Link to="/dang-ky">Tạo tài khoản</Link></nav>
  </Frame>;
}

export function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [success, setSuccess] = useState('');
  const { pending, error, setError, run } = useIdentityRequest();
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); setSuccess(''); setError(null);
    if (form.password !== form.confirmPassword) {
      setError(new Error('Mật khẩu nhập lại chưa khớp.'));
      return;
    }
    try {
      await run(() => identityApi.register({ name: form.name, email: form.email, ...(form.phone ? { phone: form.phone } : {}), password: form.password }));
      setSuccess('Nếu địa chỉ email có thể nhận thư, chúng tôi đã xếp hướng dẫn xác minh. Hãy kiểm tra hộp thư và thư rác.');
      setForm((current) => ({ ...current, password: '', confirmPassword: '' }));
    } catch { /* The request hook retains the error for the form. */ }
  }
  return <Frame title="Tạo tài khoản" description="Tài khoản mới bắt đầu với quyền khách hàng. Email cần được xác minh trước khi đăng nhập.">
    <form className="identity-form" onSubmit={submit}>
      <Field label="Họ và tên" name="name" value={form.name} onChange={update} autoComplete="name" maxLength={120} />
      <Field label="Email" name="email" type="email" value={form.email} onChange={update} autoComplete="email" maxLength={254} />
      <Field label="Số điện thoại (không bắt buộc)" name="phone" type="tel" value={form.phone} onChange={update} autoComplete="tel" required={false} maxLength={30} />
      <Field label="Mật khẩu · ít nhất 12 ký tự" name="password" type="password" value={form.password} onChange={update} autoComplete="new-password" minLength={12} maxLength={128} />
      <Field label="Nhập lại mật khẩu" name="confirmPassword" type="password" value={form.confirmPassword} onChange={update} autoComplete="new-password" minLength={12} maxLength={128} />
      <Feedback error={error} success={success} />
      <button className="identity-primary" type="submit" disabled={pending}>{pending ? 'Đang tạo tài khoản…' : 'Đăng ký'}</button>
    </form>
    <p className="identity-footnote">Đã có tài khoản? <Link to="/dang-nhap">Đăng nhập</Link></p>
  </Frame>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState('');
  const { pending, error, run } = useIdentityRequest();
  async function submit(event) {
    event.preventDefault();
    try {
      await run(() => identityApi.forgotPassword(email));
      setSuccess('Nếu email đã được xác minh, hướng dẫn đặt lại đã được xếp gửi.');
    } catch { /* The request hook retains the error for the form. */ }
  }
  return <Frame title="Khôi phục mật khẩu" description="Nhập email tài khoản. Phản hồi không tiết lộ tài khoản có tồn tại hay không.">
    <form className="identity-form" onSubmit={submit}>
      <Field label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} />
      <Feedback error={error} success={success} />
      <button className="identity-primary" type="submit" disabled={pending}>{pending ? 'Đang gửi yêu cầu…' : 'Gửi hướng dẫn'}</button>
    </form><p className="identity-footnote"><Link to="/dang-nhap">Quay lại đăng nhập</Link></p>
  </Frame>;
}

const pendingEmailVerifications = new Map();

function verifyEmailOnce(token) {
  const pending = pendingEmailVerifications.get(token);
  if (pending) return pending;

  const request = identityApi.verifyEmail(token).finally(() => {
    if (pendingEmailVerifications.get(token) === request) pendingEmailVerifications.delete(token);
  });
  pendingEmailVerifications.set(token, request);
  return request;
}

function useFragmentToken(key) {
  const location = useLocation();
  const fragmentToken = useMemo(() => new URLSearchParams(location.hash.slice(1)).get(key), [key, location.hash]);
  useEffect(() => {
    if (fragmentToken) window.history.replaceState(window.history.state, '', `${location.pathname}${location.search}`);
  }, [fragmentToken, location.pathname, location.search]);
  return fragmentToken;
}

export function VerifyEmailPage() {
  const token = useFragmentToken('token');
  const [result, setResult] = useState({ token: undefined, loading: false, message: '' });
  const state = result.token === token
    ? result
    : token
      ? { loading: true, message: '' }
      : { loading: false, status: 'error', message: 'Không tìm thấy liên kết xác minh. Nhập email để nhận liên kết mới.' };
  const [email, setEmail] = useState('');
  const [resent, setResent] = useState('');
  useEffect(() => {
    if (!token) return;
    let live = true;
    verifyEmailOnce(token).then(() => {
      if (live) setResult({ token, loading: false, status: 'success', message: 'Email đã được xác minh. Bạn có thể đăng nhập.' });
    }).catch((error) => {
      if (!live) return;
      const message = error.code === 'LINK_EXPIRED'
        ? 'Liên kết đã hết hạn hoặc đã được sử dụng. Nhập email bên dưới để nhận liên kết mới, rồi mở email mới nhất.'
        : error.message || 'Không thể xác minh email. Hãy thử gửi liên kết mới.';
      setResult({ token, loading: false, status: 'error', message });
    });
    return () => { live = false; };
  }, [token]);
  async function resend(event) {
    event.preventDefault(); setResent('');
    try {
      await identityApi.resendVerification(email);
      setResent('Nếu cần xác minh, hướng dẫn đã được xếp gửi.');
    } catch (error) { setResent(error.message); }
  }
  return <Frame title="Xác minh email" description={state.loading ? 'Đang kiểm tra liên kết an toàn…' : undefined}>
    {!state.loading && <p className={`identity-feedback identity-feedback--${state.status}`} role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>}
    {state.loading ? <div className="identity-loading" role="status">Đang xác minh…</div> : <>
      <form className="identity-form identity-form--compact" onSubmit={resend}>
        <Field label="Gửi lại tới email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} />
        <button className="identity-secondary" type="submit" disabled={!email.trim()}>Gửi lại hướng dẫn</button>
        {resent && <p role="status" className="identity-feedback identity-feedback--success">{resent}</p>}
      </form><Link className="identity-primary-link" to="/dang-nhap">Đăng nhập</Link>
    </>}
  </Frame>;
}

export function ResetPasswordPage() {
  const token = useFragmentToken('token');
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [success, setSuccess] = useState('');
  const { pending, error, setError, run } = useIdentityRequest();
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); setSuccess(''); setError(null);
    if (!token) { setError(new Error('Liên kết đặt lại không hợp lệ hoặc đã hết hạn.')); return; }
    if (form.password !== form.confirmPassword) { setError(new Error('Mật khẩu nhập lại chưa khớp.')); return; }
    try {
      await run(() => identityApi.resetPassword({ token, password: form.password }));
      setSuccess('Mật khẩu đã được cập nhật. Đăng nhập lại để mở tài khoản.');
      setForm({ password: '', confirmPassword: '' });
    } catch { /* The request hook retains the error for the form. */ }
  }
  return <Frame title="Đặt lại mật khẩu" description="Liên kết có hiệu lực một lần và sẽ thu hồi các phiên cũ.">
    <form className="identity-form" onSubmit={submit}>
      <Field label="Mật khẩu mới · ít nhất 12 ký tự" name="password" type="password" value={form.password} onChange={update} autoComplete="new-password" minLength={12} maxLength={128} />
      <Field label="Nhập lại mật khẩu mới" name="confirmPassword" type="password" value={form.confirmPassword} onChange={update} autoComplete="new-password" minLength={12} maxLength={128} />
      <Feedback error={error} success={success} />
      <button className="identity-primary" type="submit" disabled={pending || !token}>{pending ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}</button>
    </form><p className="identity-footnote"><Link to="/dang-nhap">Quay lại đăng nhập</Link></p>
  </Frame>;
}

export function AcceptInvitationPage() {
  const token = useFragmentToken('token');
  const [form, setForm] = useState({ name: '', password: '', confirmPassword: '' });
  const [success, setSuccess] = useState('');
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const { pending, error, setError, run } = useIdentityRequest();
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); setSuccess(''); setError(null);
    if (!token) { setError(new Error('Liên kết mời không hợp lệ hoặc đã hết hạn.')); return; }
    if (form.password !== form.confirmPassword) { setError(new Error('Mật khẩu nhập lại chưa khớp.')); return; }
    try {
      const response = await run(() => identityApi.acceptInvitation({ token, name: form.name, password: form.password }));
      setUser(response.data.user);
      navigate(response.data.user.role === 'customer' ? '/tai-khoan' : '/staff', { replace: true });
    } catch { /* The request hook retains the error for the form. */ }
  }
  return <Frame title="Kích hoạt lời mời" description="Tạo mật khẩu cho tài khoản được mời. Vai trò do quản trị viên quyết định.">
    <form className="identity-form" onSubmit={submit}>
      <Field label="Họ và tên" name="name" value={form.name} onChange={update} autoComplete="name" maxLength={120} />
      <Field label="Mật khẩu · ít nhất 12 ký tự" name="password" type="password" value={form.password} onChange={update} autoComplete="new-password" minLength={12} maxLength={128} />
      <Field label="Nhập lại mật khẩu" name="confirmPassword" type="password" value={form.confirmPassword} onChange={update} autoComplete="new-password" minLength={12} maxLength={128} />
      <Feedback error={error} success={success} />
      <button className="identity-primary" type="submit" disabled={pending || !token}>{pending ? 'Đang kích hoạt…' : 'Kích hoạt tài khoản'}</button>
    </form>
  </Frame>;
}
