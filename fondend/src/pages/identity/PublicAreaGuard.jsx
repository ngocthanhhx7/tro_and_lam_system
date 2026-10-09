import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';

export default function PublicAreaGuard({ children }) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <div className="route-loading" role="status">Đang kiểm tra phiên đăng nhập…</div>;
  if (user?.role === 'admin' || user?.role === 'staff') {
    return <Navigate to={pathname === '/dang-nhap' ? `/${user.role}` : '/loi/403'} replace />;
  }
  return children;
}
