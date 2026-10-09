import { lazy } from 'react';

const NotificationsPage = lazy(() => import('../../pages/notifications/NotificationsPage.jsx'));
const CustomerAccountLayout = lazy(() => import('../../components/account/CustomerAccountLayout.jsx'));
const StaffDashboardPage = lazy(() => import('../../pages/staff/dashboard/StaffDashboardPage.jsx'));
const AdminOverviewPage = lazy(() => import('../../pages/admin/overview/AdminOverviewPage.jsx'));
const AdminAuditPage = lazy(() => import('../../pages/admin/audit/AdminAuditPage.jsx'));
const AdminSettingsPage = lazy(() => import('../../pages/admin/settings/AdminSettingsPage.jsx'));
const AdminVouchersPage = lazy(() => import('../../pages/admin/vouchers/AdminVouchersPage.jsx'));

export const operationsRoutes = [
  { path: '/tai-khoan/thong-bao', element: <CustomerAccountLayout><NotificationsPage /></CustomerAccountLayout> },
  { path: '/staff', element: <StaffDashboardPage /> },
  { path: '/admin', element: <AdminOverviewPage /> },
  { path: '/admin/reports', element: <AdminOverviewPage report /> },
  { path: '/admin/logs', element: <AdminAuditPage /> },
  { path: '/admin/settings', element: <AdminSettingsPage /> },
  { path: '/admin/vouchers', element: <AdminVouchersPage /> },
];
