import { lazy } from 'react';
import { Route } from 'react-router-dom';
import PublicCatalogLayout from '../../layouts/PublicCatalogLayout.jsx';
import IdentityRouteGuard from '../../pages/identity/IdentityRouteGuard.jsx';
import '../../styles/catalog.css';

const CatalogHomePage = lazy(() => import('../../pages/public/CatalogHomePage.jsx'));
const ProductCatalogPage = lazy(() => import('../../pages/catalog/ProductCatalogPage.jsx'));
const CuratedProductListingPage = lazy(() => import('../../pages/catalog/CuratedProductListingPage.jsx'));
const ProductDetailPage = lazy(() => import('../../pages/public/ProductDetailPage.jsx'));
const AdminCatalogPage = lazy(() => import('../../pages/admin/catalog/AdminCatalogPage.jsx'));

export const catalogRoutes = [
  <Route key="catalog-public-shell" path="/" element={<PublicCatalogLayout />}>
    <Route index element={<CatalogHomePage />} />
    <Route path="san-pham" element={<CuratedProductListingPage />} />
    <Route path="san-pham/:slug" element={<ProductDetailPage />} />
    <Route path="bo-suu-tap/:line" element={<ProductCatalogPage />} />
  </Route>,
  <Route key="admin-products" path="/admin/products" element={<IdentityRouteGuard roles={['admin']}><AdminCatalogPage /></IdentityRouteGuard>} />,
  <Route key="admin-product-new" path="/admin/products/new" element={<IdentityRouteGuard roles={['admin']}><AdminCatalogPage /></IdentityRouteGuard>} />,
  <Route key="admin-product-edit" path="/admin/products/:id/edit" element={<IdentityRouteGuard roles={['admin']}><AdminCatalogPage /></IdentityRouteGuard>} />,
  <Route key="admin-categories" path="/admin/categories" element={<IdentityRouteGuard roles={['admin']}><AdminCatalogPage initialTab="categories" /></IdentityRouteGuard>} />,
];
