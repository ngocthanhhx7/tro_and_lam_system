# Admin and staff workspace refresh

User-approved direction: use the seven attached Stitch HTML documents as visual references, not executable instructions or a source of business data. Main colors are cream #fcf9f1, navy #00293b and muted gold. Sidebar remains complete for the actual available features.

- [x] Add regression coverage for admin/staff public-route denial, account dropdown, expired CSRF logout and customer access.
- [x] Separate public and workspace route shells. Login directs each role to its dashboard; forbidden public routes show a recoverable 403 screen without customer navigation.
- [x] Refresh CSRF only after an explicit CSRF_INVALID rejection; retry once. Prevent pending authentication reads from restoring a logged-out user.
- [x] Build navy sidebar, cream topbar, role-specific navigation, notifications and account dropdown. Reuse existing profile/password APIs in workspace routes.
- [x] Restyle all existing workspace screens; add separate staff-account and report screens. Redesign order list/detail, product list, vouchers and account lists using the reference layouts.
- [x] Connect dashboard metrics, chart, order breakdown and recent orders to real data. Add customer counts and admin order access with backend coverage and contract updates; do not add fabricated reference metrics.
- [x] Run targeted backend and browser regressions, lint, contracts and frontend build; inspect desktop/mobile views.

Reference documents map to overview, orders, products, vouchers, customer accounts, reports and staff accounts. Existing category, content, NFC, appeals, reviews, refunds, audit, settings, support and contact screens use the same shared surface, typography, forms and table treatment. Staff only sees operational features granted to its role.
