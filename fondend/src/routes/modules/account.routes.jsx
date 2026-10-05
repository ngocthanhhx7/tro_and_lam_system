import AddressBookPage from '../../pages/account/addresses/AddressBookPage.jsx';
import CartPage from '../../pages/cart/CartPage.jsx';
import IdentityRouteGuard from '../../pages/identity/IdentityRouteGuard.jsx';

export const accountRoutes = Object.freeze([
  { path: '/gio-hang', element: <CartPage /> },
  { path: '/tai-khoan/dia-chi', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><AddressBookPage /></IdentityRouteGuard> },
]);
