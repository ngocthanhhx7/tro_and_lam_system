import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AssistantWidget } from '../components/assistant/AssistantWidget.jsx';
import Icon from '../components/catalog/Icon.jsx';

const links = [
  { to: '/', label: 'Trang chủ' },
  { to: '/san-pham', label: 'Sản phẩm' },
  { to: '/cau-chuyen', label: 'Câu chuyện' },
  { to: '/ve-chung-toi', label: 'Về chúng tôi' },
  { to: '/lien-he', label: 'Liên hệ' },
];
const collections = [
  { to: '/san-pham', label: 'Tất cả sản phẩm' },
  { to: '/bo-suu-tap/lifestyle', label: 'Lifestyle · Gốm trong đời sống' },
  { to: '/bo-suu-tap/diplomacy', label: 'Diplomacy · Gốm trao tặng' },
];
const pageMetadata = {
  '/': {
    title: 'Gốm Chu Đậu | TRO & LAM',
    description: 'Khám phá gốm Chu Đậu cùng TRO & LAM: những lựa chọn cho không gian sống, góc trà và dịp trao tặng.',
  },
  '/san-pham': {
    title: 'Sản phẩm gốm Chu Đậu | TRO & LAM',
    description: 'Xem danh mục gốm Chu Đậu của TRO & LAM, tìm theo dòng sản phẩm, loại gốm và thông tin được công bố.',
  },
  '/bo-suu-tap/lifestyle': {
    title: 'Gốm trong đời sống — Lifestyle | TRO & LAM',
    description: 'Khám phá Lifestyle Line của TRO & LAM với những gợi ý gốm cho góc trà và không gian sống.',
  },
  '/bo-suu-tap/diplomacy': {
    title: 'Gốm trao tặng — Diplomacy | TRO & LAM',
    description: 'Khám phá Diplomacy Line của TRO & LAM và gửi yêu cầu tư vấn quà tặng theo dịp sử dụng.',
  },
  '/cau-chuyen': {
    title: 'Câu chuyện về gốm Chu Đậu | TRO & LAM',
    description: 'Những góc nhìn, câu chuyện và tư liệu về gốm được TRO & LAM biên tập.',
  },
  '/ve-chung-toi': {
    title: 'Về TRO & LAM | Gốm Chu Đậu',
    description: 'Tìm hiểu cách TRO & LAM giới thiệu gốm Chu Đậu qua không gian sống và những dịp trao tặng.',
  },
  '/nguon-tu-lieu': {
    title: 'Nguồn hình ảnh và phim | TRO & LAM',
    description: 'Nguồn, ghi công và giấy phép của hình ảnh cùng phim tư liệu được sử dụng trên TRO & LAM.',
  },
  '/lien-he': {
    title: 'Liên hệ TRO & LAM | Tư vấn gốm và quà tặng',
    description: 'Gửi câu hỏi hoặc yêu cầu tư vấn về sản phẩm gốm và quà tặng tới TRO & LAM.',
  },
  '/gio-hang': { title: 'Giỏ hàng | TRO & LAM', description: 'Kiểm tra các sản phẩm đã thêm vào giỏ hàng TRO & LAM.' },
  '/thanh-toan': { title: 'Thanh toán | TRO & LAM', description: 'Xem lại thông tin và tiếp tục quy trình thanh toán của TRO & LAM.' },
  '/tai-khoan': { title: 'Tài khoản | TRO & LAM', description: 'Đăng nhập hoặc quản lý tài khoản TRO & LAM.' },
};
function setMetaDescription(content) {
  let meta = document.head.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'description';
    document.head.append(meta);
  }
  meta.content = content;
}
function Brand() {
  return <Link className="catalog-brand" to="/" aria-label="TRO & LAM — trang chủ"><img src="/assets/logo/logo.PNG" alt="" width="54" height="54" /><span><strong>TRO & LAM</strong><small>GỐM CHU ĐẬU</small></span></Link>;
}
function HeaderSearch({ mobile = false, onSubmitted }) {
  const navigate = useNavigate();
  return <form className={`site-search${mobile ? ' site-search--mobile' : ''}`} role="search" onSubmit={(event) => {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get('q') || '').trim();
    navigate(`/san-pham${q ? `?${new URLSearchParams({ q })}` : ''}`);
    onSubmitted?.();
  }}><label className="visually-hidden" htmlFor={mobile ? 'mobile-search' : 'header-search'}>Tìm sản phẩm</label><input autoFocus={!mobile} id={mobile ? 'mobile-search' : 'header-search'} type="search" name="q" placeholder="Bạn đang tìm món gốm nào?" maxLength="120" /><button aria-label="Tìm kiếm" type="submit"><Icon name="search" /></button></form>;
}
export default function PublicCatalogLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();
  const menuDialog = useRef(null);
  const menuButton = useRef(null);
  const productMenu = useRef(null);
  const isCollection = pathname.startsWith('/bo-suu-tap') || pathname.startsWith('/san-pham');
  useEffect(() => {
    const dialog = menuDialog.current;
    if (menuOpen && !dialog.open) dialog.showModal();
    if (!menuOpen && dialog.open) dialog.close();
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);
  useEffect(() => {
    if (productMenu.current) productMenu.current.open = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
    const metadata = pageMetadata[pathname] || (pathname.startsWith('/san-pham/')
      ? { title: 'Chi tiết sản phẩm gốm Chu Đậu | TRO & LAM', description: 'Thông tin sản phẩm gốm Chu Đậu do TRO & LAM công bố.' }
      : { title: isCollection ? 'Sản phẩm gốm Chu Đậu | TRO & LAM' : 'Gốm Chu Đậu | TRO & LAM', description: 'Khám phá các dòng gốm Chu Đậu và câu chuyện được TRO & LAM biên tập.' });
    document.title = metadata.title;
    setMetaDescription(metadata.description);
  }, [pathname, isCollection]);
  function closeMenu() { setMenuOpen(false); menuButton.current?.focus(); }
  return <div className="public-site">
    <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
    <div className="brand-ribbon">TỪ ĐẤT VÀ LỬA, GỬI MỘT SẮC LAM</div>
    <header className="catalog-header">
      <div className="catalog-header__inner"><Brand />
        <nav className="catalog-nav" aria-label="Điều hướng chính">{links.map((link) => link.to === '/san-pham'
          ? <div className="nav-products" key={link.to}><NavLink to={link.to} className={isCollection ? 'active' : undefined}>Sản phẩm</NavLink><details ref={productMenu} onKeyDown={(event) => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary').focus(); } }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}><summary aria-label="Mở các dòng sản phẩm"><Icon name="chevron" size={15} /></summary><div className="product-dropdown">{collections.map((item) => <Link key={item.to} to={item.to} onClick={() => { productMenu.current.open = false; }}>{item.label}<Icon name="arrow" size={16} /></Link>)}</div></details></div>
          : <NavLink key={link.to} to={link.to} end={link.to === '/'}>{link.label}</NavLink>)}</nav>
        <div className="catalog-header__actions"><button className="icon-button" aria-label={searchOpen ? 'Đóng tìm kiếm' : 'Mở tìm kiếm'} aria-expanded={searchOpen} aria-controls={searchOpen ? 'header-search-panel' : undefined} onClick={() => setSearchOpen(!searchOpen)}><Icon name={searchOpen ? 'close' : 'search'} /></button><Link className="catalog-header__icon-link" to="/tai-khoan" aria-label="Tài khoản"><Icon name="user" /></Link><Link className="catalog-header__icon-link" to="/gio-hang" aria-label="Giỏ hàng"><Icon name="bag" /></Link></div>
        <button ref={menuButton} className="menu-toggle" aria-label="Mở điều hướng" aria-expanded={menuOpen} aria-haspopup="dialog" onClick={() => setMenuOpen(true)}><Icon name="menu" /></button>
      </div>
      {searchOpen && <div id="header-search-panel" className="header-search-panel" onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); }}><HeaderSearch onSubmitted={() => setSearchOpen(false)} /></div>}
      <dialog className="mobile-menu" ref={menuDialog} aria-label="Điều hướng" onCancel={(event) => { event.preventDefault(); closeMenu(); }} onClick={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left) closeMenu(); } }}>
        <div className="mobile-menu__top"><Brand /><button className="icon-button" onClick={closeMenu} aria-label="Đóng điều hướng"><Icon name="close" /></button></div>
        <HeaderSearch mobile onSubmitted={closeMenu} /><nav aria-label="Điều hướng điện thoại">{links.map((link) => <div key={link.to}><NavLink to={link.to} end={link.to === '/'} onClick={closeMenu}>{link.label}<Icon name="arrow" size={18} /></NavLink>{link.to === '/san-pham' && <div className="mobile-collections">{collections.slice(1).map((item) => <Link key={item.to} to={item.to} onClick={closeMenu}>{item.label}</Link>)}</div>}</div>)}<Link to="/tai-khoan" onClick={closeMenu}>Tài khoản<Icon name="user" /></Link></nav><p className="menu-signoff">Gốm trong đời sống.<br />Sắc lam trong từng khoảnh khắc.</p>
      </dialog>
    </header>
    <main id="main-content" className="catalog-main"><Outlet /></main>
    <footer className="catalog-footer">
      <div className="footer-invitation"><div><p className="eyebrow">MỘT MÓN GỐM, MỘT LỜI GỬI GẮM</p><h2>Cùng tìm một món quà có ý nghĩa.</h2></div><Link className="button button--light" to="/lien-he">Trò chuyện cùng chúng tôi <Icon name="arrow" size={18} /></Link></div>
      <div className="footer-columns"><div className="footer-about"><Brand /><p>TRO & LAM mang gốm Chu Đậu đến gần hơn với không gian sống và những dịp trao tặng.</p><span className="footer-signature">Giữ nét xưa. Chạm hôm nay.</span></div>
        <div><h3>Khám phá</h3><nav aria-label="Khám phá cuối trang">{links.map((link) => <Link key={link.to} to={link.to}>{link.label}</Link>)}</nav></div>
        <div><h3>Đồng hành cùng bạn</h3><nav aria-label="Hỗ trợ cuối trang"><Link to="/tra-cuu-don-hang">Tra cứu đơn hàng</Link><Link to="/tai-khoan">Tài khoản của bạn</Link><Link to="/gio-hang">Giỏ hàng</Link><Link to="/lien-he">Hỗ trợ mua hàng</Link></nav></div>
        <div><h3>Kết nối với TRO & LAM</h3><p>Chọn gốm cho ngôi nhà, hay một món quà cho đối tác? Chúng tôi luôn sẵn lòng lắng nghe.</p><Link className="footer-contact" to="/lien-he">Gửi lời nhắn <Icon name="arrow" size={18} /></Link><Link className="footer-contact" to="/qua-tang-doanh-nghiep">Quà tặng doanh nghiệp <Icon name="gift" size={18} /></Link></div>
      </div><div className="footer-bottom"><span>© {new Date().getFullYear()} TRO & LAM</span><span>Gốm Chu Đậu · Văn hóa Việt</span><Link to="/nguon-tu-lieu">Nguồn hình ảnh & phim</Link></div>
    </footer>
    {!/^\/(?:admin|staff)(?:\/|$)/u.test(pathname) && <AssistantWidget />}
  </div>;
}
