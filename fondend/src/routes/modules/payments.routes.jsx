import IdentityRouteGuard from '../../pages/identity/IdentityRouteGuard.jsx';
import AdminRefundsPage from '../../pages/admin/refunds/AdminRefundsPage.jsx';
import PaymentCancelPage from '../../pages/payment/PaymentCancelPage.jsx';
import PaymentReturnPage from '../../pages/payment/PaymentReturnPage.jsx';

export const paymentRoutes = Object.freeze([
  { path: '/payment/return', element: <PaymentReturnPage /> },
  { path: '/payment/cancel', element: <PaymentCancelPage /> },
  { path: '/admin/refunds', element: <IdentityRouteGuard roles={['admin']}><AdminRefundsPage /></IdentityRouteGuard> },
]);
