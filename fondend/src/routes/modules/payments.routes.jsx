import { lazy } from 'react';
import IdentityRouteGuard from '../../pages/identity/IdentityRouteGuard.jsx';

const AdminRefundsPage = lazy(() => import('../../pages/admin/refunds/AdminRefundsPage.jsx'));
const PaymentCancelPage = lazy(() => import('../../pages/payment/PaymentCancelPage.jsx'));
const PaymentReturnPage = lazy(() => import('../../pages/payment/PaymentReturnPage.jsx'));

export const paymentRoutes = Object.freeze([
  { path: '/payment/return', element: <PaymentReturnPage /> },
  { path: '/payment/cancel', element: <PaymentCancelPage /> },
  { path: '/admin/refunds', element: <IdentityRouteGuard roles={['admin']}><AdminRefundsPage /></IdentityRouteGuard> },
]);
