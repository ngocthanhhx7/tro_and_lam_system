import CheckoutPage from '../../pages/checkout/CheckoutPage.jsx';
import OrdersPage from '../../pages/account/orders/OrdersPage.jsx';
import GuestOrderAccessPage from '../../pages/guest/GuestOrderAccessPage.jsx';
import OrderDetailPage from '../../pages/guest/OrderDetailPage.jsx';
import StaffOrdersPage from '../../pages/staff/orders/StaffOrdersPage.jsx';
import IdentityRouteGuard from '../../pages/identity/IdentityRouteGuard.jsx';

export const commerceRoutes = Object.freeze([
  { path: '/thanh-toan', element: <CheckoutPage /> },
  { path: '/tra-cuu-don-hang', element: <GuestOrderAccessPage /> },
  { path: '/don-hang/:id', element: <OrderDetailPage /> },
  { path: '/tai-khoan/don-hang', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><OrdersPage /></IdentityRouteGuard> },
  { path: '/staff/orders', element: <IdentityRouteGuard roles={['staff', 'admin']}><StaffOrdersPage /></IdentityRouteGuard> },
]);
