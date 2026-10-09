import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth.context.js';
import LogoutButton from '../components/identity/LogoutButton.jsx';
import Icon from '../components/catalog/Icon.jsx';
import { NOTIFICATIONS_UPDATED_EVENT, operationsApi } from '../services/operations/operationsApi.js';
import './admin-layout.css';

const adminGroups = [
  { label: 'QUẢN LÝ', links: [['', 'Tổng quan', 'grid'], ['/orders', 'Đơn hàng', 'receipt'], ['/products', 'Sản phẩm', 'pottery'], ['/categories', 'Danh mục', 'layers']] },
  { label: 'KHÁCH HÀNG & NHÂN VIÊN', links: [['/users', 'Khách hàng & tài khoản', 'users'], ['/vouchers', 'Voucher', 'ticket'], ['/employees', 'Nhân viên', 'briefcase'], ['/appeals', 'Kháng nghị', 'shield'], ['/reviews', 'Đánh giá', 'star']] },
  { label: 'NỘI DUNG & HỆ THỐNG', links: [['/reports', 'Báo cáo', 'chart'], ['/notifications', 'Thông báo', 'bell'], ['/content', 'Nội dung', 'file'], ['/nfc', 'NFC', 'scan'], ['/refunds', 'Hoàn tiền', 'return'], ['/logs', 'Nhật ký', 'history'], ['/settings', 'Cài đặt', 'settings']] },
];
const staffGroups = [
  { label: 'VẬN HÀNH', links: [['', 'Tổng quan', 'grid'], ['/orders', 'Đơn hàng', 'receipt']] },
  { label: 'CHĂM SÓC KHÁCH HÀNG', links: [['/support', 'Hỗ trợ khách hàng', 'message'], ['/returns', 'Yêu cầu đổi trả', 'return'], ['/contacts', 'Liên hệ & tư vấn', 'users'], ['/notifications', 'Thông báo', 'bell']] },
];

export default function AdminLayout({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isStaff = user?.role === 'staff';
  const home = isStaff ? '/staff' : '/admin';
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState('');
  const accountRef = useRef(null);
  const accountTrigger = useRef(null);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    let active = true;
    let sequence = 0;
    const refresh = () => { const current = ++sequence; return operationsApi.getUnreadCount().then((result) => { if (active && current === sequence) setUnread(result.data.count); }).catch(() => {}); };
    void refresh();
    const poll = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(poll, 30_000);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    document.addEventListener('visibilitychange', poll);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh); document.removeEventListener('visibilitychange', poll); };
  }, [user?.id]);

  useEffect(() => {
    if (!menuOpen && !accountOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        if (accountOpen) accountTrigger.current?.focus();
        else menuButtonRef.current?.focus();
        setMenuOpen(false); setAccountOpen(false);
      }
    };
    const outside = (event) => { if (!accountRef.current?.contains(event.target)) setAccountOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', outside); };
  }, [menuOpen, accountOpen]);

  const closeMenus = () => { setMenuOpen(false); setAccountOpen(false); };
  const pageLabel = pathname.startsWith(`${home}/account/`) ? 'Trung tâm tài khoản' : [...adminGroups, ...staffGroups].flatMap((group) => group.links).find(([suffix]) => suffix && pathname.startsWith(`${home}${suffix}`))?.[1] || 'Tổng quan';

  return <div className={`admin-layout${isStaff ? ' admin-layout--staff' : ''}`}>
    <a className="admin-layout__skip" href="#admin-main">Bỏ qua điều hướng</a>
    <aside id="admin-navigation" className={`admin-layout__sidebar${menuOpen ? ' is-open' : ''}`} aria-label={isStaff ? 'Khu vực vận hành' : 'Khu vực quản trị'}>
      <Link className="admin-layout__brand" to={home} onClick={closeMenus}>
        <img src="/assets/logo/logo.PNG" width="38" height="38" alt="" /><span><strong>TRO &amp; LAM</strong><small>{isStaff ? 'KHÔNG GIAN VẬN HÀNH' : 'TRANG QUẢN TRỊ'}</small></span>
      </Link>
      <nav aria-label={isStaff ? 'Điều hướng vận hành' : 'Điều hướng quản trị'}>
        {(isStaff ? staffGroups : adminGroups).map((group) => <div className="admin-layout__nav-group" key={group.label}>
          <p className="admin-layout__section-label">{group.label}</p><ul>{group.links.map(([suffix, label, icon]) => <li key={suffix}>
            <NavLink to={`${home}${suffix}`} aria-label={label} end={!suffix} onClick={closeMenus} className={({ isActive }) => `admin-layout__nav-link${isActive ? ' is-active' : ''}`}><Icon name={icon} size={18} /><span>{label}</span>{suffix === '/notifications' && unread > 0 && <b className="admin-layout__unread">{unread > 99 ? '99+' : unread}</b>}</NavLink>
          </li>)}</ul>
        </div>)}
      </nav>
      <div className="admin-layout__sidebar-note"><span><i /> KHÔNG GIAN LÀM VIỆC</span><small>Gốm Chu Đậu · TRO &amp; LAM</small></div>
    </aside>
    {menuOpen && <button className="admin-layout__scrim" aria-label="Đóng điều hướng" type="button" onClick={closeMenus} />}
    <div className="admin-layout__frame">
      <header className="admin-layout__topbar">
        <button ref={menuButtonRef} className="admin-layout__menu-toggle" type="button" aria-label={menuOpen ? 'Đóng điều hướng' : 'Mở điều hướng'} aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button>
        <span className="admin-layout__breadcrumb">{isStaff ? 'Vận hành' : 'Quản trị'}<span>/</span><strong>{pageLabel}</strong></span>
        <form className="admin-layout__search" role="search" onSubmit={(event) => { event.preventDefault(); navigate(`${home}/orders${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`); }}>
          <button type="submit" aria-label="Tìm đơn hàng"><Icon name="search" size={17} /></button><input aria-label="Tìm đơn hàng, khách hàng" placeholder="Tìm đơn hàng, khách hàng…" value={query} maxLength={120} onChange={(event) => setQuery(event.target.value)} />
        </form>
        <Link className="admin-layout__notification" to={`${home}/notifications`} aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ''}`}><Icon name="bell" size={21} />{unread > 0 && <i />}</Link>
        <div className="admin-layout__account" ref={accountRef}>
          <button ref={accountTrigger} className="admin-layout__account-trigger" type="button" aria-label="Mở menu tài khoản" aria-expanded={accountOpen} aria-controls={accountOpen ? 'workspace-account-panel' : undefined} onClick={() => setAccountOpen(!accountOpen)}>
            <span className="admin-layout__account-name"><strong>{user?.name}</strong><small>{isStaff ? 'Nhân viên vận hành' : 'Quản trị viên'}</small></span><span className="admin-layout__avatar"><Icon name="user" size={20} /></span><Icon name="chevron" size={13} />
          </button>
          {accountOpen && <div id="workspace-account-panel" className="admin-layout__account-panel" aria-label="Menu tài khoản">
            <strong>Trung tâm tài khoản</strong><small>{user?.email}</small>
            <Link to={`${home}/account/profile`} onClick={closeMenus}><Icon name="user" size={17} />Hồ sơ</Link><Link to={`${home}/account/password`} onClick={closeMenus}><Icon name="lock" size={17} />Đổi mật khẩu</Link>
            <LogoutButton variant="account-menu" destination="/dang-nhap" onSuccess={closeMenus} />
          </div>}
        </div>
      </header>
      <main id="admin-main" className="admin-layout__main" tabIndex="-1">{children}</main><footer className="admin-layout__footer">TRO &amp; LAM <span>Gìn giữ tinh hoa · Tiếp nối giá trị</span></footer>
    </div>
  </div>;
}
