import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import './logout.css';

export default function LogoutButton({ destination = '/', variant = 'public', onSuccess }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submitLogout() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await logout();
      onSuccess?.();
      navigate(destination, { replace: true });
    } catch {
      setError('Chưa thể đăng xuất. Hãy thử lại khi kết nối ổn định.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`logout-action logout-action--${variant}`}>
      <button className="logout-action__button" type="button" onClick={submitLogout} disabled={pending}>
        {pending ? 'Đang đăng xuất…' : 'Đăng xuất'}
      </button>
      {error && <p className="logout-action__error" role="alert">{error}</p>}
    </div>
  );
}
