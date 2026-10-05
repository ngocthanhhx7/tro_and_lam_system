import { Route } from 'react-router-dom';
import PublicCatalogLayout from '../../layouts/PublicCatalogLayout.jsx';
import CatalogHomePage from '../../pages/public/CatalogHomePage.jsx';
import ProductCatalogPage from '../../pages/catalog/ProductCatalogPage.jsx';
import ProductDetailPage from '../../pages/public/ProductDetailPage.jsx';
import AdminCatalogPage from '../../pages/admin/catalog/AdminCatalogPage.jsx';
import IdentityRouteGuard from '../../pages/identity/IdentityRouteGuard.jsx';
import '../../styles/catalog.css';

export const catalogRoutes = [
  <Route key="catalog-public-shell" path="/" element={<PublicCatalogLayout />}>
    <Route index element={<CatalogHomePage />} />
    <Route path="san-pham" element={<ProductCatalogPage />} />
    <Route path="san-pham/:slug" element={<ProductDetailPage />} />
    <Route path="bo-suu-tap/:line" element={<ProductCatalogPage />} />
  </Route>,
  <Route key="admin-products" path="/admin/products" element={<IdentityRouteGuard roles={['admin']}><AdminCatalogPage /></IdentityRouteGuard>} />,
  <Route key="admin-product-new" path="/admin/products/new" element={<IdentityRouteGuard roles={['admin']}><AdminCatalogPage /></IdentityRouteGuard>} />,
  <Route key="admin-product-edit" path="/admin/products/:id/edit" element={<IdentityRouteGuard roles={['admin']}><AdminCatalogPage /></IdentityRouteGuard>} />,
  <Route key="admin-categories" path="/admin/categories" element={<IdentityRouteGuard roles={['admin']}><AdminCatalogPage initialTab="categories" /></IdentityRouteGuard>} />,
];
