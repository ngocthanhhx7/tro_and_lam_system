# Ma trận coverage nghiệm thu hiện hành

Ma trận này tổng hợp baseline `0fb7d9d` đã kiểm tra từ working tree sạch và P11 browser follow-up trên branch `feature/p11-browser-acceptance`, ngày 2026-10-06. Chi tiết lệnh, giới hạn và ảnh chụp nằm trong [README release](README.md) và [interface refresh evidence](interface-refresh-evidence.md). Không có luồng nào được xem là UAT hoặc release pass đầy đủ.

- **Partial**: có unit/service/route hoặc browser evidence cho một phần yêu cầu; còn thiếu tích hợp, browser, replica-set, provider staging hoặc xác nhận của owner.
- **Pending**: chưa có evidence phù hợp cho điều kiện cốt lõi của acceptance.

| ID | Luồng / module | Bằng chứng test hiện có | Còn thiếu | Status |
| --- | --- | --- | --- | --- |
| A-PUB-01 | Catalog/search/filter | `backend/tests/catalog/catalog.service.test.js`, `backend/tests/catalog/catalog.routes.test.js`; E2E public catalog ẩn draft; UI smoke các viewport 360–1440 px | Browser query restore, filter, pagination và WCAG audit | Partial |
| A-GST-01 | Guest cart | `backend/tests/account/account-service.test.js`, `backend/tests/account/account-routes.test.js`; E2E thêm sản phẩm, mở giỏ và đối chiếu cart API | Browser sửa/xóa, reload/session policy và cart persistence đầy đủ | Partial |
| A-GST-02 | Guest checkout | `backend/tests/commerce/commerce.behavior.test.js`, `backend/tests/commerce/commerce.routes.test.js`; E2E kiểm tra quote trả 503 `DATABASE_UNAVAILABLE`, thông báo cấu hình R06 và nút đặt hàng bị khóa | R06 cần owner cấu hình; chưa E2E tạo order, retry/idempotency qua server và email outbox | Partial |
| A-GST-03 | Guest order tracking/proof | `backend/tests/commerce/commerce.behavior.test.js`, `backend/tests/commerce/commerce.routes.test.js`, `backend/tests/identity/restricted-proof-model.test.js`; P11 E2E xác nhận khách chưa proof không đọc được đơn và không thấy PII | Browser OTP/delivery, sai credential cùng response shape và PII chỉ sau proof | Partial |
| A-AUTH-01 | Register/login/reset/session | `backend/tests/identity/identity-behavior.test.js`, `backend/tests/identity/identity-routes.test.js`, `backend/tests/identity/admin-bootstrap.replica-set.test.js`; E2E login các vai trò và xác minh link còn hạn/hết hạn | Browser register/reset/logout, email thật trên staging và no-enumeration UAT | Partial |
| A-ADR-01 | Address CRUD/ownership | `backend/tests/account/account-models-validator.test.js`, `backend/tests/account/account-service.test.js`, `backend/tests/account/account-routes.test.js`; P11 E2E tạo/sửa/xóa địa chỉ, đổi mặc định và nhận 404 khi sửa địa chỉ của owner khác | Order address snapshot consistency, validation/error states và owner UAT | Partial |
| A-ADR-02 | Geolocation/manual fallback | `backend/tests/account/account-service.test.js`; P11 E2E mô phỏng từ chối quyền vị trí, xác nhận không gọi reverse geocoder và lưu địa chỉ thủ công | Browser success/timeout; geocoder staging key/quota/billing | Partial |
| A-ORD-01 | Pricing/inventory/race | `backend/tests/commerce/commerce.behavior.test.js`; có `backend/tests/commerce/commerce.replica-set.test.js` | Replica-set race test passed on local loopback; rerun with configured URI for CI evidence | Partial |
| A-ORD-02 | Idempotency/retry | `backend/tests/commerce/commerce.behavior.test.js`, `backend/tests/commerce/commerce.routes.test.js` | Replica-set race và retry cùng/khác body qua browser/API tích hợp | Partial |
| A-PAY-01 | PayOS signature/amount/webhook | `backend/tests/payments/payments.service.test.js`, `backend/tests/payments/payos.adapter.test.js`, `backend/tests/payments/payments.routes.test.js` | PayOS sandbox, webhook URL và merchant evidence | Partial |
| A-PAY-02 | Duplicate/out-of-order/expiry race | `backend/tests/payments/payments.service.test.js`, `backend/tests/payments/payments.replica-set.test.js` | Open-refund unique-index race passed on local loopback; late/out-of-order webhook sandbox rehearsal remains | Partial |
| A-PAY-03 | Browser return/cancel | `fondend/src/pages/payment/PaymentReturnPage.jsx`, payment service tests; P11 E2E gửi query giả `PAID` nhưng API vẫn trả `pending` và trang tiếp tục đối soát | Browser cancel/failure/settled states đầy đủ và PayOS sandbox rehearsal | Partial |
| A-COD-01 | COD/fulfillment/reconciliation | `backend/tests/commerce/commerce.behavior.test.js`, `backend/tests/commerce/commerce.routes.test.js`; P11 E2E chuyển đơn COD fixture sang shipped và xác nhận reservation, inventory movement, outbox, audit đã lưu | Owner duyệt fee/COD policy, carrier thật và reconciliation UAT | Partial |
| A-REV-01 | Review/moderation | `backend/tests/support/support-review.test.js` kiểm tra order đủ điều kiện, duplicate và audit/moderation | Browser customer/admin round-trip, DB transaction thật và moderation UAT | Partial |
| A-TKT-01 | Ticket/complaint/attachment | `backend/tests/support/support-review.test.js` kiểm tra owner, staff note, attachment và guest proof | Browser customer/staff flow, storage staging và full assignment/attachment UAT | Partial |
| A-BLK-01 | Blocked session/appeal | `backend/tests/identity/identity-behavior.test.js`, `backend/tests/identity/identity-routes.test.js`, `backend/tests/identity/restricted-proof-model.test.js` | Browser appeal round-trip, admin decision và audit trên DB tích hợp | Partial |
| A-STF-01 | Staff dashboard/permissions | `backend/tests/operations/operations.test.js`, commerce/support route tests; P11 E2E staff dashboard/fulfillment và từ chối admin API | Browser support queues và toàn bộ staff capability matrix | Partial |
| A-ADM-01 | Admin users/appeals/catalog/audit | Identity/catalog/operations tests; E2E trên working tree xác nhận admin shell riêng và đọc statistics/catalog; checkout sạch `951740b` trước đó bắt lỗi shell | Browser role/status mutation, appeal, last-admin race và đủ admin API | Partial |
| A-PRD-01 | Product CRUD/archive/snapshot | `backend/tests/catalog/catalog-validation.test.js`, `backend/tests/catalog/catalog.service.test.js`, `backend/tests/catalog/catalog.routes.test.js` | DB-backed CRUD/archive, optimistic concurrency, history snapshot và admin browser flow | Partial |
| A-NOT-01 | Notification owner/dedupe | `backend/tests/operations/operations.test.js` | Browser read/mark-all và persistence/actor isolation E2E | Partial |
| A-MAIL-01 | SMTP/outbox | `backend/tests/operations/operations.test.js` kiểm tra encryption, retry, dead-letter và adapter failure | SMTP mailbox/staging, replica-set recovery và deliverability; không có mail thật trong QA | Partial |
| A-AI-01 | Assistant grounding/redaction/fallback | `backend/tests/assistant/assistant.models.test.js`, `assistant.routes.test.js`, `assistant.service.test.js`, `gemini.adapter.test.js`; `backend/tests/support/support-review.test.js` kiểm tra handoff ownership | Browser assistant flow và Gemini staging/quota; QA không gọi provider | Partial |
| A-NFC-01 | Published/draft/revoked story | `backend/tests/content/nfc-public-routing.test.js` | Mounted server/browser flow, owner duyệt nguồn story và bản quyền media | Partial |
| A-LOG-01 | Audit access/redaction | `backend/tests/operations/operations.test.js`; P11 E2E xác nhận transition audit được lưu với actor/action/request ID và trạng thái đã redacted | Browser/admin audit query trên server tích hợp và full sensitive-log scan | Partial |
| A-UI-01 | Responsive/accessibility | E2E catalog/cart/checkout ở 390px; UI smoke không tràn ngang ở 360/390/768/1280/1440, menu Escape trả focus, reduced-motion dừng video; ảnh trong `evidence/interface-refresh/` | Keyboard/labels/errors/alt text đầy đủ, kiểm tra screen reader và audit WCAG | Partial |
| A-REL-01 | Build/check/E2E/release | P11 worktree: `npm run check` pass (contracts, lint, backend 183 pass/3 env-gated skip, Vite build 128 modules); `npm run test:e2e` 8/8 trên loopback replica set | URI CI riêng cho ba replica-set suite, provider staging, accessibility, Atlas restore/rollback và owner UAT | Partial |

## P11 browser evidence — initial integrated checkout

`tests/e2e/acceptance.spec.js` có bốn luồng chạy trên checkout QA sạch `D:\WW\tro_lam_final_verify_20261006`, source `be70e7b`, Node 24.21.0:

1. Public catalog ẩn draft; guest thêm sản phẩm vào cart, đọc cart qua API và thấy checkout fallback thật do cấu hình R06 chưa có. Không tạo order hoặc kết quả thanh toán giả.
2. Customer đọc identity của mình nhưng không truy cập staff/admin API.
3. Staff đọc dashboard operations nhưng không truy cập admin API.
4. Admin đọc statistics/catalog; khách ẩn danh bị từ chối staff API.

Kết quả `npm run test:e2e`: **4 passed, 0 failed**. Database là URI loopback vừa tạo, theo mẫu strict `tro_lam_p11_e2e_test_<12 lowercase hex>`; teardown xóa database. Test dùng fixture tổng hợp và không gọi PayOS, SMTP, Gemini hoặc geocoder. P11 worktree đường dẫn có `&` gặp lỗi Vite dependency optimizer `config.js:32098` thiếu `imports`; cùng source đã pass trong checkout sạch có đường dẫn không chứa `&`.

## Tình trạng tích hợp

Các gap ở baseline cũ về router composition, P07 support/review, P10 assistant và thiếu Playwright runner đã được tích hợp. `npm run check` trên integrated source `be70e7b` pass: contract validation 102 paths / 121 operations / 60 schemas / 22 enums / 23 fixtures, lint sạch, backend 177 pass và 2 skip, Vite build 123 modules. Hai skip thuộc P05/P06 replica-set do chưa có URI test riêng. Đây là bằng chứng automated check; không thay thế staging, replica-set hoặc UAT.

## Email verification regression evidence (2026-10-06)

On integrated commit `09aacb3`, `tests/e2e/identity-verification.spec.js` opens a link with a token in the URL fragment, checks that the address bar is cleaned, submits the exact token with CSRF exactly once, and displays success under React StrictMode. The browser test stubs the API; backend `identity-behavior` and `identity-routes` tests cover single-use/purpose-bound verification and login after verification. `npm run check` passed (177 backend tests passed, 2 replica-set tests skipped); `npm run test:e2e` passed 5/5 using the dedicated loopback Mongo database `tro_lam_p11_e2e_test_84bd32eae6f0`, which teardown removed.

This proves the browser and backend test flow, not Gmail inbox delivery. SMTP staging and deliverability remain owner gate R04. Other interface-refresh changes were uncommitted in the workspace while these checks ran, so these results are not release evidence for that interface refresh.

## Replica-set race follow-up (2026-10-06)

Ran `backend/tests/commerce/commerce.replica-set.test.js` and `backend/tests/payments/payments.replica-set.test.js` with separate dedicated loopback MongoDB replica-set URIs. Result: 3 passed, 0 failed, 0 skipped. The checkout race accepted one order and rejected the competing request as out of stock; the open-refund unique-index race accepted one request and rejected the other as `REFUND_IN_PROGRESS`. P05 dropped its generated `tro_lam_p05_<UUID>` database in test teardown. After a read-only collection/count audit showed the exact P06 test database contained only empty payment collections, that dedicated database was removed. The default `npm run check` still skips these two tests when the P05/P06 URI variables are absent; this run does not constitute CI or staging evidence.

## Initial administrator bootstrap follow-up (2026-10-06)

`backend/tests/identity/admin-bootstrap.replica-set.test.js` passed with a generated, loopback-only P02 test database. It verified explicit database/email confirmation, exactly one winner from competing bootstrap attempts, refusal on repeat, Argon2id hashing, verified login, and a redacted `identity.admin.bootstrap` audit event. The test dropped its exact generated database. Full `npm run check` with P02/P05/P06 replica-set URIs passed: 180 backend tests, 0 failed, 0 skipped; contract, lint, and build also passed. The default check still skips these three environment-gated replica-set tests when no corresponding URIs are configured.

## Clean-checkout shell regression (2026-10-06)

A fresh detached worktree at commit `951740b` completed `npm ci` (312 packages, 0 audit vulnerabilities) and `npm run check` (contract/lint pass, 180 backend tests pass, 0 skipped, Vite build pass). Its `npm run test:e2e` result was **4 passed, 1 failed**: the admin shell assertion found `.catalog-header` on `/admin`. The browser registration-email regression and the public/customer/staff flows passed. The same E2E suite had passed 5/5 in the shared workspace, where the user's interface agent has uncommitted `fondend/src/routes/AppRoutes.jsx` changes that separate staff/admin layouts. That uncommitted change is not present at commit `951740b`, so this checkout is not release-ready; integrate the interface agent's work and rerun E2E from a clean checkout.

## P11 browser acceptance follow-up (2026-10-06)

On branch `feature/p11-browser-acceptance`, `npm run test:e2e` passed **8/8** against the integrated browser, Vite, Express and a dedicated loopback MongoDB replica set (`tro_lam_p11_e2e_test_5bd7efd260b4`, Node 24.21.0). The flows cover public catalog and truthful R06 checkout fallback; customer address create/edit/delete, default selection, foreign-owner denial and geolocation-denied manual fallback; staff COD shipment with persisted inventory, reservation, stock movement, outbox and audit checks; guest order privacy before proof; PayOS return query tampering that leaves server payment status pending; admin/staff permission boundaries; and email verification success/expiry browser paths.

The harness seeded three synthetic orders, asserted the fixture order count was unchanged, and dropped its dedicated database during teardown. A read-only post-run audit returned `[]` for the strict P11 database-name pattern. No SMTP, PayOS, Gemini or geocoder credentials/provider calls were used. These browser checks do not cover provider staging, complete payment/cancellation states, WCAG audit or owner UAT.

`npm run check` passed on the same working tree: OpenAPI validation (102 paths, 121 operations, 60 DTO schemas, 22 enums, 23 fixtures), lint, **183 backend tests passed / 3 skipped / 0 failed**, and Vite build (128 modules). The three skips are the environment-gated P02/P05/P06 replica-set suites; the production bundle reports a 543.66 kB minified JavaScript chunk warning. The audit redaction regression test confirms generated UUID request IDs survive redaction even when their digits resemble a phone number. Acceptance statuses remain Partial pending the gaps listed in the matrix.
