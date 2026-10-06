# Ma trận coverage nghiệm thu hiện hành

Ma trận này phản ánh source P11 `b8d6cae` và lần chạy browser sạch tại source `274aa34` ngày 2026-10-06. Kết quả lệnh đầy đủ và giới hạn môi trường nằm trong [README release](README.md). Không có luồng nào được xem là UAT hoặc release pass đầy đủ.

- **Partial**: có unit/service/route hoặc browser evidence cho một phần yêu cầu; còn thiếu tích hợp, browser, replica-set, provider staging hoặc xác nhận của owner.
- **Pending**: chưa có evidence phù hợp cho điều kiện cốt lõi của acceptance.

| ID | Luồng / module | Bằng chứng test hiện có | Còn thiếu | Status |
| --- | --- | --- | --- | --- |
| A-PUB-01 | Catalog/search/filter | `backend/tests/catalog/catalog.service.test.js`, `backend/tests/catalog/catalog.routes.test.js`; E2E catalog kiểm tra published/draft | Browser query restore, filter, pagination và đầy đủ viewport | Partial |
| A-GST-01 | Guest cart | `backend/tests/account/account-service.test.js`, `backend/tests/account/account-routes.test.js`; E2E thêm sản phẩm và đọc cart API | Browser sửa/xóa, reload/session policy và cart persistence đầy đủ | Partial |
| A-GST-02 | Guest checkout | `backend/tests/commerce/commerce.behavior.test.js`, `backend/tests/commerce/commerce.routes.test.js`; E2E quote xác nhận checkout unavailable và order button bị disable | R06 cần owner cấu hình; chưa E2E tạo order, retry/idempotency qua server và email outbox | Partial |
| A-GST-03 | Guest order tracking/proof | `backend/tests/commerce/commerce.behavior.test.js`, `backend/tests/commerce/commerce.routes.test.js`, `backend/tests/identity/restricted-proof-model.test.js` | Browser OTP/delivery, sai credential cùng response shape và PII chỉ sau proof | Partial |
| A-AUTH-01 | Register/login/reset/session | `backend/tests/identity/identity-behavior.test.js`, `backend/tests/identity/identity-routes.test.js`; E2E login customer/staff/admin | Browser register/reset/logout, email thật trên staging và no-enumeration UAT | Partial |
| A-ADR-01 | Address CRUD/ownership | `backend/tests/account/account-models-validator.test.js`, `backend/tests/account/account-service.test.js`, `backend/tests/account/account-routes.test.js` | Browser ownership/error states và snapshot qua DB replica-set | Partial |
| A-ADR-02 | Geolocation/manual fallback | `backend/tests/account/account-service.test.js` | Browser success/denied/timeout; geocoder staging key/quota/billing | Partial |
| A-ORD-01 | Pricing/inventory/race | `backend/tests/commerce/commerce.behavior.test.js`; có `backend/tests/commerce/commerce.replica-set.test.js` | Replica-set test hiện skip; chưa xác minh cuộc đua checkout trong DB thật | Partial |
| A-ORD-02 | Idempotency/retry | `backend/tests/commerce/commerce.behavior.test.js`, `backend/tests/commerce/commerce.routes.test.js` | Replica-set race và retry cùng/khác body qua browser/API tích hợp | Partial |
| A-PAY-01 | PayOS signature/amount/webhook | `backend/tests/payments/payments.service.test.js`, `backend/tests/payments/payos.adapter.test.js`, `backend/tests/payments/payments.routes.test.js` | PayOS sandbox, webhook URL và merchant evidence | Partial |
| A-PAY-02 | Duplicate/out-of-order/expiry race | `backend/tests/payments/payments.service.test.js`, `backend/tests/payments/payments.replica-set.test.js` | Replica-set test hiện skip; chưa rehearsal late/out-of-order webhook trên sandbox | Partial |
| A-PAY-03 | Browser return/cancel | Có `fondend/src/pages/payment/PaymentReturnPage.jsx` và payment service tests | Chưa có browser evidence rằng query string không đổi trạng thái và UI đối soát API | Pending |
| A-COD-01 | COD/fulfillment/reconciliation | `backend/tests/commerce/commerce.behavior.test.js`, `backend/tests/commerce/commerce.routes.test.js` | Browser staff flow, audit persistence và owner duyệt fee/COD policy | Partial |
| A-REV-01 | Review/moderation | `backend/tests/support/support-review.test.js` kiểm tra order đủ điều kiện, duplicate và audit/moderation | Browser customer/admin round-trip, DB transaction thật và moderation UAT | Partial |
| A-TKT-01 | Ticket/complaint/attachment | `backend/tests/support/support-review.test.js` kiểm tra owner, staff note, attachment và guest proof | Browser customer/staff flow, storage staging và full assignment/attachment UAT | Partial |
| A-BLK-01 | Blocked session/appeal | `backend/tests/identity/identity-behavior.test.js`, `backend/tests/identity/identity-routes.test.js`, `backend/tests/identity/restricted-proof-model.test.js` | Browser appeal round-trip, admin decision và audit trên DB tích hợp | Partial |
| A-STF-01 | Staff dashboard/permissions | `backend/tests/operations/operations.test.js`, commerce/support route tests; E2E staff dashboard và từ chối admin API | Browser fulfillment/support queues và toàn bộ staff capability matrix | Partial |
| A-ADM-01 | Admin users/appeals/catalog/audit | Identity/catalog/operations tests; E2E admin đọc statistics/catalog, customer/staff bị cấm | Browser role/status mutation, appeal, last-admin race và đủ admin API | Partial |
| A-PRD-01 | Product CRUD/archive/snapshot | `backend/tests/catalog/catalog-validation.test.js`, `backend/tests/catalog/catalog.service.test.js`, `backend/tests/catalog/catalog.routes.test.js` | DB-backed CRUD/archive, optimistic concurrency, history snapshot và admin browser flow | Partial |
| A-NOT-01 | Notification owner/dedupe | `backend/tests/operations/operations.test.js` | Browser read/mark-all và persistence/actor isolation E2E | Partial |
| A-MAIL-01 | SMTP/outbox | `backend/tests/operations/operations.test.js` kiểm tra encryption, retry, dead-letter và adapter failure | SMTP mailbox/staging, replica-set recovery và deliverability; không có mail thật trong QA | Partial |
| A-AI-01 | Assistant grounding/redaction/fallback | `backend/tests/assistant/assistant.models.test.js`, `assistant.routes.test.js`, `assistant.service.test.js`, `gemini.adapter.test.js`; `backend/tests/support/support-review.test.js` kiểm tra handoff ownership | Browser assistant flow và Gemini staging/quota; QA không gọi provider | Partial |
| A-NFC-01 | Published/draft/revoked story | `backend/tests/content/nfc-public-routing.test.js` | Mounted server/browser flow, owner duyệt nguồn story và bản quyền media | Partial |
| A-LOG-01 | Audit access/redaction | `backend/tests/operations/operations.test.js` | Browser/admin query trên server tích hợp, stored event verification và full sensitive-log scan | Partial |
| A-UI-01 | Responsive/accessibility | E2E kiểm tra catalog không overflow ở viewport 390px | Viewport 360/768/1280/1440, keyboard, focus, labels, errors, alt text, reduced motion và audit WCAG | Partial |
| A-REL-01 | Build/check/E2E/release | `npm run check` pass; `npm run test:e2e` pass 4/4 trong checkout QA sạch | P05/P06 replica-set, provider staging, accessibility, restore/rollback và owner UAT còn thiếu | Partial |

## P11 browser evidence

`tests/e2e/acceptance.spec.js` có bốn luồng chạy trên checkout QA sạch `D:\WW\tro_lam_integration_verify_20261006`, source `274aa34`, Node 24.21.0:

1. Public catalog ẩn draft; guest thêm sản phẩm vào cart, đọc cart qua API và thấy checkout fallback thật do cấu hình R06 chưa có. Không tạo order hoặc kết quả thanh toán giả.
2. Customer đọc identity của mình nhưng không truy cập staff/admin API.
3. Staff đọc dashboard operations nhưng không truy cập admin API.
4. Admin đọc statistics/catalog; khách ẩn danh bị từ chối staff API.

Kết quả `npm run test:e2e`: **4 passed, 0 failed**. Database là URI loopback vừa tạo, theo mẫu strict `tro_lam_p11_e2e_test_<12 lowercase hex>`; teardown xóa database. Test dùng fixture tổng hợp và không gọi PayOS, SMTP, Gemini hoặc geocoder. P11 worktree đường dẫn có `&` gặp lỗi Vite dependency optimizer `config.js:32098` thiếu `imports`; cùng source đã pass trong checkout sạch có đường dẫn không chứa `&`.

## Tình trạng tích hợp

Các gap ở baseline cũ về router composition, P07 support/review, P10 assistant và thiếu Playwright runner đã được tích hợp trong source hiện tại. `npm run check` trên P11 source `b8d6cae` pass: contract validation 102 paths / 121 operations / 60 schemas / 22 enums / 23 fixtures, lint sạch, backend 177 pass và 2 skip, Vite build 123 modules. Hai skip thuộc P05/P06 replica-set do chưa có URI test riêng. Đây là bằng chứng automated check; không thay thế staging, replica-set hoặc UAT.
