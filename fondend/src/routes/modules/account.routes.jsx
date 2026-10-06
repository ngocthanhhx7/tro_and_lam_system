import { lazy } from 'react';
import IdentityRouteGuard from '../../pages/identity/IdentityRouteGuard.jsx';

const AddressBookPage = lazy(() => import('../../pages/account/addresses/AddressBookPage.jsx'));
const CartPage = lazy(() => import('../../pages/cart/CartPage.jsx'));

export const accountRoutes = Object.freeze([
  { path: '/gio-hang', element: <CartPage /> },
  { path: '/tai-khoan/dia-chi', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><AddressBookPage /></IdentityRouteGuard> },
]);
