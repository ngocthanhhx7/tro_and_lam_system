import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import Icon from '../catalog/Icon.jsx';
import './customer-account.css';

const sections = Object.freeze([
  {
    label: 'Tài khoản của tôi',
    links: [
      { to: '/tai-khoan', label: 'Tổng quan', icon: 'user' },
      { to: '/tai-khoan/ho-so', label: 'Hồ sơ', icon: 'user' },
      { to: '/tai-khoan/dia-chi', label: 'Địa chỉ', icon: 'location' },
      { to: '/tai-khoan/doi-mat-khau', label: 'Đổi mật khẩu', icon: 'lock' },
    ],
  },
  {
    label: 'Hoạt động',
    links: [
      { to: '/tai-khoan/don-hang', label: 'Đơn mua', icon: 'bag' },
      { to: '/tai-khoan/voucher', label: 'Kho voucher', icon: 'ticket' },
      { to: '/tai-khoan/thong-bao', label: 'Thông báo', icon: 'bell' },
    ],
  },
]);

function initials(name = '') {
  return name.trim().split(/\s+/u).slice(-2).map((part) => part[0]?.toLocaleUpperCase('vi-VN')).join('') || 'KH';
}

export default function CustomerAccountLayout({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'customer') return children;

  return <div className="customer-account">
    <aside className="customer-account__sidebar" aria-label="Quản lý tài khoản customer">
      <div className="customer-account__identity">
        <span className="customer-account__avatar" aria-hidden="true">{initials(user.name)}</span>
        <div className="customer-account__identity-copy">
          <strong title={user.name}>{user.name}</strong>
          <NavLink to="/tai-khoan/ho-so">Chỉnh sửa hồ sơ</NavLink>
        </div>
      </div>
      <nav className="customer-account__nav" aria-label="Các mục tài khoản">
        {sections.map((section) => <section className="customer-account__nav-section" key={section.label}>
          <h2>{section.label}</h2>
          {section.links.map((link) => <NavLink
            className={({ isActive }) => `customer-account__nav-link${isActive ? ' is-active' : ''}`}
            key={link.to}
            to={link.to}
          ><Icon name={link.icon} size={18} /><span>{link.label}</span></NavLink>)}
        </section>)}
      </nav>
    </aside>
    <div className="customer-account__content">{children}</div>
  </div>;
}
