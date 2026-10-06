import { Children, cloneElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import IdentityRouteGuard from '../pages/identity/IdentityRouteGuard.jsx';
import PublishedPage from '../pages/stories/PublishedPage.jsx';
import { identityRoutes } from './modules/identity.routes.jsx';
import { accountRoutes } from './modules/account.routes.jsx';
import { catalogRoutes } from './modules/catalog.routes.jsx';
import { adminContentRouteFragments, publicContentRouteFragments } from './modules/content.routes.jsx';
import { operationsRoutes } from './modules/operations.routes.jsx';

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
    ...operationsRoutes.map(guardedOperationsRoute),
    <Route key="story-landing" path="cau-chuyen" element={<PublishedPage pageSlug="cau-chuyen" />} />,
  ];
  const integratedCatalogShell = cloneElement(catalogShell, undefined, publicChildren);

  return <Routes>
    <Route element={<MainLayout />}>
      <Route path="*" element={<NotFoundPage />} />
    </Route>
    {integratedCatalogShell}
    {adminCatalogRoutes}
    {adminContentRouteFragments.map((route) => <Route
      key={route.path}
      path={`/${route.path}`}
      element={<IdentityRouteGuard roles={['admin']}>{route.element}</IdentityRouteGuard>}
    />)}
    {identityRoutes.map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
    <Route path="/tai-khoan" element={<Navigate to="/tai-khoan/ho-so" replace />} />
  </Routes>;
}
