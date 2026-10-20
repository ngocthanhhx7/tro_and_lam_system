import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import { NOTIFICATIONS_UPDATED_EVENT, operationsApi } from '../../services/operations/operationsApi.js';
import Icon from '../catalog/Icon.jsx';
import './header-account-menu.css';

export default function HeaderAccountMenu() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

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

  return <Link
      className="catalog-header__icon-link header-account-menu__trigger"
      to="/tai-khoan"
      aria-label={`Tổng quan tài khoản của ${user.name}${unreadCount > 0 ? `, ${unreadCount} thông báo chưa đọc` : ''}`}
    ><Icon name="user" />{unreadCount > 0 && <span className="header-account-menu__badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}</Link>;
}
