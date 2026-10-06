import { lazy } from 'react';
import IdentityRouteGuard from '../../pages/identity/IdentityRouteGuard.jsx';

const CheckoutPage = lazy(() => import('../../pages/checkout/CheckoutPage.jsx'));
const OrdersPage = lazy(() => import('../../pages/account/orders/OrdersPage.jsx'));
const GuestOrderAccessPage = lazy(() => import('../../pages/guest/GuestOrderAccessPage.jsx'));
const OrderDetailPage = lazy(() => import('../../pages/guest/OrderDetailPage.jsx'));
const StaffOrdersPage = lazy(() => import('../../pages/staff/orders/StaffOrdersPage.jsx'));

export const commerceRoutes = Object.freeze([
  { path: '/thanh-toan', element: <CheckoutPage /> },
  { path: '/tra-cuu-don-hang', element: <GuestOrderAccessPage /> },
  { path: '/don-hang/:id', element: <OrderDetailPage /> },
  { path: '/tai-khoan/don-hang', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><OrdersPage /></IdentityRouteGuard> },
  { path: '/staff/orders', element: <IdentityRouteGuard roles={['staff', 'admin']}><StaffOrdersPage /></IdentityRouteGuard> },
]);
