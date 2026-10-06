import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AssistantWidget } from '../components/assistant/AssistantWidget.jsx';

const publicLinks = [
  { to: '/san-pham', label: 'Sản phẩm' },
  { to: '/bo-suu-tap/lifestyle', label: 'Lifestyle' },
  { to: '/bo-suu-tap/diplomacy', label: 'Diplomacy' },
  { to: '/cau-chuyen', label: 'Câu chuyện' },
  { to: '/qua-tang-doanh-nghiep', label: 'Quà tặng doanh nghiệp' },
];

function HeaderSearch({ mobile = false, onSubmitted }) {
  const navigate = useNavigate();
  function handleSubmit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const q = String(data.get('q') || '').trim();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    navigate(`/san-pham${params.size ? `?${params}` : ''}`);
    onSubmitted?.();
  }
  return <form className={`site-search${mobile ? ' site-search--mobile' : ''}`} role="search" onSubmit={handleSubmit}>
    <label className="visually-hidden" htmlFor={mobile ? 'mobile-catalog-search' : 'catalog-search'}>Tìm sản phẩm</label>
    <input id={mobile ? 'mobile-catalog-search' : 'catalog-search'} type="search" name="q" placeholder="Tìm sản phẩm" />
    <button type="submit" aria-label="Tìm kiếm">⌕</button>
  </form>;
}

export default function PublicCatalogLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const showAssistant = !/^\/(?:admin|staff)(?:\/|$)/u.test(pathname);
  const menuDialog = useRef(null);
  const menuButton = useRef(null);

  useEffect(() => {
    const dialog = menuDialog.current;
    if (!dialog) return;
    if (menuOpen && !dialog.open) dialog.showModal();
    if (!menuOpen && dialog.open) dialog.close();
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    if (menuDialog.current?.open) menuDialog.current.close();
    menuButton.current?.focus();
  }

  return <div className="public-site">
    <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
    <header className="catalog-header">
      <div className="catalog-header__inner">
        <Link className="catalog-brand" to="/" aria-label="TRO & LAM — trang chủ">
          <img src="/assets/logo/logo.PNG" alt="" width="48" height="48" />
          <span><strong>TRO & LAM</strong><small>Gốm Chu Đậu</small></span>
        </Link>
        <nav className="catalog-nav" aria-label="Điều hướng chính">
          {publicLinks.map((link) => <Link key={link.to} to={link.to}>{link.label}</Link>)}
        </nav>
        <div className="catalog-header__actions">
          <HeaderSearch />
          <Link className="catalog-header__icon-link" to="/tai-khoan" aria-label="Tài khoản"><span aria-hidden="true">♙</span></Link>
          <Link className="catalog-header__icon-link" to="/gio-hang" aria-label="Giỏ hàng"><span aria-hidden="true">▱</span></Link>
        </div>
        <button ref={menuButton} className="menu-toggle" type="button" aria-label="Mở điều hướng" aria-expanded={menuOpen} aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
          <span /><span /><span />
        </button>
      </div>
      <dialog className="mobile-menu" ref={menuDialog} aria-label="Điều hướng" onCancel={(event) => { event.preventDefault(); closeMenu(); }}>
        <div className="mobile-menu__top">
          <span className="eyebrow">TRO & LAM</span>
          <button className="icon-button" type="button" onClick={closeMenu} aria-label="Đóng điều hướng">×</button>
        </div>
        <HeaderSearch mobile onSubmitted={closeMenu} />
        <nav aria-label="Điều hướng điện thoại">
          {publicLinks.map((link) => <Link key={link.to} to={link.to} onClick={closeMenu}>{link.label}<span aria-hidden="true">→</span></Link>)}
          <Link to="/lien-he" onClick={closeMenu}>Liên hệ<span aria-hidden="true">→</span></Link>
          <Link to="/gio-hang" onClick={closeMenu}>Giỏ hàng<span aria-hidden="true">→</span></Link>
        </nav>
      </dialog>
    </header>
    <main id="main-content" className="catalog-main"><Outlet /></main>
    <footer className="catalog-footer">
      <div className="catalog-footer__inner">
        <div className="catalog-footer__brand"><img src="/assets/logo/logo.PNG" alt="" width="56" height="56" /><span><strong>TRO & LAM</strong><small>Gốm Chu Đậu</small></span></div>
        <p>Gốm trong đời sống. Câu chuyện qua từng lựa chọn.</p>
        <nav aria-label="Liên kết cuối trang"><Link to="/san-pham">Danh mục</Link><Link to="/lien-he">Liên hệ</Link><Link to="/tra-cuu-don-hang">Tra cứu đơn hàng</Link></nav>
        <small className="catalog-footer__note">Thông tin sản phẩm, giá và khả năng đặt mua được cập nhật theo danh mục đã công bố.</small>
      </div>
    </footer>
    {showAssistant && <AssistantWidget />}
  </div>;
}
