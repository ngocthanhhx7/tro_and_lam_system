import { Children, cloneElement, lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import IdentityRouteGuard from '../pages/identity/IdentityRouteGuard.jsx';
import AdminLayout from '../layouts/AdminLayout.jsx';
import PublicAreaGuard from '../pages/identity/PublicAreaGuard.jsx';
import { useAuth } from '../contexts/auth.context.js';
import RouteErrorBoundary from '../components/errors/RouteErrorBoundary.jsx';
import HttpErrorPage from '../pages/HttpErrorPage.jsx';
import { setPageIndexability } from '../utils/pageMetadata.js';
import { identityRoutes } from './modules/identity.routes.jsx';
import { accountRoutes } from './modules/account.routes.jsx';
import { catalogRoutes } from './modules/catalog.routes.jsx';
import { adminContentRouteFragments, publicContentRouteFragments } from './modules/content.routes.jsx';
import { operationsRoutes } from './modules/operations.routes.jsx';
import { commerceRoutes } from './modules/commerce.routes.jsx';
import { paymentRoutes } from './modules/payments.routes.jsx';
import { supportRoutes } from './modules/support.routes.jsx';

const NotFoundPage = lazy(() => import('../pages/NotFoundPage.jsx'));
const ERROR_STATUSES = Object.freeze([400, 401, 403, 404, 405, 408, 409, 413, 422, 429, 500, 502, 503, 504]);
const editorialPages = () => import('../pages/public/EditorialPages.jsx');
const AboutPage = lazy(() => editorialPages().then((module) => ({ default: module.AboutPage })));
const StoriesLandingPage = lazy(() => editorialPages().then((module) => ({ default: module.StoriesLandingPage })));
const MediaCreditsPage = lazy(() => editorialPages().then((module) => ({ default: module.MediaCreditsPage })));
const ProfilePage = lazy(() => import('../pages/account/ProfilePage.jsx'));
const ChangePasswordPage = lazy(() => import('../pages/account/ChangePasswordPage.jsx'));
const NotificationsPage = lazy(() => import('../pages/notifications/NotificationsPage.jsx'));
const StaffOrdersPage = lazy(() => import('../pages/staff/orders/StaffOrdersPage.jsx'));

const INDEXABLE_PATHS = Object.freeze([
  /^\/$/u,
  /^\/san-pham(?:\/[^/]+)?$/u,
  /^\/bo-suu-tap\/(?:lifestyle|diplomacy)$/u,
  /^\/(?:ve-chung-toi|cau-chuyen|nguon-tu-lieu|lien-he|qua-tang-doanh-nghiep)$/u,
  /^\/cau-chuyen\/[^/]+$/u,
  /^\/trang\/[^/]+$/u,
  /^\/nfc\/[^/]+$/u,
]);

function isIndexablePath(pathname) {
  return INDEXABLE_PATHS.some((pattern) => pattern.test(pathname));
}

function adminLayoutRoute(route) {
  const path = route.path.startsWith('/') ? route.path : `/${route.path}`;
  const guardedElement = route.element.type === IdentityRouteGuard
    ? cloneElement(route.element, { hideWorkspaceSession: true }, <AdminLayout>{route.element.props.children}</AdminLayout>)
    : <IdentityRouteGuard roles={['admin']} hideWorkspaceSession><AdminLayout>{route.element}</AdminLayout></IdentityRouteGuard>;
  return <Route key={route.path} path={path} element={guardedElement} />;
}

function guardedOperationsRoute(route) {
  const isAdminRoute = route.path.startsWith('/admin');
  const roles = isAdminRoute
    ? ['admin']
    : route.path.startsWith('/staff') ? ['staff'] : ['customer', 'staff', 'admin'];
  const element = isAdminRoute || route.path.startsWith('/staff')
    ? <IdentityRouteGuard roles={roles} hideWorkspaceSession><AdminLayout>{route.element}</AdminLayout></IdentityRouteGuard>
    : <IdentityRouteGuard roles={roles}>{route.element}</IdentityRouteGuard>;
  return <Route key={route.path} path={route.path.slice(1)} element={element} />;
}

export default function AppRoutes() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  useEffect(() => {
    setPageIndexability(isIndexablePath(pathname));
  }, [pathname]);

  const [catalogShell, ...adminCatalogRoutes] = catalogRoutes;
  const publicChildren = [
    ...Children.toArray(catalogShell.props.children),
    ...publicContentRouteFragments.map((route) => <Route key={route.path} path={route.path} element={route.element} />),
    ...accountRoutes.map((route) => <Route key={route.path} path={route.path.slice(1)} element={route.element} />),
    ...identityRoutes.filter((route) => !route.path.startsWith('/admin/') && !accountRoutes.some((account) => account.path === route.path)).map((route) => <Route key={route.path} path={route.path.slice(1)} element={route.element} />),
    ...commerceRoutes.filter((route) => !route.path.startsWith('/staff/')).map((route) => <Route key={route.path} path={route.path.slice(1)} element={route.element} />),
    ...supportRoutes.filter((route) => !route.path.startsWith('/admin/') && !route.path.startsWith('/staff/')).map((route) => <Route key={route.path} path={route.path.slice(1)} element={route.element} />),
    ...paymentRoutes.filter((route) => route.path.startsWith('/payment/')).map((route) => <Route key={route.path} path={route.path.slice(1)} element={route.element} />),
    ...operationsRoutes.filter((route) => route.path.startsWith('/tai-khoan/')).map(guardedOperationsRoute),
    <Route key="story-landing" path="cau-chuyen" element={<StoriesLandingPage />} />,
    <Route key="about" path="ve-chung-toi" element={<AboutPage />} />,
    <Route key="media-credits" path="nguon-tu-lieu" element={<MediaCreditsPage />} />,
    <Route key="not-found" path="*" element={<NotFoundPage />} />,
  ];
  const integratedCatalogShell = cloneElement(catalogShell, { element: <PublicAreaGuard>{catalogShell.props.element}</PublicAreaGuard> }, publicChildren);
  const workspaceRoute = (route) => {
    const guarded = route.element;
    return <Route key={route.path} path={route.path} element={cloneElement(guarded, { hideWorkspaceSession: true }, <AdminLayout>{guarded.props.children}</AdminLayout>)} />;
  };

  return <Suspense fallback={<div className="route-loading" role="status" aria-live="polite">Đang mở trang…</div>}>
    <RouteErrorBoundary key={pathname}>
    <Routes>
      {integratedCatalogShell}
      {adminCatalogRoutes.map((route) => {
        const guarded = route.props.element;
        const shell = cloneElement(guarded, { hideWorkspaceSession: true }, <AdminLayout>{guarded.props.children}</AdminLayout>);
        return <Route key={route.key} path={route.props.path} element={shell} />;
      })}
      {ERROR_STATUSES.flatMap((status) => ['loi/', ''].map((prefix) => <Route key={`${prefix}${status}`} path={`/${prefix}${status}`} element={user?.role === 'admin' || user?.role === 'staff' ? <AdminLayout><HttpErrorPage status={status} embedded /></AdminLayout> : <HttpErrorPage status={status} />} />))}
      {['admin', 'staff'].flatMap((role) => [
        <Route key={`${role}-profile`} path={`/${role}/account/profile`} element={<IdentityRouteGuard roles={[role]} hideWorkspaceSession><AdminLayout><ProfilePage /></AdminLayout></IdentityRouteGuard>} />,
        <Route key={`${role}-password`} path={`/${role}/account/password`} element={<IdentityRouteGuard roles={[role]} hideWorkspaceSession><AdminLayout><ChangePasswordPage /></AdminLayout></IdentityRouteGuard>} />,
        <Route key={`${role}-notifications`} path={`/${role}/notifications`} element={<IdentityRouteGuard roles={[role]} hideWorkspaceSession><AdminLayout><NotificationsPage /></AdminLayout></IdentityRouteGuard>} />,
      ])}
      <Route path="/admin/orders" element={<IdentityRouteGuard roles={['admin']} hideWorkspaceSession><AdminLayout><StaffOrdersPage /></AdminLayout></IdentityRouteGuard>} />
      <Route path="/admin/orders/:id" element={<IdentityRouteGuard roles={['admin']} hideWorkspaceSession><AdminLayout><StaffOrdersPage /></AdminLayout></IdentityRouteGuard>} />
      <Route path="/staff/*" element={<IdentityRouteGuard roles={['staff']} hideWorkspaceSession><AdminLayout><NotFoundPage /></AdminLayout></IdentityRouteGuard>} />
      <Route path="/admin/*" element={<IdentityRouteGuard roles={['admin']} hideWorkspaceSession><AdminLayout><NotFoundPage /></AdminLayout></IdentityRouteGuard>} />
      {commerceRoutes.filter((route) => route.path.startsWith('/staff/')).map(workspaceRoute)}
      {supportRoutes.filter((route) => route.path.startsWith('/staff/')).map(workspaceRoute)}
      {operationsRoutes.filter((route) => route.path === '/staff' || route.path.startsWith('/staff/') || route.path === '/admin' || route.path.startsWith('/admin/')).map(guardedOperationsRoute)}
      {supportRoutes.filter((route) => route.path.startsWith('/admin/')).map(adminLayoutRoute)}
      {paymentRoutes.filter((route) => route.path.startsWith('/admin/')).map(adminLayoutRoute)}
    {adminContentRouteFragments.map((route) => <Route
      key={route.path}
      path={`/${route.path}`}
      element={<IdentityRouteGuard roles={['admin']} hideWorkspaceSession><AdminLayout>{route.element}</AdminLayout></IdentityRouteGuard>}
    />)}
    {identityRoutes.filter((route) => route.path.startsWith('/admin/')).map(adminLayoutRoute)}
    </Routes>
    </RouteErrorBoundary>
  </Suspense>;
}
