# Ma trận coverage nghiệm thu

Ánh xạ acceptance ID trong `doc/planning/01-business-and-permissions.md` tới package, test dự kiến và bằng chứng. Trạng thái được cập nhật sau khi test thực sự chạy; `Chưa chạy` không có nghĩa là đạt.

| Acceptance ID | Package / công việc | Test dự kiến | Bằng chứng hiện có |
| --- | --- | --- | --- |
| AC-PUB-01 | P04 — catalog public, filter và CTA theo `saleMode` | `backend/tests/catalog/catalog.routes.test.js`; `backend/tests/catalog/catalog.service.test.js`; `fondend/src/routes/modules/catalog.routes.jsx` | Backend catalog route/service/validation tests included in integrated `npm run check` (92/92 backend); storefront module is mounted by `AppRoutes` and Vite build passed. Browser behavior and backend API composition remain unverified. |
| AC-CART-01 | P03 — cart guest/account và merge idempotent | `backend/tests/account/account-service.test.js`; `fondend/src/pages/cart/CartPage.jsx` | Pass for service behavior: isolated guest carts, idempotent merge, quantity cap and unavailable-product removal covered in integrated `npm run check` (92/92 backend); account/cart route fragments are mounted and frontend build passed. Browser E2E remains pending. |
| AC-CHECKOUT-01 | P05 — quote, giá server và checkout idempotency | `backend/tests/commerce/checkout-idempotency.test.js` | Chưa chạy |
| AC-STOCK-01 | P05 — reservation cạnh tranh trên replica set | `backend/tests/commerce/reservation-race.integration.test.js` | Chưa chạy |
| AC-TRACK-01 | P05 — guest order proof/OTP, chống enumeration | `backend/tests/commerce/guest-order-access.test.js` | P02 issuer/model regression pass trong `npm run check` trên `fbd88c6`; P05 OTP lookup/enumeration chưa tích hợp |
| AC-CLAIM-01 | P02/P05 — challenge và compare-and-set claim guest order | `backend/tests/identity/guest-order-claim.integration.test.js` | Chưa chạy |
| AC-AUTH-01 | P02 — register, verify, login/reset, session, CSRF và revoke | `backend/tests/identity/identity-behavior.test.js`; `backend/tests/identity/identity-routes.test.js` | Pass — integrated head `fbd88c6`; `npm run check` · 2026-10-05 23:18 UTC: contract validation (102 paths, 121 operations, 60 schemas, 22 enums, 23 DTO fixtures), backend 35/35, lint clean, Vite build 63 modules |
| AC-ADDR-01 | P03 — address ownership/default/geolocation fallback | `backend/tests/account/account-service.test.js`; `backend/tests/account/account-routes.test.js`; `fondend/src/pages/account/addresses/AddressBookPage.jsx` | Pass for backend service/routes: owner isolation, default selection concurrency, manual address fallback and bounded geocoding covered in integrated `npm run check` (92/92 backend); account route is mounted and Vite build passed. Browser geolocation-denied flow pending. |
| AC-ORDER-01 | P05 — snapshot, timeline, transition/version và audit | `backend/tests/commerce/order-transitions.test.js` | Chưa chạy |
| AC-PAY-01 | P06 — chữ ký, amount, redirect browser và webhook dedupe | `backend/tests/payments/payos-webhook.test.js` | Chưa chạy |
| AC-PAY-02 | P05/P06 — paid đến muộn, expiry và race | `backend/tests/payments/late-payment-race.integration.test.js` | Chưa chạy |
| AC-REVIEW-01 | P07 — review đủ điều kiện, unique và moderation | `backend/tests/reviews/review-eligibility.test.js` | Chưa chạy |
| AC-TICKET-01 | P07 — ticket ownership, nội dung nội bộ và attachments | `backend/tests/support/ticket-access.test.js` | Chưa chạy |
| AC-STAFF-01 | P09 + domain owners — dashboard và giới hạn quyền staff | `backend/tests/operations/operations.test.js` | P09 router/dashboard/RBAC tests pass; composition với các queue P05/P07 vẫn chờ tích hợp |
| AC-ADMIN-01 | P02/P04 — CRUD/admin user và race last-admin | `backend/tests/identity/identity-behavior.test.js`; `backend/tests/catalog/catalog.routes.test.js`; `backend/tests/catalog/catalog.service.test.js` | P02 last-admin behavior and P04 catalog route/service tests pass in the integrated backend suite (92/92); P04 denies admin access when middleware is absent. Backend composition with P02 capabilities/P09 audit and browser admin flow remains pending. |
| AC-APPEAL-01 | P02 — blocked session và restricted appeal credential | `backend/tests/identity/identity-behavior.test.js`; `backend/tests/identity/identity-routes.test.js` | Pass trên `fbd88c6`; route/behavior checks gồm revoke phiên, restricted appeal proof, guest proof purpose/order scope/cookie/expiry/revoke và quyền owner; live replica-set chưa chạy |
| AC-APPEAL-02 | P02/P09 — quyết định appeal atomically, reason và audit | `backend/tests/identity/identity-behavior.test.js`; `backend/tests/operations/operations.test.js` | P02 fake-repository behavior và P09 audit service tests pass riêng; transaction P02 + P09 chưa được compose/live-test |
| AC-NOTIFY-01 | P09 — notification owner, dedupe và outbox retry | `backend/tests/operations/operations.test.js` | P09 package tests pass 17/17; full backend suite 52/52; owner scope, dedupe, retry/dead-letter và SMTP recipient acceptance có test. Live SMTP chưa cấu hình. |
| AC-CONTENT-01 | P08 — published/NFC/revoked, nội dung an toàn và tra story đã publish theo ID | `backend/tests/content/nfc-public-routing.test.js` | Pass — rebased P08 `ebf73e2`; full `npm run check` sau P09: P08 content/NFC tests pass, backend 56/56, contract validation, lint và Vite build pass; live Atlas chưa chạy |
| AC-CONTACT-01 | P07/P09 — lưu lead trước mail, queued/retry thật | `backend/tests/support/contact-outbox.test.js` | Chưa chạy |
| AC-AI-01 | P10 — public retrieval, redaction, unavailable/handoff | `backend/tests/assistant/grounding-and-fallback.test.js` | Chưa chạy |
| AC-AUDIT-01 | P09 — admin-only query và redaction | `backend/tests/operations/operations.test.js` | P09 package tests pass 17/17; admin-only route and redacted audit response covered; app composition pending |

P11 bổ sung luồng E2E và ma trận accessibility/security từ `doc/planning/08-acceptance-and-testing.md`; các file dự kiến là `tests/e2e/guest-checkout.spec.js`, `tests/e2e/customer-account.spec.js`, `tests/e2e/staff-fulfillment.spec.js`, `tests/e2e/admin-appeal.spec.js` và `tests/e2e/accessibility.spec.js`. Chỉ gắn đường dẫn/kết quả thực sau khi P11 chạy chúng trên nhánh tích hợp.

## Bằng chứng P01

| Check | Lệnh | Kết quả |
| --- | --- | --- |
| Contract bundle/OpenAPI/JSON Schema | `npm run validate:contracts` | Pass — 102 paths, 121 operations, 56 DTO schemas, 22 enums, 12 positive/negative fixtures; Node 24.21.0 |
| Health compatibility, request ID, error envelope, CORS allowlist, body limit | `npm test -w backend` | Pass — 19/19 tests; includes legacy health shape, 413, malformed JSON, CORS denial, rate limit and request ID |
| Integrated lint/backend tests/frontend build | `npm ci && npm run check` | Pass — Node 24.21.0, lint green, 19/19 backend tests, Vite build green; npm audit reported 0 vulnerabilities |

## Bằng chứng P08

| Check | Lệnh / thời điểm | Kết quả |
| --- | --- | --- |
| Contract bundle, lint, backend và frontend production build sau P08 published-by-ID port | `npm run check` · 2026-10-05 UTC · rebased P08 head `ebf73e2` | Pass — 102 paths, 121 operations, 60 schemas, 22 enums, 23 fixtures; backend 56/56; lint sạch; Vite build 63 modules |
| Live Atlas migration/replica-set transaction tests | Chưa chạy | Cần `MONGODB_URI` và replica-set environment; migration chỉ tạo indexes, chưa chạy trên Atlas |

## Bằng chứng P02

| Check | Lệnh / thời điểm | Kết quả |
| --- | --- | --- |
| Contract validation, lint, backend, frontend production build và restricted guest-proof ports | `npm run check` · 2026-10-05 23:18 UTC · integrated head `fbd88c6` | Pass — 102 paths, 121 operations, 60 schemas, 22 enums, 23 DTO fixtures; backend 35/35; Vite build 63 modules; lint clean. Guest checkout proof có `issuedAt` nhưng chỉ có `identityVerifiedAt` sau xác minh. |
| Mongo replica-set transaction/index tests, SMTP delivery, browser E2E | Chưa chạy | Cần replica-set DB, configured mail provider, và P11 browser environment |

## Bằng chứng P09

| Check | Lệnh / thời điểm | Kết quả |
| --- | --- | --- |
| Contract validation, lint, backend và frontend build sau template mapping + SMTP acceptance check | `npm run check` · 2026-10-05 23:31 UTC · commit `abc00ee` | Pass — 102 paths, 121 operations, 60 DTO schemas, 22 enums, 23 fixtures; backend 52/52; lint sạch; Vite build pass. P09 tests 17/17. |
| Live SMTP, outbox encryption key, worker supervision và Atlas transactions | Chưa chạy | Cần cấu hình mail/provider và secret store; worker chưa được mount vào server composition; chưa chạy replica-set. |

## Bằng chứng P03 và P04

| Check | Lệnh / thời điểm | Kết quả |
| --- | --- | --- |
| P03/P04 rebase, frontend route composition, contract validation, lint, backend và frontend production build | `npm run check` · 2026-10-06 UTC · verified commit `7af79ad` in detached QA checkout | Pass — 102 paths, 121 operations, 60 DTO schemas, 22 enums, 23 fixtures; backend 92/92; lint sạch; Vite build 86 modules. Bao gồm route catalog/content/account đã mount và P03 owner/default/cart/geocoding cùng P04 catalog route/service/validation checks. |
| P03/P04 backend API composition, browser E2E, Mongo replica-set | Chưa chạy | Frontend route fragments are mounted in `AppRoutes`; backend domain routers still await server composition. Cần P11 browser suite và Mongo replica-set để xác minh luồng tích hợp/concurrency trên database thật. |
