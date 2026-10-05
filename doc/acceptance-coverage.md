# Ma trận coverage nghiệm thu

Ánh xạ acceptance ID trong `doc/planning/01-business-and-permissions.md` tới package, test dự kiến và bằng chứng. Trạng thái được cập nhật sau khi test thực sự chạy; `Chưa chạy` không có nghĩa là đạt.

| Acceptance ID | Package / công việc | Test dự kiến | Bằng chứng hiện có |
| --- | --- | --- | --- |
| AC-PUB-01 | P04 — catalog public, filter và CTA theo `saleMode` | `backend/tests/catalog/public-catalog.test.js`; `fondend/tests/catalog/public-catalog.test.jsx` | Chưa chạy |
| AC-CART-01 | P03 — cart guest/account và merge idempotent | `backend/tests/account/cart-merge.test.js`; `fondend/tests/account/cart.test.jsx` | Chưa chạy |
| AC-CHECKOUT-01 | P05 — quote, giá server và checkout idempotency | `backend/tests/commerce/checkout-idempotency.test.js` | Chưa chạy |
| AC-STOCK-01 | P05 — reservation cạnh tranh trên replica set | `backend/tests/commerce/reservation-race.integration.test.js` | Chưa chạy |
| AC-TRACK-01 | P05 — guest order proof/OTP, chống enumeration | `backend/tests/commerce/guest-order-access.test.js` | Chưa chạy |
| AC-CLAIM-01 | P02/P05 — challenge và compare-and-set claim guest order | `backend/tests/identity/guest-order-claim.integration.test.js` | Chưa chạy |
| AC-AUTH-01 | P02 — register, verify, login/reset, session, CSRF và revoke | `backend/tests/identity/authentication.test.js` | Chưa chạy |
| AC-ADDR-01 | P03 — address ownership/default/geolocation fallback | `backend/tests/account/address-ownership.test.js`; `fondend/tests/account/address-form.test.jsx` | Chưa chạy |
| AC-ORDER-01 | P05 — snapshot, timeline, transition/version và audit | `backend/tests/commerce/order-transitions.test.js` | Chưa chạy |
| AC-PAY-01 | P06 — chữ ký, amount, redirect browser và webhook dedupe | `backend/tests/payments/payos-webhook.test.js` | Chưa chạy |
| AC-PAY-02 | P05/P06 — paid đến muộn, expiry và race | `backend/tests/payments/late-payment-race.integration.test.js` | Chưa chạy |
| AC-REVIEW-01 | P07 — review đủ điều kiện, unique và moderation | `backend/tests/reviews/review-eligibility.test.js` | Chưa chạy |
| AC-TICKET-01 | P07 — ticket ownership, nội dung nội bộ và attachments | `backend/tests/support/ticket-access.test.js` | Chưa chạy |
| AC-STAFF-01 | P09 + domain owners — dashboard và giới hạn quyền staff | `backend/tests/operations/staff-rbac.test.js` | Chưa chạy |
| AC-ADMIN-01 | P02/P04 — CRUD/admin user và race last-admin | `backend/tests/identity/last-admin-race.integration.test.js`; `backend/tests/catalog/admin-catalog.test.js` | Chưa chạy |
| AC-APPEAL-01 | P02 — blocked session và restricted appeal credential | `backend/tests/identity/blocked-appeal-access.test.js` | Chưa chạy |
| AC-APPEAL-02 | P02/P09 — quyết định appeal atomically, reason và audit | `backend/tests/identity/appeal-decision.test.js` | Chưa chạy |
| AC-NOTIFY-01 | P09 — notification owner, dedupe và outbox retry | `backend/tests/operations/outbox-notifications.test.js` | Chưa chạy |
| AC-CONTENT-01 | P08 — published/NFC/revoked và nội dung an toàn | `backend/tests/content/nfc-public-routing.test.js` | Pass — P08 `8996218`; `npm run check` ngày 2026-10-05 22:27 UTC: backend 23/23, contract/lint/build pass |
| AC-CONTACT-01 | P07/P09 — lưu lead trước mail, queued/retry thật | `backend/tests/support/contact-outbox.test.js` | Chưa chạy |
| AC-AI-01 | P10 — public retrieval, redaction, unavailable/handoff | `backend/tests/assistant/grounding-and-fallback.test.js` | Chưa chạy |
| AC-AUDIT-01 | P09 — admin-only query và redaction | `backend/tests/operations/audit-access-redaction.test.js` | Chưa chạy |

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
| Contract bundle, lint, backend và frontend production build sau rebase lên contract v1.2.0 | `npm run check` · 2026-10-05 22:27 UTC · commit `899621879eaabd1f5838ae60db49b95b50b9e730` | Pass — 102 paths, 121 operations, 60 schemas, 22 enums, 21 fixtures; backend 23/23; Vite build 47 modules |
| Live Atlas migration/replica-set transaction tests | Chưa chạy | Cần `MONGODB_URI` và replica-set environment; migration chỉ tạo indexes, chưa chạy trên Atlas |
