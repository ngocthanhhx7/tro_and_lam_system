import { AcceptInvitationPage, ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage, VerifyEmailPage } from '../../pages/identity/IdentityPages.jsx';
import BlockedAppealPage from '../../pages/identity/BlockedAppealPage.jsx';
import IdentityRouteGuard from '../../pages/identity/IdentityRouteGuard.jsx';
import ProfilePage from '../../pages/account/ProfilePage.jsx';
import AdminUsersPage from '../../pages/admin/users/AdminUsersPage.jsx';
import AdminUserDetailPage from '../../pages/admin/users/AdminUserDetailPage.jsx';
import AdminAppealsPage from '../../pages/admin/appeals/AdminAppealsPage.jsx';
import AdminAppealDetailPage from '../../pages/admin/appeals/AdminAppealDetailPage.jsx';

export const identityRoutes = Object.freeze([
  { path: '/dang-nhap', element: <LoginPage /> },
  { path: '/dang-ky', element: <RegisterPage /> },
  { path: '/quen-mat-khau', element: <ForgotPasswordPage /> },
  { path: '/dat-lai-mat-khau', element: <ResetPasswordPage /> },
  { path: '/xac-minh-email', element: <VerifyEmailPage /> },
  { path: '/chap-nhan-loi-moi', element: <AcceptInvitationPage /> },
  { path: '/tai-khoan/bi-khoa', element: <BlockedAppealPage /> },
  { path: '/tai-khoan/ho-so', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><ProfilePage /></IdentityRouteGuard> },
  { path: '/admin/users', element: <IdentityRouteGuard roles={['admin']}><AdminUsersPage /></IdentityRouteGuard> },
  { path: '/admin/users/:id', element: <IdentityRouteGuard roles={['admin']}><AdminUserDetailPage /></IdentityRouteGuard> },
  { path: '/admin/appeals', element: <IdentityRouteGuard roles={['admin']}><AdminAppealsPage /></IdentityRouteGuard> },
  { path: '/admin/appeals/:id', element: <IdentityRouteGuard roles={['admin']}><AdminAppealDetailPage /></IdentityRouteGuard> },
]);
