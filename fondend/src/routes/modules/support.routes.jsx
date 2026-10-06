import ContactPage from '../../pages/support/ContactPage.jsx';
import CustomerReviewsPage, { PublicProductReviews } from '../../pages/support/CustomerReviewsPage.jsx';
import CustomerSupportPage, { GuestOrderSupportPage } from '../../pages/support/CustomerSupportPage.jsx';
import AdminReviewsPage from '../../pages/support/AdminReviewsPage.jsx';
import StaffContactsPage from '../../pages/support/StaffContactsPage.jsx';
import StaffSupportPage from '../../pages/support/StaffSupportPage.jsx';
import IdentityRouteGuard from '../../pages/identity/IdentityRouteGuard.jsx';

export const publicReviewComponent = PublicProductReviews;

export const supportRoutes = [
  { path: '/lien-he', element: <ContactPage /> },
  { path: '/qua-tang-doanh-nghiep', element: <ContactPage corporate /> },
  { path: '/ho-tro-don-hang/:orderId', element: <GuestOrderSupportPage /> },
  { path: '/tai-khoan/ho-tro', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><CustomerSupportPage /></IdentityRouteGuard> },
  { path: '/tai-khoan/ho-tro/:id', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><CustomerSupportPage /></IdentityRouteGuard> },
  { path: '/tai-khoan/danh-gia', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><CustomerReviewsPage /></IdentityRouteGuard> },
  { path: '/staff/support', element: <IdentityRouteGuard roles={['staff', 'admin']}><StaffSupportPage /></IdentityRouteGuard> },
  { path: '/staff/support/:id', element: <IdentityRouteGuard roles={['staff', 'admin']}><StaffSupportPage /></IdentityRouteGuard> },
  { path: '/staff/contacts', element: <IdentityRouteGuard roles={['staff', 'admin']}><StaffContactsPage /></IdentityRouteGuard> },
  { path: '/admin/reviews', element: <IdentityRouteGuard roles={['admin']}><AdminReviewsPage /></IdentityRouteGuard> },
];
