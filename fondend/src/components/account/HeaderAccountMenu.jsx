import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import { NOTIFICATIONS_UPDATED_EVENT, operationsApi } from '../../services/operations/operationsApi.js';
import Icon from '../catalog/Icon.jsx';
import LogoutButton from '../identity/LogoutButton.jsx';
import './header-account-menu.css';

export default function HeaderAccountMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const root = useRef(null);
  const trigger = useRef(null);

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

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  if (user?.role !== 'customer') {
    return <Link className="catalog-header__icon-link" to="/tai-khoan" aria-label={user ? `Hồ sơ ${user.name}` : 'Tài khoản'}><Icon name="user" /></Link>;
  }

  function closeMenu() { setOpen(false); }

  return <div className="header-account-menu" ref={root}>
    <button
      ref={trigger}
      className="catalog-header__icon-link header-account-menu__trigger"
      type="button"
      aria-label="Mở menu tài khoản"
      aria-expanded={open}
      aria-controls={open ? 'header-account-menu-panel' : undefined}
      onClick={() => setOpen((value) => !value)}
    ><Icon name="user" />{unreadCount > 0 && <span className="header-account-menu__badge" aria-label={`${unreadCount} thông báo chưa đọc`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>
    {open && <div id="header-account-menu-panel" className="header-account-menu__panel" aria-label="Menu tài khoản">
      <div className="header-account-menu__greeting"><span>Xin chào</span><strong title={user.name}>{user.name}</strong></div>
      <Link className="header-account-menu__item" to="/tai-khoan/thong-bao" onClick={closeMenu}>
        <span>Thông báo</span>{unreadCount > 0 && <span className="header-account-menu__unread">{unreadCount > 99 ? '99+' : unreadCount} mới</span>}
      </Link>
      <div className="header-account-menu__group">
        <Link className="header-account-menu__group-title" to="/tai-khoan" onClick={closeMenu}>Tài khoản của tôi</Link>
        <Link className="header-account-menu__subitem" to="/tai-khoan/ho-so" onClick={closeMenu}>Hồ sơ</Link>
        <Link className="header-account-menu__subitem" to="/tai-khoan/dia-chi" onClick={closeMenu}>Địa chỉ</Link>
        <Link className="header-account-menu__subitem" to="/tai-khoan/doi-mat-khau" onClick={closeMenu}>Đổi mật khẩu</Link>
      </div>
      <Link className="header-account-menu__item" to="/tai-khoan/don-hang" onClick={closeMenu}>Đơn mua</Link>
      <Link className="header-account-menu__item" to="/tai-khoan/voucher" onClick={closeMenu}>Kho voucher</Link>
      <div className="header-account-menu__logout"><LogoutButton variant="account-menu" destination="/dang-nhap" onSuccess={closeMenu} /></div>
    </div>}
  </div>;
}
