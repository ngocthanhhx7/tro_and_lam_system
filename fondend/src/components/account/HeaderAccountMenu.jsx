import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import { NOTIFICATIONS_UPDATED_EVENT, operationsApi } from '../../services/operations/operationsApi.js';
import Icon from '../catalog/Icon.jsx';
import LogoutButton from '../identity/LogoutButton.jsx';
import './header-account-menu.css';

export default function HeaderAccountMenu() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const menu = useRef(null);
  const closeTimer = useRef(null);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (user?.role !== 'customer') return undefined;
    let active = true;
    const refresh = () => operationsApi.getUnreadCount()
      .then((response) => { if (active) setUnreadCount(Number(response?.data?.count) || 0); })
      .catch(() => { if (active) setUnreadCount(0); });
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh();
    const timer = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [user?.id, user?.role]);

  if (user?.role !== 'customer') {
    return <Link className="catalog-header__icon-link" to="/tai-khoan" aria-label={user ? `Hồ sơ ${user.name}` : 'Tài khoản'}><Icon name="user" /></Link>;
  }

  return <details
    className="header-account-menu"
    ref={menu}
    onFocus={() => window.clearTimeout(closeTimer.current)}
    onPointerEnter={(event) => {
      if (event.pointerType !== 'mouse') return;
      window.clearTimeout(closeTimer.current);
      event.currentTarget.open = true;
    }}
    onPointerLeave={(event) => {
      if (event.pointerType !== 'mouse') return;
      const details = event.currentTarget;
      window.clearTimeout(closeTimer.current);
      closeTimer.current = window.setTimeout(() => { details.open = false; }, 180);
    }}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
    onKeyDown={(event) => {
      window.clearTimeout(closeTimer.current);
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.open = false;
        event.currentTarget.querySelector('summary').focus();
      }
    }}
  ><summary
      className="catalog-header__icon-link header-account-menu__trigger"
      aria-label={`Menu tài khoản của ${user.name}${unreadCount > 0 ? `, ${unreadCount} thông báo chưa đọc` : ''}`}
    ><Icon name="user" />{unreadCount > 0 && <span className="header-account-menu__badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}</summary>
    <nav className="header-account-menu__dropdown" aria-label="Tài khoản khách hàng">
      <Link to="/tai-khoan/thong-bao" onClick={() => { menu.current.open = false; }}><Icon name="bell" size={18} /><span>Thông báo</span>{unreadCount > 0 && <span className="header-account-menu__unread">{unreadCount > 99 ? '99+' : unreadCount}<span className="visually-hidden"> chưa đọc</span></span>}</Link>
      <Link to="/tai-khoan/ho-so" onClick={() => { menu.current.open = false; }}><Icon name="user" size={18} /><span>Hồ sơ</span></Link>
      <Link to="/tai-khoan/don-hang" onClick={() => { menu.current.open = false; }}><Icon name="bag" size={18} /><span>Đơn hàng</span></Link>
      <LogoutButton variant="dropdown" destination="/" />
    </nav>
  </details>;
}
