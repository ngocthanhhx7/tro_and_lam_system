import { lazy } from 'react';
import IdentityRouteGuard from '../../pages/identity/IdentityRouteGuard.jsx';

const identityPages = () => import('../../pages/identity/IdentityPages.jsx');
const AcceptInvitationPage = lazy(() => identityPages().then((module) => ({ default: module.AcceptInvitationPage })));
const ForgotPasswordPage = lazy(() => identityPages().then((module) => ({ default: module.ForgotPasswordPage })));
const LoginPage = lazy(() => identityPages().then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => identityPages().then((module) => ({ default: module.RegisterPage })));
const ResetPasswordPage = lazy(() => identityPages().then((module) => ({ default: module.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => identityPages().then((module) => ({ default: module.VerifyEmailPage })));
const BlockedAppealPage = lazy(() => import('../../pages/identity/BlockedAppealPage.jsx'));
const ProfilePage = lazy(() => import('../../pages/account/ProfilePage.jsx'));
const CustomerAccountLayout = lazy(() => import('../../components/account/CustomerAccountLayout.jsx'));
const AdminUsersPage = lazy(() => import('../../pages/admin/users/AdminUsersPage.jsx'));
const AdminUserDetailPage = lazy(() => import('../../pages/admin/users/AdminUserDetailPage.jsx'));
const AdminAppealsPage = lazy(() => import('../../pages/admin/appeals/AdminAppealsPage.jsx'));
const AdminAppealDetailPage = lazy(() => import('../../pages/admin/appeals/AdminAppealDetailPage.jsx'));

export const identityRoutes = Object.freeze([
  { path: '/dang-nhap', element: <LoginPage /> },
  { path: '/dang-ky', element: <RegisterPage /> },
  { path: '/quen-mat-khau', element: <ForgotPasswordPage /> },
  { path: '/dat-lai-mat-khau', element: <ResetPasswordPage /> },
  { path: '/xac-minh-email', element: <VerifyEmailPage /> },
  { path: '/chap-nhan-loi-moi', element: <AcceptInvitationPage /> },
  { path: '/tai-khoan/bi-khoa', element: <BlockedAppealPage /> },
  { path: '/tai-khoan/ho-so', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><CustomerAccountLayout><ProfilePage /></CustomerAccountLayout></IdentityRouteGuard> },
  { path: '/admin/users', element: <IdentityRouteGuard roles={['admin']}><AdminUsersPage /></IdentityRouteGuard> },
  { path: '/admin/employees', element: <IdentityRouteGuard roles={['admin']}><AdminUsersPage key="employees" initialRole="staff" /></IdentityRouteGuard> },
  { path: '/admin/users/:id', element: <IdentityRouteGuard roles={['admin']}><AdminUserDetailPage /></IdentityRouteGuard> },
  { path: '/admin/appeals', element: <IdentityRouteGuard roles={['admin']}><AdminAppealsPage /></IdentityRouteGuard> },
  { path: '/admin/appeals/:id', element: <IdentityRouteGuard roles={['admin']}><AdminAppealDetailPage /></IdentityRouteGuard> },
]);
