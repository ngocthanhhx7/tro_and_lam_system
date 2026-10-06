import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import LogoutButton from '../../components/identity/LogoutButton.jsx';
import './identity.css';

export default function IdentityRouteGuard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <main className="identity-route-state" role="status">Đang kiểm tra phiên đăng nhập…</main>;
  if (!user) return <Navigate to="/dang-nhap" replace />;
  if (user.status === 'blocked') return <Navigate to="/tai-khoan/bi-khoa" replace />;
  if (roles && !roles.includes(user.role)) return <main className="identity-route-state"><h1>Không đủ quyền truy cập</h1><p>Tài khoản này không có quyền mở trang.</p></main>;
  const workspaceHome = user.role === 'admin' ? '/admin' : user.role === 'staff' ? '/staff' : null;
  return <>
    {workspaceHome && <div className="identity-workspace-session" role="group" aria-label="Phiên làm việc">
      <Link className="identity-workspace-session__home" to={workspaceHome}>{user.role === 'admin' ? 'TRO & LAM · Quản trị' : 'TRO & LAM · Vận hành'}</Link>
      <span className="identity-workspace-session__user">{user.name}</span>
      <LogoutButton variant="workspace" destination="/dang-nhap" />
    </div>}
    {children}
  </>;
}
