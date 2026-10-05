import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { operationsApi } from '../../services/operations/operationsApi.js';
import './operations.css';

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const refreshCount = useCallback(async () => {
    try {
      const response = await operationsApi.getUnreadCount();
      setCount(response.data.count);
      setError('');
    } catch {
      setError('Không tải được số thông báo mới.');
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void refreshCount(); }, 0);
    const poll = () => { if (document.visibilityState === 'visible') refreshCount(); };
    const timer = window.setInterval(poll, 30_000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initial);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    operationsApi.listNotifications({ page: 1, limit: 5 }).then((response) => {
      if (active) setItems(response.data);
    }).catch(() => {
      if (active) setError('Không tải được thông báo. Thử mở hộp thư để làm mới.');
    });
    return () => { active = false; };
  }, [open]);

  async function openNotification(item) {
    if (!item.readAt) {
      try {
        await operationsApi.markNotificationRead(item.id);
        setCount((previous) => Math.max(0, previous - 1));
      } catch {
        setError('Không thể đánh dấu thông báo đã đọc.');
      }
    }
  }

  return (
    <div className="operations-bell">
      <button className="operations-bell__trigger" type="button" aria-expanded={open} aria-controls="notification-preview" onClick={() => setOpen((value) => !value)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
        <span className="visually-hidden">Thông báo</span>
        {count > 0 && <span className="operations-bell__count" aria-label={`${count} thông báo chưa đọc`}>{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <section className="operations-bell__popover" id="notification-preview" aria-label="Thông báo gần đây">
          {error && <p className="operations-error" role="status">{error}</p>}
          {items.length === 0 ? <p>Chưa có thông báo mới.</p> : items.map((item) => (
            <Link className="operations-bell__item" key={item.id} to={item.href} onClick={() => openNotification(item)}>
              <strong>{item.title}</strong><span>{item.body}</span>
            </Link>
          ))}
          <Link to="/tai-khoan/thong-bao" onClick={() => setOpen(false)}>Mở hộp thư thông báo</Link>
        </section>
      )}
    </div>
  );
}
