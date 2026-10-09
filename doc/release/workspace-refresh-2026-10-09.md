# Workspace refresh validation — 2026-10-09

Admin and staff now use the shared navy/cream workspace design based on the supplied Stitch references. Public/customer pages return the dedicated 403 view for logged-in workspace roles. Login opens the correct workspace. Account profile, password and notifications remain within that workspace.

Both sidebars include notifications with an owner-scoped unread count, immediate updates after read changes and visible-page polling. Logout refreshes a rejected stale CSRF token once; pending authentication reads cannot restore a cleared session.

The admin overview and reports use collected-payment ledger data, creation-date order counts and customer-only counts. Order management uses a shared operational API explicitly authorized for admin and staff. The staff board includes actual order, support, contact, return, inventory and notification data. Inventory warnings use the stated current available-stock threshold of 5 and show at most 10 products. No sample business totals were copied into live data.

## Validation

- Twenty targeted browser scenarios passed after repairs: workspace separation, account navigation, stale-CSRF logout, unread/read state and ownership, order search/detail, all registered sidebar routes, error screens, responsive layouts, accessibility, report date ranges and stale responses, product editing/upload/archive, and the customer voucher flow.
- Dashboard and account-detail accessibility checks passed at mobile and desktop widths, including keyboard access to horizontally scrolling inventory.
- Backend suite: 216 passed, 7 skipped because their dedicated replica-set test database environment variables were not supplied. Three new workspace dashboard tests passed within that suite.
- Lint, frontend production build and contract validation passed. Contracts cover 109 paths and 129 operations.
- Browser scenarios and screenshot previews used disposable validated loopback databases. Production inventory and user records were not changed by this refresh.

Screenshots are implementation captures using explicitly synthetic test records: `screenshots/workspace-staff-2026-10-09.jpg` and `screenshots/workspace-notifications-2026-10-09.jpg`.
