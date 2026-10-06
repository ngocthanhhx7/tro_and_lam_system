import { lazy } from 'react';
import IdentityRouteGuard from '../../pages/identity/IdentityRouteGuard.jsx';

const ContactPage = lazy(() => import('../../pages/support/ContactPage.jsx'));
const customerReviewsPage = () => import('../../pages/support/CustomerReviewsPage.jsx');
const CustomerReviewsPage = lazy(() => customerReviewsPage());
const PublicProductReviews = lazy(() => customerReviewsPage().then((module) => ({ default: module.PublicProductReviews })));
const customerSupportPage = () => import('../../pages/support/CustomerSupportPage.jsx');
const CustomerSupportPage = lazy(() => customerSupportPage());
const GuestOrderSupportPage = lazy(() => customerSupportPage().then((module) => ({ default: module.GuestOrderSupportPage })));
const GuestTicketThreadPage = lazy(() => customerSupportPage().then((module) => ({ default: module.GuestTicketThreadPage })));
const AdminReviewsPage = lazy(() => import('../../pages/support/AdminReviewsPage.jsx'));
const StaffContactsPage = lazy(() => import('../../pages/support/StaffContactsPage.jsx'));
const StaffSupportPage = lazy(() => import('../../pages/support/StaffSupportPage.jsx'));

export const publicReviewComponent = PublicProductReviews;

export const supportRoutes = [
  { path: '/lien-he', element: <ContactPage /> },
  { path: '/qua-tang-doanh-nghiep', element: <ContactPage corporate /> },
  { path: '/ho-tro-don-hang/:orderId', element: <GuestOrderSupportPage /> },
  { path: '/ho-tro/:id', element: <GuestTicketThreadPage /> },
  { path: '/tai-khoan/ho-tro', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><CustomerSupportPage /></IdentityRouteGuard> },
  { path: '/tai-khoan/ho-tro/:id', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><CustomerSupportPage /></IdentityRouteGuard> },
  { path: '/tai-khoan/danh-gia', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><CustomerReviewsPage /></IdentityRouteGuard> },
  { path: '/staff/support', element: <IdentityRouteGuard roles={['staff', 'admin']}><StaffSupportPage /></IdentityRouteGuard> },
  { path: '/staff/support/:id', element: <IdentityRouteGuard roles={['staff', 'admin']}><StaffSupportPage /></IdentityRouteGuard> },
  { path: '/staff/contacts', element: <IdentityRouteGuard roles={['staff', 'admin']}><StaffContactsPage /></IdentityRouteGuard> },
  { path: '/admin/reviews', element: <IdentityRouteGuard roles={['admin']}><AdminReviewsPage /></IdentityRouteGuard> },
];
