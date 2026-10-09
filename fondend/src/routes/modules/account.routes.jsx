import { lazy } from 'react';
import IdentityRouteGuard from '../../pages/identity/IdentityRouteGuard.jsx';

const AddressBookPage = lazy(() => import('../../pages/account/addresses/AddressBookPage.jsx'));
const CartPage = lazy(() => import('../../pages/cart/CartPage.jsx'));
const CustomerAccountHomePage = lazy(() => import('../../pages/account/CustomerAccountHomePage.jsx'));
const ChangePasswordPage = lazy(() => import('../../pages/account/ChangePasswordPage.jsx'));
const VoucherWalletPage = lazy(() => import('../../pages/account/VoucherWalletPage.jsx'));
const CustomerAccountLayout = lazy(() => import('../../components/account/CustomerAccountLayout.jsx'));

export const accountRoutes = Object.freeze([
  { path: '/gio-hang', element: <CartPage /> },
  { path: '/tai-khoan', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><CustomerAccountHomePage /></IdentityRouteGuard> },
  { path: '/tai-khoan/dia-chi', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><CustomerAccountLayout><AddressBookPage /></CustomerAccountLayout></IdentityRouteGuard> },
  { path: '/tai-khoan/doi-mat-khau', element: <IdentityRouteGuard roles={['customer', 'staff', 'admin']}><CustomerAccountLayout><ChangePasswordPage /></CustomerAccountLayout></IdentityRouteGuard> },
  { path: '/tai-khoan/voucher', element: <IdentityRouteGuard roles={['customer']}><CustomerAccountLayout><VoucherWalletPage /></CustomerAccountLayout></IdentityRouteGuard> },
]);
