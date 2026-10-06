# Coordinator handoff: Playwright E2E runner (implemented)

P11 added a browser-to-API harness under tests/e2e/. It runs the real integrated
Express composition and Vite application against one disposable local MongoDB replica-set
database populated only with synthetic fixtures.

## Shared manifest and lockfile integration

The root manifest and lockfile now pin the reviewed development dependency:

    "@playwright/test": "1.63.0"

The root exposes a separate E2E command; it is intentionally not part of `npm run check`
because it requires a dedicated replica-set test database:

    "test:e2e": "node node_modules/@playwright/test/cli.js test --config tests/e2e/playwright.config.js"

Install the browser build for Playwright 1.63 with npx playwright install chromium in
the QA environment. On the P11 machine, a cached Chromium 153.0.8010.12 executable was
used explicitly; browser binaries stay outside the repository.

## Safe run requirements

Set P11_E2E_MONGODB_URI to an unauthenticated loopback MongoDB replica-set URI whose
database name is exactly tro_lam_p11_e2e_test_<12 lowercase hex chars>, for example:

    mongodb://127.0.0.1:27017/tro_lam_p11_e2e_test_0123456789ab

The runtime rejects non-loopback hosts, credentials, URI query options and any other
database name before connecting. It drops only this exact per-run test database before
seeding and again during teardown. The app runs on loopback ports 5190/5191; port
collisions fail instead of attaching to an existing server.

The suite forces test mode, disables background workers, PayOS and Gemini, refuses to
start if SMTP/PayOS/Gemini credentials are present in the test process environment, and
does not send mail or call any provider. Synthetic accounts use example.test addresses
and a fixture-only password; all test data is deleted with the dedicated database.

## Implemented coverage

- Public catalog API and browser route; draft product remains private by slug.
- Guest product detail → cart cookie → server cart read → checkout quote.
- Checkout receives the real unconfigured R06 response and keeps order submission
  disabled. No shipping fee, COD policy or successful PayOS result is invented.
- Customer can read own identity but cannot read staff/admin APIs.
- Staff can read the operations dashboard but cannot read admin statistics/catalog.
- Admin can read admin statistics/catalog; anonymous staff access returns 401.
- One 390px layout assertion checks that the public catalog page does not horizontally
  overflow. This is a smoke check, not a complete WCAG audit.

The dependency, command and native-script approvals are present in the integrated root
manifest/lockfile. A clean checkout at source `274aa34` on 2026-10-06 ran the exact
`npm run test:e2e` command and passed 4/4 tests with Node 24.21.0. See
[the release evidence](README.md) for the P11 worktree path limitation and the complete
check results. Replica-set race tests, staging providers, SMTP delivery, full
accessibility and broader customer support/return acceptance remain separate gates.
