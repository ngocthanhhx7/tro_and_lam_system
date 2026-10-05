import NotificationsPage from '../../pages/notifications/NotificationsPage.jsx';
import StaffDashboardPage from '../../pages/staff/dashboard/StaffDashboardPage.jsx';
import AdminOverviewPage from '../../pages/admin/overview/AdminOverviewPage.jsx';
import AdminAuditPage from '../../pages/admin/audit/AdminAuditPage.jsx';
import AdminSettingsPage from '../../pages/admin/settings/AdminSettingsPage.jsx';

export const operationsRoutes = [
  { path: '/tai-khoan/thong-bao', element: <NotificationsPage /> },
  { path: '/staff', element: <StaffDashboardPage /> },
  { path: '/admin', element: <AdminOverviewPage /> },
  { path: '/admin/logs', element: <AdminAuditPage /> },
  { path: '/admin/settings', element: <AdminSettingsPage /> },
];
