import { Children, cloneElement, lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import IdentityRouteGuard from '../pages/identity/IdentityRouteGuard.jsx';
import { identityRoutes } from './modules/identity.routes.jsx';
import { accountRoutes } from './modules/account.routes.jsx';
import { catalogRoutes } from './modules/catalog.routes.jsx';
import { adminContentRouteFragments, publicContentRouteFragments } from './modules/content.routes.jsx';
import { operationsRoutes } from './modules/operations.routes.jsx';
import { commerceRoutes } from './modules/commerce.routes.jsx';
import { paymentRoutes } from './modules/payments.routes.jsx';
import { supportRoutes } from './modules/support.routes.jsx';

const NotFoundPage = lazy(() => import('../pages/NotFoundPage.jsx'));
const editorialPages = () => import('../pages/public/EditorialPages.jsx');
const AboutPage = lazy(() => editorialPages().then((module) => ({ default: module.AboutPage })));
const StoriesLandingPage = lazy(() => editorialPages().then((module) => ({ default: module.StoriesLandingPage })));
const MediaCreditsPage = lazy(() => editorialPages().then((module) => ({ default: module.MediaCreditsPage })));

function guardedOperationsRoute(route) {
  const roles = route.path.startsWith('/admin')
    ? ['admin']
    : route.path.startsWith('/staff') ? ['staff', 'admin'] : ['customer', 'staff', 'admin'];
  return <Route
    key={route.path}
    path={route.path.slice(1)}
    element={<IdentityRouteGuard roles={roles}>{route.element}</IdentityRouteGuard>}
  />;
}

export default function AppRoutes() {
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
  const integratedCatalogShell = cloneElement(catalogShell, undefined, publicChildren);

  return <Suspense fallback={<div className="route-loading" role="status" aria-live="polite">Đang mở trang…</div>}>
    <Routes>
      {integratedCatalogShell}
      {adminCatalogRoutes}
      {commerceRoutes.filter((route) => route.path.startsWith('/staff/')).map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
      {supportRoutes.filter((route) => route.path.startsWith('/staff/')).map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
      {operationsRoutes.filter((route) => route.path === '/staff' || route.path.startsWith('/staff/') || route.path === '/admin' || route.path.startsWith('/admin/')).map(guardedOperationsRoute)}
      {supportRoutes.filter((route) => route.path.startsWith('/admin/')).map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
      {paymentRoutes.filter((route) => route.path.startsWith('/admin/')).map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
    {adminContentRouteFragments.map((route) => <Route
      key={route.path}
      path={`/${route.path}`}
      element={<IdentityRouteGuard roles={['admin']}>{route.element}</IdentityRouteGuard>}
    />)}
    {identityRoutes.filter((route) => route.path.startsWith('/admin/')).map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
    <Route path="/tai-khoan" element={<Navigate to="/tai-khoan/ho-so" replace />} />
    </Routes>
  </Suspense>;
}
