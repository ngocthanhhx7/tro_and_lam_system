# Ma trận bao phủ acceptance

Snapshot baseline: 3939722b2472a8468a55d5f07d8f66d776a78546, 2026-10-06.
Đây là đối chiếu file và test đã có; không khẳng định test trong bảng đã chạy, trừ kết
quả lệnh được ghi tại doc/release/README.md.

Status:

- **Partial** — có unit/service/route test liên quan, nhưng chưa có đủ bằng chứng tích hợp
  hoặc browser theo acceptance.
- **Pending** — package/route/test chưa có trong baseline hoặc chưa có bằng chứng phù hợp.
- Không dòng nào được đánh dấu pass đầy đủ cho UAT/release.

| AC | Route / module | Test file hiện có | Bằng chứng còn thiếu | Status |
| --- | --- | --- | --- | --- |
| A-PUB-01 | Public /, /san-pham, /san-pham/:slug; catalog | backend/tests/catalog/catalog.service.test.js; backend/tests/catalog/catalog.routes.test.js | Browser query restore/pagination và API server mount; public flow chưa chạy E2E | Partial |
| A-GST-01 | /gio-hang; account cart | backend/tests/account/account-service.test.js; backend/tests/account/account-routes.test.js | Browser reload/session policy, cart UI và catalog/cart API trên server tích hợp | Partial |
| A-GST-02 | /thanh-toan; commerce checkout | backend/tests/commerce/commerce.behavior.test.js; backend/tests/commerce/commerce.routes.test.js | Checkout browser, queue email trên outbox thật trong replica-set test và retry qua server | Partial |
| A-GST-03 | /tra-cuu-don-hang, /don-hang/:id; commerce guest proof + identity restricted proof | backend/tests/commerce/commerce.behavior.test.js; backend/tests/commerce/commerce.routes.test.js; backend/tests/identity/restricted-proof-model.test.js | OTP delivery/verification browser, response shape cho credential sai và domain router composition | Partial |
| A-AUTH-01 | /dang-ky, /dang-nhap, /quen-mat-khau, /dat-lai-mat-khau; identity | backend/tests/identity/identity-behavior.test.js; backend/tests/identity/identity-routes.test.js | Email thật trên staging, browser reset/logout và auth API mount | Partial |
| A-ADR-01 | /tai-khoan/dia-chi; account address | backend/tests/account/account-models-validator.test.js; backend/tests/account/account-service.test.js; backend/tests/account/account-routes.test.js | Address/order snapshot qua DB replica set và browser ownership/error states | Partial |
| A-ADR-02 | AddressBookPage, /locations/reverse; geolocation adapter | backend/tests/account/account-service.test.js | Browser success/deny/timeout; provider integration có credential/billing; manual fallback đã có unit evidence | Partial |
| A-ORD-01 | /thanh-toan; commerce pricing/inventory | backend/tests/commerce/commerce.behavior.test.js; backend/tests/commerce/commerce.replica-set.test.js | Race test replica-set chưa chạy; order/reservation API chưa mount ở server | Partial |
| A-ORD-02 | /thanh-toan; commerce idempotency | backend/tests/commerce/commerce.behavior.test.js; backend/tests/commerce/commerce.routes.test.js; backend/tests/commerce/commerce.replica-set.test.js | Idempotency race/owner isolation trên DB riêng và retry từ browser/API tích hợp | Partial |
| A-PAY-01 | /payment/return; payments webhook /payments/payos/webhook | backend/tests/payments/payments.service.test.js; backend/tests/payments/payos.adapter.test.js | Signature/webhook qua mounted API + sandbox merchant; chưa có sandbox evidence | Partial |
| A-PAY-02 | Payment attempts, webhook, expiry/reconciliation | backend/tests/payments/payments.service.test.js; backend/tests/payments/payments.replica-set.test.js; backend/tests/payments/payos.adapter.test.js; backend/tests/commerce/commerce.behavior.test.js | Hai replica-set suites đang skip; chưa có test DB chứng minh race expiry-vs-webhook đồng thời; provider late/out-of-order sandbox rehearsal | Partial |
| A-PAY-03 | /payment/return, /payment/cancel; payment UI đối soát API | backend/tests/payments/payments.service.test.js | Chưa có frontend test chứng minh query paid=true không đổi trạng thái và UI gọi API thật; API domain chưa mount | Pending |
| A-COD-01 | /staff/orders, order detail; commerce COD collection | backend/tests/commerce/commerce.behavior.test.js; backend/tests/commerce/commerce.routes.test.js | Browser staff capability/evidence, audit persistence và owner policy COD/fee | Partial |
| A-REV-01 | Customer review và admin moderation; P07 reviews | Chưa có test review trong baseline | P07 route/service/UI chưa tích hợp; eligibility, owner isolation, duplicate và moderation audit | Pending |
| A-TKT-01 | Customer/staff support và complaint; P07 support | Chưa có test ticket/support trong baseline | P07 route/service/UI chưa tích hợp; assignment/thread/attachment ACL/return linkage | Pending |
| A-BLK-01 | /tai-khoan/bi-khoa, /admin/appeals; identity appeal | backend/tests/identity/identity-behavior.test.js; backend/tests/identity/identity-routes.test.js; backend/tests/identity/restricted-proof-model.test.js | Browser restricted-session allowlist, appeal round-trip và admin decision/audit trên API đã mount | Partial |
| A-STF-01 | /staff, /staff/orders; operations + commerce + P07 support | backend/tests/operations/operations.test.js; backend/tests/commerce/commerce.behavior.test.js; backend/tests/commerce/commerce.routes.test.js | Server/API composition, staff fulfillment browser và support queue chưa có P07 | Partial |
| A-ADM-01 | /admin/users, /admin/appeals, /admin/products, /admin/logs; identity/catalog/operations | backend/tests/identity/identity-behavior.test.js; backend/tests/identity/identity-routes.test.js; backend/tests/catalog/catalog.routes.test.js; backend/tests/operations/operations.test.js | E2E role/status invalidation, last-admin race DB và kiểm tra mọi admin capability trên server tích hợp | Partial |
| A-PRD-01 | /admin/products, /admin/products/new, /admin/products/:id/edit; catalog | backend/tests/catalog/catalog-validation.test.js; backend/tests/catalog/catalog.service.test.js; backend/tests/catalog/catalog.routes.test.js | Product CRUD/archive với DB thật, snapshot lịch sử và admin browser flow | Partial |
| A-NOT-01 | /tai-khoan/thong-bao; operations notifications | backend/tests/operations/operations.test.js | Browser read/mark-all, notification persistence qua server và actor B isolation E2E | Partial |
| A-MAIL-01 | P09 outbox + SMTP integration | backend/tests/operations/operations.test.js; backend/tests/identity/identity-behavior.test.js | Replica-set durability/recovery và mailbox staging; test adapter không chứng minh deliverability | Partial |
| A-AI-01 | P10 assistant; chưa có route/module trong baseline | Chưa có P10 assistant test trong baseline | P10 merge, grounded published retrieval, PII/injection/ownership tests và provider unavailable UX | Pending |
| A-NFC-01 | /nfc/:publicId; P08 content/NFC | backend/tests/content/nfc-public-routing.test.js | NFC flow qua mounted server/browser và owner duyệt nội dung/nguồn story thật | Partial |
| A-LOG-01 | /admin/logs; operations audit | backend/tests/operations/operations.test.js | Browser/admin route trên server tích hợp, stored audit verify và sensitive-log scan toàn luồng | Partial |
| A-UI-01 | Tất cả public/customer/staff/admin pages | fondend/tests/operations/business-settings-form.test.js | Chưa có browser runner/a11y suite; chưa ghi viewport, keyboard, labels, alt, validation và reduced-motion evidence | Pending |
| A-REL-01 | Root check, health/readiness, all modules | backend/tests/health.test.js; scripts/validate-contracts.js | npm run check hoàn chỉnh, build pass, E2E, replica-set races, mounted routers, restore/release rehearsal | Pending |

## Gap tích hợp áp dụng toàn ma trận

1. backend/src/server.js gọi createApp(env), nhưng backend/src/app.js mặc định
   domainRouters là []; chưa có server composition nối route/service ports.
2. Frontend AppRoutes đã lắp các module hiện có, nhưng support P07 chưa được lắp vào
   baseline. P10 cũng chưa có module/test.
3. Root không có Playwright dependency hay test:e2e. Không có browser-to-API evidence.
4. Backend run trên baseline có 139 tests: 137 pass, 2 skip. Hai skip là P05/P06
   replica-set tests do chưa cấu hình test URI. Unit pass không thay thế transactional
   race evidence.
5. Frontend build chưa pass trong P11 worktree vì workspace node_modules chưa được link
   tới source P11; phải chạy lại bằng dependency install/workspace links của checkout
   tích hợp.

Không dùng status Partial làm release approval. Khi P07/P10 và composition root được
merge, cập nhật snapshot commit và chạy lại từng acceptance qua checkout tích hợp.
