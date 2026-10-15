import { useState } from 'react';
import { useAuth } from '../../contexts/auth.context.js';
import './logout.css';

export default function LogoutButton({ destination = '/', variant = 'public', onSuccess }) {
  const { logout } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submitLogout() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await logout(() => {
        onSuccess?.();
        // A fresh document also clears in-memory account/chat state and avoids
        // a protected route's queued redirect winning over the logout destination.
        window.location.replace(destination);
      });
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
