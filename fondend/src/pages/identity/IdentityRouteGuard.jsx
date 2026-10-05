import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import './identity.css';

export default function IdentityRouteGuard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <main className="identity-route-state" role="status">Đang kiểm tra phiên đăng nhập…</main>;
  if (!user) return <Navigate to="/dang-nhap" replace />;
  if (user.status === 'blocked') return <Navigate to="/tai-khoan/bi-khoa" replace />;
  if (roles && !roles.includes(user.role)) return <main className="identity-route-state"><h1>Không đủ quyền truy cập</h1><p>Tài khoản này không có quyền mở trang.</p></main>;
  return children;
}
