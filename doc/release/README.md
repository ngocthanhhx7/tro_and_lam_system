# P11 — trạng thái QA và release

## Kết luận

P11 đã thêm harness Playwright đi qua trình duyệt, Vite, Express và một MongoDB replica set cục bộ riêng cho test. Bằng chứng tích hợp hiện tại đã có, nhưng chưa đủ để chấp thuận mở bán hoặc production. Chưa deploy production, tạo đơn hàng thật hay gọi PayOS, SMTP, Gemini hoặc geocoder thật.

Bằng chứng giao diện mới nhất và các giới hạn của working tree hiện tại nằm trong [interface refresh evidence](interface-refresh-evidence.md).

## Bằng chứng tích hợp

Các lần chạy được ghi ngày 2026-10-06, trên Node 24.21.0.

| Check | Checkout / revision | Kết quả | Giới hạn |
| --- | --- | --- | --- |
| `npm ci` | Checkout QA sạch `D:\WW\tro_lam_final_verify_20261006`, integrated source `be70e7b` | Pass — 312 package, 0 lỗ hổng audit | npm báo phiên bản ESLint đã deprecated; Chromium được cài/cache ngoài repo. |
| `npm run check` | Cùng checkout, integrated source `be70e7b` | Pass — contracts 102 paths / 121 operations / 60 schemas / 22 enums / 23 fixtures; lint sạch; backend 177 pass, 2 skip; Vite build 123 modules | Hai test replica-set P05/P06 skip vì chưa cấu hình URI riêng. Build cảnh báo chunk 522.93 kB. |
| `npm run test:e2e` | Cùng checkout, integrated source `be70e7b` | Pass — 4/4 browser tests | Dùng MongoDB loopback và database riêng theo mẫu P11; teardown xóa database. Không kiểm tra provider staging. |
| `npm run test:e2e` | P11 worktree có dấu `&` trong đường dẫn | Không chạy xong — Vite dependency optimizer lỗi `config.js:32098`, báo thiếu `imports` | Cùng source chạy pass trong checkout sạch có đường dẫn không chứa `&`; ghi nhận đây là giới hạn môi trường path của worktree này. |

E2E xác minh public catalog không lộ draft, khách guest thêm sản phẩm vào giỏ và đọc giỏ qua API, checkout trả đúng trạng thái cấu hình R06 chưa sẵn sàng với nút đặt hàng bị khóa, customer bị từ chối staff/admin API, staff bị từ chối admin API, admin đọc được thống kê/catalog, và truy cập staff ẩn danh bị từ chối. Smoke layout chỉ kiểm tra trang catalog ở viewport 390px.

Checkout E2E cố ý dừng ở lỗi `DATABASE_UNAVAILABLE` từ quote do vùng giao hàng/phí/chính sách checkout chưa được cấu hình. Test không tạo order thành công và không giả lập PayOS thành công. Harness dùng fixture tổng hợp `example.test`, không gửi mail, không gọi provider, và teardown xóa đúng database P11. Sau khi teardown, kiểm tra local MongoDB không còn database tên theo prefix `tro_lam_p11_e2e_test_`.

Lần chạy tích hợp cuối trên `be70e7b` xác nhận lại `npm ci`, `npm run check` và `npm run test:e2e`; sau E2E, truy vấn read-only trên MongoDB cho kết quả `[]` với strict prefix P11. Playwright tạo `test-results/.last-run.json`, đã xóa sau khi xác minh đường dẫn bên trong checkout QA. E2E có hai cảnh báo Mongoose không làm fail test: index trùng `AccountAppeal.userId` và dùng tùy chọn `new` đã deprecated cho `findOneAndUpdate()`/`findOneAndReplace()`.

Ma trận acceptance theo từng luồng ở [acceptance-coverage.md](acceptance-coverage.md). Các unit/route tests chứng minh hành vi được nêu tại đó; chúng không thay thế E2E, replica-set race test hoặc UAT của chủ dự án.

## Còn thiếu trước khi mở bán

- P05/P06 replica-set suites đã qua trên replica set loopback riêng (bằng chứng bên dưới); cần chạy lại trong release CI với URI biệt lập và hoàn tất rehearsal backup/restore Atlas do chủ dự án cung cấp.
- Hoàn tất browser/UAT cho guest order tracking/OTP, address/geolocation, checkout retry/idempotency, customer review/ticket/return, staff fulfillment và admin appeal/mutation. Checkout thật cần chính sách, vùng giao hàng, phí và COD được owner cấu hình.
- Chạy kiểm tra accessibility đầy đủ theo viewport/keyboard/labels/errors/reduced motion; 390px catalog smoke không phải WCAG audit.
- Chạy rehearsal provider ở staging: PayOS sandbox, SMTP mailbox, Gemini quota/fallback và geocoder. Hiện không có kết quả live nào được khẳng định.
- Hoàn thành restore/backup, health/readiness, rollout/rollback và UAT end-to-end trước quyết định release.

## Đầu vào cần chủ dự án cấu hình/xác nhận

Không ghi credential hoặc giá trị secret vào Git. Các ID dưới đây tương ứng với [planning/10-decisions-and-readiness.md](../planning/10-decisions-and-readiness.md).

| ID | Đầu vào owner | Bằng chứng cần có trước production |
| --- | --- | --- |
| R01 | Domain, hosting và quyền triển khai | Cookie/CORS/deep-link và health trên staging |
| R02 | MongoDB Atlas URI, user, access list và backup | Replica-set tests, backup/restore rehearsal |
| R03 | SKU, giá, tồn kho, sale mode, ảnh và quyền sử dụng | Catalog thật được duyệt; xác minh quyền media |
| R04 | SMTP sender/mailbox, recipient và `OUTBOX_ENCRYPTION_KEY` | Mail staging, retry/recovery và worker supervision |
| R05 | PayOS merchant, key và webhook URL | Chữ ký/webhook/reconciliation trên sandbox |
| R06 | Vùng/phí giao hàng, COD, đổi trả/refund và retention | Chính sách allowlist được duyệt; checkout/fulfillment UAT |
| R07 | Địa chỉ, hotline, email và social của cửa hàng | Thông tin liên hệ được duyệt trước public |
| R08 | Nội dung story, nghệ nhân/hoa văn và mapping NFC | Nguồn văn hóa, quyền media và nội dung được duyệt |
| R09 | Geocoder key/quota/billing và dữ liệu địa giới | Kiểm tra provider; giữ manual fallback |
| R10 | Gemini key/model/quota/ngân sách | Kiểm tra staging và fallback/handoff; không coi unit test là provider live |
| R11 | Media storage, backup, retention và RPO/RTO | Upload/retrieval, backup và restore evidence |
| R12 | Admin bootstrap và quy trình khôi phục | [Script/runbook](../runbooks/first-admin-bootstrap.md) và replica-set concurrency test có; owner phải xác nhận kiểm soát DB/mailbox, rehearsal và break-glass recovery còn thiếu |

Chỉ mở những provider cần thiết sau khi owner cấp cấu hình qua secret store. Nếu credential chưa có, adapter và fallback vẫn báo unavailable; không đổi sang kết quả giả thành công.


## Post-run cleanup audit

Two P11 databases left by interrupted browser attempts were verified against the exact `tro_lam_p11_e2e_test_<12 lowercase hex>` pattern and removed by name: `tro_lam_p11_e2e_test_6bb21c7dbf6a` and `tro_lam_p11_e2e_test_bddfcfe9fffa`. A read-only local MongoDB audit then found no matching test database. The untracked `test-results/` directory contained only Playwright's generated `.last-run.json`; its resolved path was verified inside this P11 worktree before removal.

## Follow-up verification (2026-10-06)

Integrated commit `ee68ecd` passed `npm run check`: contract validation (102 paths, 121 operations, 60 DTO schemas, 22 enums, 23 fixtures), lint, 177 backend tests passed with 2 replica-set tests skipped because the default command had no replica-set URI, and Vite production build (128 modules). The build still reports a 536.66 kB minified JavaScript chunk warning. The working tree also contained the separate, uncommitted interface refresh while this check ran.

The two skipped database race suites were then run explicitly against the local loopback MongoDB replica set: P05 final-unit checkout race and P06 unique open-refund race both passed (3 tests total including the refund index assertion; 0 skipped). P05 removed its generated database in `finally`; P06's exact dedicated test database was audited empty and removed afterward. This is local database evidence, not release-CI, Atlas backup/restore, or staging-provider evidence. See [acceptance coverage](acceptance-coverage.md) for the detailed outcome and the separate email verification browser regression.

## Initial admin bootstrap follow-up (2026-10-06)

Added `backend/src/scripts/bootstrap-admin.js` and [the operator runbook](../runbooks/first-admin-bootstrap.md). `backend/tests/identity/admin-bootstrap.replica-set.test.js` verifies explicit database and mailbox confirmation, one-time refusal, transaction serialization when two bootstrap attempts race, Argon2id credentials, verified login, and a redacted audit record. The test is restricted to a loopback URI and tears down its generated database.

With distinct loopback replica-set URIs configured for P02, P05, and P06, the integrated `npm run check` passed on commit `249a170` (the workspace also contained the separate uncommitted interface refresh): 102 OpenAPI paths, 121 operations, 60 DTO schemas, 22 enums, 23 fixtures; lint clean; backend **180 passed, 0 failed, 0 skipped**; Vite build 128 modules. The local P02/P05 generated test databases were removed by teardown. P06's exact dedicated database was audited empty and then removed. This validates the tool against a test replica set only. The owner still must confirm the production database and mailbox, perform the one-time bootstrap, and rehearse break-glass recovery before R12 is complete.

## Clean-checkout browser gate (2026-10-06)

At that point the fresh worktree `D:\WW\tro_lam_verify_20261006_951740b` on `951740b` passed `npm ci` (312 packages) and `npm run check` (180/180 backend tests with P02/P05/P06 loopback replica-set URIs). Its E2E result was **4/5** because `/admin` still rendered `.catalog-header`. The subsequent interface refresh separated the admin shell and added expired-link coverage. The clean source revision `0fb7d9d` then passed `npm run check` (185/185, including all three replica-set suites) and `npm run test:e2e` (6/6); see [interface refresh evidence](interface-refresh-evidence.md).

## P11 browser acceptance follow-up (2026-10-06)

On branch `feature/p11-browser-acceptance`, the latest `npm run test:e2e` passed **8/8** with Node 24.21.0. It used the dedicated loopback replica-set database `tro_lam_p11_e2e_test_5bd7efd260b4`; teardown dropped that database, and a read-only audit found no database matching the strict P11 test-name pattern. The tests exercise address CRUD and ownership, simulated location denial with manual-entry fallback, guest order privacy, a PayOS return that trusts the server's still-pending payment status, and staff fulfillment with persisted inventory, reservation, stock movement, outbox and audit records. Existing catalog, role-boundary and email-verification browser checks also passed.

`npm run check` passed on the same working tree: contract validation, lint, **183 backend tests passed, 3 environment-gated replica-set tests skipped, 0 failed**, and the Vite build transformed 128 modules. The JavaScript bundle remains above the 500 kB advisory threshold (543.66 kB minified). `git diff --check` and JavaScript syntax checks passed. No real provider configuration was present or used; owner provider staging, policy, accessibility, backup/restore and UAT gates remain open. See [acceptance coverage](acceptance-coverage.md) for row-by-row evidence; statuses remain Partial.

## Integrated clean-checkout verification (2026-10-06)

Clean worktree `D:\WW\tro_lam_verify_p11_61e6bd4` at `61e6bd4` completed `npm ci` (312 packages added; 0 reported vulnerabilities). `npm run check` passed: OpenAPI 102 paths / 121 operations / 60 DTO schemas / 22 enums / 23 fixtures; lint clean; backend **186 passed, 0 failed, 0 skipped** with dedicated loopback replica-set URIs for P02/P05/P06; Vite build 129 modules. Bundle is 544.87 kB minified (149.97 kB gzip), above the 500 kB advisory threshold.

`npm run test:e2e` passed **8/8** against loopback database `tro_lam_p11_e2e_test_c055fc712330`; post-run audit found no strict-prefix P11 database. P06 test collections were verified empty before dropping its dedicated database. A read-only audit found no dedicated P02/P05/P06/P11 test databases remaining. Browser smoke also confirmed visible concept disclosures, route metadata, Lifestyle notes, YouTube Vietnamese caption parameters and no horizontal overflow at 360/390/768/1280/1440 px. Screenshots are in [public content follow-up evidence](evidence/public-content-followup/).

The check did not call real providers. Provider staging, domain-dependent prerender/canonical/sitemap, owner-approved product facts and policies, WCAG/screen-reader audit, Atlas restore and owner UAT remain open; no production deploy was performed.

## Guest cart browser acceptance follow-up (2026-10-06)

P11's expanded browser suite passed **9/9** on a dedicated loopback replica set. It verifies guest quantity updates, cart persistence after reload, item removal, separate carts in independent browser contexts, and one-time merge into the customer cart after login. `npm run check` passed contracts, lint, backend **188/188 with 0 skipped**, and the 129-module build. The bundle remains 544.87 kB minified (149.97 kB gzip), above Vite's 500 kB advisory threshold.

The P11 runtime alone raises the global API request limit to 10,000 because its browser tests share one loopback IP. The production `createApp()` defaults remain 100 requests per 15 minutes. The harness removed its database; the P06 replica-set test database was audited empty and removed. No real provider was configured or called. Remaining release gates are provider staging, WCAG/screen-reader review, Atlas restore, owner content/policy approval and UAT.

## Public catalog browser acceptance follow-up (2026-10-06)

P11 now also verifies catalog filters, URL restoration after reload and page navigation across a synthetic 13-product dataset. `npm run test:e2e` passes **10/10**. The full `npm run check` passes contracts, lint, backend **188/188 with 0 skipped**, and build (129 modules). Data is synthetic and confined to the dedicated P11 database, which teardown removes; owner product approval and WCAG remain open.

## Shipping-zone quote and guest COD checkout follow-up (2026-10-06)

On `feature/p05-shipping-zone-quote`, commit `078e555` from `develop` `4a789a3`, DEC-28 specifies `shippingZones` items as `{id, provinceNames, feeVnd}` and adds a fail-closed exact normalized province match. The P09 settings editor validates the same shape; no province list, shipping fee, COD policy, provider result or production configuration was invented. Checkout now asks for province/thành phố before requesting a quote. Guest checkout uses the server-side guest-cart token hash for idempotency, and omits absent `userId` from `order.created` outbox payloads.

`npm run check` passed: contract validation (102 paths, 121 operations, 60 DTO schemas, 22 enums, 26 fixtures), lint, backend **195 passed / 0 failed / 0 skipped** with P02/P05/P06 replica-set suites on isolated loopback databases, and Vite build (129 modules). `npm run test:e2e` passed **11/11** against its own strict-prefix loopback test database. The browser suite verifies both unconfigured 503 fallback and successful COD quote/order in a dedicated test database; the synthetic fee was 28,000 VND and the persisted order total matched the quote. Post-run read-only audit found no dedicated P02/P05/P06/P11 database remaining.

No provider credentials were configured or called, and no production deploy was performed. Actual zones/fees, COD and return/refund policy remain R06 owner inputs. The JS bundle is 546.63 kB minified (150.58 kB gzip), above Vite's 500 kB advisory threshold. These checks are local implementation evidence, not owner UAT, provider staging, accessibility review, Atlas backup/restore or release approval.

The guest COD browser flow now follows the post-checkout “Xem chi tiết đơn” link as well. The order-detail request succeeds using the guest proof cookie, and the page shows the created order code and “P11 Shipping Fixture” recipient. `npm run test:e2e` passed **11/11** on Node 24.21.0; teardown removed the dedicated loopback database and a post-run audit found no P02/P05/P06/P11 test databases. This adds browser evidence for A-GST-03 but does not cover OTP delivery or invalid-credential response parity. No live provider was configured or called.

## Guest order lookup OTP browser follow-up (2026-10-06)

P11 now exercises `/tra-cuu-don-hang` through the real API and MongoDB test replica set. Unknown order/email and matching order/email requests return the same accepted response shape. A missing challenge and a wrong code return the same generic error; neither reveals order PII. The browser reads the expected OTP only by decrypting the synthetic encrypted P09 outbox payload with a fresh in-memory test key, submits it through the page and reaches the correct order detail. The invalid code is submitted once before the valid code, proving that failed verification does not consume the challenge.

In the isolated P11 worktree, `npm ci` installed 312 packages with 0 reported vulnerabilities. `npm run test:e2e` passed **12/12**; `npm run check` passed contract validation (102 paths, 121 operations, 60 DTO schemas, 22 enums, 26 fixtures), lint, backend **195/195 with 0 skipped**, and the 129-module build. The browser database was removed at teardown. P02/P05 databases were removed by their tests; the P06 database was audited empty and dropped; a final audit found no dedicated P02/P05/P06/P11 databases.

The test does not send email or claim SMTP delivery: no SMTP, PayOS, Gemini or geocoder provider was configured or called. Real inbox delivery, mailbox deliverability, distributed rate-limit behavior and owner UAT remain open. No production deployment occurred. The bundle warning remains at 546.63 kB minified (150.58 kB gzip).

## P11 notification ownership browser follow-up (2026-10-06)

The P11 runtime seeds two unread notifications for the synthetic customer and one for a different customer. The browser confirms that the signed-in customer sees only their own rows, receives 404 when trying to mark the other customer's notification as read, and persists both mark-one and mark-all changes only on their own records.

`npm run test:e2e` passed **13/13**. `npm run check` passed contract validation, lint, backend **195/195 with 0 skipped** including P02/P05/P06 loopback replica-set tests, and the 129-module build. Teardown removed the isolated browser database; the exact empty P06 test database was audited and dropped; no P02/P05/P06/P11 test databases remained. This uses synthetic notifications and does not claim outbox projection or real delivery. No external provider or production deployment was used. WCAG, notification event projection and owner UAT remain open.

## P11 support ticket browser follow-up (2026-10-06)

The integrated browser flow creates an order-linked complaint as the customer, rejects a customer attempt to create an internal note (403 `FORBIDDEN`), lets staff claim the ticket and send an internal note plus a customer-visible reply, then lets the customer reply. The customer thread omits the internal note; staff sees all four persisted messages. The final database assertion checks author role, visibility and order.

`npm run test:e2e` passed **14/14** on the dedicated loopback replica set. The full `npm run check` passed contracts, lint and backend **195/195 with 0 skipped**, plus the 129-module build. Teardown removed the isolated E2E database; post-run audit confirmed no dedicated P02/P05/P06/P11 databases. No SMTP or storage provider was configured or called; attachment upload/finalize/download, storage staging and broader owner UAT remain open. No production deployment occurred.

## P05 guest checkout idempotency browser follow-up (2026-10-06)

The P11 browser flow replays the successful guest checkout using the exact original request body and `Idempotency-Key`. The replay returns HTTP 200 with the same order ID and code; reusing the key after changing the note returns HTTP 409 `IDEMPOTENCY_CONFLICT`. The E2E request helper serializes object bodies as JSON, and the OTP test requires a real 403 `FORBIDDEN` for both unknown and wrong credentials before comparing the generic error shape.

`npm run test:e2e` passed **12/12**. `npm run check` passed contracts (102 paths, 121 operations, 60 DTO schemas, 22 enums, 26 fixtures), lint, backend **195/195 with 0 skipped** including P02/P05/P06 loopback replica-set suites, and build (129 modules). The dedicated browser database was removed by teardown; an audit found no P02/P05/P06/P11 test databases after the run. No real provider was configured or called. CI replica-set coverage, owner network-interruption retry UAT, provider staging, WCAG, Atlas restore and business-policy inputs remain release gates; no production deploy occurred.

## P11 review moderation browser follow-up (2026-10-06)

The customer submits a review for a delivered synthetic order. The browser confirms that its pending state is private from the public product API, an admin publishes it, and a fresh page load still shows the published review. A direct database assertion verifies the review and redacted moderation audit were committed on the loopback replica set.

`npm run test:e2e` passed **15/15**. `npm run check` passed contract validation (102 paths, 121 operations, 60 DTO schemas, 22 enums, 26 fixtures), lint, backend **195/195 with 0 skipped** using distinct local loopback P02/P05/P06 replica-set URIs, and the 129-module build. The dedicated P11 database was removed at teardown; P02/P05 databases were removed by their tests; P06 collections were audited empty and the exact database was removed. No external provider was configured or called. Vite reports a 546.63 kB minified JavaScript bundle (150.58 kB gzip), above its 500 kB advisory threshold. Moderation UAT, accessibility, provider staging, CI replica-set coverage, Atlas restore and owner approval remain open; no production deploy occurred.

## P11 registration and email verification browser follow-up (2026-10-06)

The integrated P11 browser test registers a synthetic customer through the application, reads the verification link only from its encrypted test outbox, submits that one-time fragment token, confirms the stored user is verified and the challenge consumed, and follows the success redirect to `/dang-nhap?verified=1`. It confirms no session cookie is issued by verification itself, then signs in successfully. The test reads no real mailbox and does not claim SMTP delivery.

`npm run test:e2e` passed **16/16** on a dedicated loopback replica-set database. `npm run check` passed contracts, lint, backend **195/195 with 0 skipped**, and the 129-module build. P02/P05 test databases were removed by their tests; P06 collections were audited empty and that exact database was removed; teardown deleted the P11 database and a final strict-prefix audit found no P02/P05/P06/P11 test databases. The E2E runtime raises both IP and identity login limits only within its test composition because the browser flows share one loopback IP; production defaults are unchanged and route tests cover those defaults. No real provider was configured or called. Gmail/SMTP staging, reset/logout browser paths and no-enumeration UAT remain open. No production deploy occurred.

## P11 blocked-account appeal and admin decision browser follow-up (2026-10-06)

P11 now runs the admin user search and status form to block a synthetic customer with a required reason. The blocked customer cannot sign in, submits an appeal and reloads to read the persisted message. An admin opens the pending appeal, records a confirmed approval decision and note, and the browser verifies the account is active while the old auth version has been invalidated. Direct database assertions check the approved appeal, user state and redacted decision audit; the customer then establishes a fresh session successfully.

`npm run test:e2e` passed **17/17** on a dedicated loopback replica set. `npm run check` passed contract validation (102 paths, 121 operations, 60 DTO schemas, 22 enums, 26 fixtures), lint, backend **195/195 with 0 skipped** using separate P02/P05/P06 loopback replica-set URIs, and the 129-module build. P11 teardown removed its database; P02/P05 tests removed their databases; P06 collections were audited empty and its exact database removed. Final audit found no dedicated P02/P05/P06/P11 database. No SMTP, PayOS, Gemini, geocoder or storage provider was configured or called. Appeal rejection/resubmission UAT, provider staging, accessibility, CI replica-set coverage, Atlas restore and owner approval remain open. No production deploy occurred.

The browser flow exposed that audit redaction treated a valid 24-character Mongo ObjectId containing a long digit run as a phone number and replaced its `targetId` with null. Audit sanitization now preserves canonical Mongo ObjectIds, with a regression case for the affected pattern; ordinary free-text audit values remain redacted. The staff shipment and appeal browser flows assert their persisted target IDs.

## P11 password reset browser follow-up (2026-10-06)

The customer starts with an existing session, requests a password reset, and uses the fragment link read only from the encrypted test outbox. The browser submits the new password through the real reset route; database checks confirm the challenge was consumed and every old session revoked. Login with the old password returns `401 AUTH_REQUIRED`; login with the new password succeeds.

`npm run test:e2e` passed **18/18** on a dedicated loopback replica set, with teardown deleting the P11 database. `npm run check` passed contract validation, lint, backend **195/195 with 0 skipped** using separate P02/P05/P06 loopback URIs, and the 129-module build. Final strict-prefix audit found no dedicated P02/P05/P06/P11 test database after empty P06 collections were checked and its exact database removed. At this checkpoint, real SMTP/mailbox delivery, browser logout coverage and owner UAT remained open. No production deploy occurred.

## P11 customer logout browser follow-up (2026-10-06)

The browser authenticates the second synthetic customer, calls the CSRF-protected logout route with the real browser cookies, and confirms HTTP 204, removal of the HttpOnly session cookie, `401 AUTH_REQUIRED` from `/auth/me`, and a persisted `revokedAt` on the server session. At this checkpoint, the customer interface still had no shared visible logout action; the follow-up below closes that gap.

`npm run test:e2e` passed **19/19** on a dedicated loopback replica-set database, removed by teardown. `npm run check` passed OpenAPI contract validation (102 paths, 121 operations, 60 schemas, 22 enums, 26 fixtures), lint, backend **195/195 with 0 skipped** using separate loopback P02/P05/P06 test URIs, and the 129-module build. P02/P05/P11 databases were absent after testing; the exact P06 database was audited to contain only three empty collections and removed, then a strict-prefix audit found no dedicated P02/P05/P06/P11 test database. Build output remains 546.63 kB minified, above Vite's 500 kB advisory threshold. No real provider or production service was used. SMTP staging, WCAG, Atlas restore and owner UAT remain open.

## Storefront product-line imagery follow-up (2026-10-06)

The home page retains its existing sequence: brand hero, TRO & LAM journey, Lifestyle, Diplomacy, featured “Gốm dành cho bạn”, then film/story. Lifestyle and Diplomacy story blocks and their catalog landing pages now use matching product concept images from the existing manifest. Each image keeps a visible AI/concept disclosure and an alt description that does not claim it is a real product photograph. No catalog facts, sale mode, API, price, stock or permissions changed.

`npm ci` installed 312 packages with 0 reported vulnerabilities. `npm run test:e2e` passed **20/20** on a dedicated loopback P11 replica-set database; teardown removed it. The new browser check verifies the brand-journey heading, both home line blocks, “Gốm dành cho bạn”, image paths/disclosures, and navigation to both line landing pages. `npm run check` passed contract validation (102 paths, 121 operations, 60 schemas, 22 enums, 26 fixtures), lint, backend **195/195 with 0 skipped** using distinct loopback P02/P05/P06 test URIs, and build (129 modules). The bundle is 547.35 kB minified (150.71 kB gzip), above Vite's 500 kB advisory threshold. A final strict-prefix audit found no P02/P05/P06/P11 test database after the exact empty P06 database was removed. No live provider or production database was used; owner-supplied real SKU photography, accessibility audit and UAT remain open.

## Storefront and quick-contact follow-up (2026-10-06)

The public shell now exposes Zalo `0966051231`, Messenger for Facebook `gomchudautrovalam`, and Hotline `0966051231`, transcribed from the owner-supplied [project brief](https://docs.google.com/document/d/1V1sre6nXfQUNeK3DYJRosxhiNRFtMxLp3uxWBLQk9e4/edit?tab=t.0). It uses the existing ivory, deep-blue and gold palette, leaves the assistant at the opposite lower corner, and retains accessible link names when labels collapse on narrow screens.

`npm run test:e2e` passed **21/21** on a dedicated loopback P11 replica set; teardown removed it and the post-run audit found no P11 test database. The contact test verifies exact Zalo, Messenger and `tel:` destinations, external-link safety, accessible names, no horizontal overflow and separation from the assistant at 360, 390 and 1280 px. `npm run check` passed contract validation (102 paths, 121 operations, 60 schemas, 22 enums, 26 fixtures), lint, backend **195/195 with 0 skipped** using distinct P02/P05/P06 loopback replica-set URIs, and Vite build (130 modules). The minified bundle is 548.52 kB, over Vite's 500 kB advisory threshold. All generated test databases were removed after empty-collection audit; no live provider or production database was used. [Mobile screenshot](evidence/interface-followup/quick-contact-390.png) and [desktop screenshot](evidence/interface-followup/quick-contact-1280.png) show the home hero with stubbed empty product data. WCAG/screen-reader audit and owner UAT remain open; no production deploy occurred.

## Public editorial brand refinement (2026-10-06)

The owner design brief is reflected in the public storefront: deep Chu Đậu blue, restrained metallic-gold accents and ivory surfaces; local Noto Serif/Be Vietnam Pro typography; generous editorial image layouts; and a low-contrast lotus line ornament inspired by the existing logo. The original logo asset is unchanged. Product detail pages now reserve an editorial story section for every product and show a clear pending message when no owner-approved story is linked, rather than generating cultural claims.

`npm run check` passed contract validation (102 paths, 121 operations, 60 schemas, 22 enums, 26 fixtures), lint, backend **195 passed / 0 failed / 0 skipped** with dedicated loopback P02/P05/P06 replica-set URIs, and Vite build (130 modules). `npm run test:e2e` passed **21/21** on a dedicated P11 loopback database; home story/line layout, line imagery disclosures, narrow widths through 1440 px, product story pending state and reduced-motion hero behavior passed. P02/P05/P06/P11 test database audit returned empty after teardown and cleanup of the exact empty P06 database. Bundle output is 549.38 kB minified (151.41 kB gzip), above Vite's 500 kB advisory threshold. No live provider, production data or deployment was used. Real SKU photography, owner-approved cultural copy, screen-reader/WCAG review and owner UAT remain open.

Visual evidence: [home desktop](evidence/interface-followup/brand-home-1280.jpg), [home mobile](evidence/interface-followup/brand-home-390.jpg), [lotus accent desktop](evidence/interface-followup/brand-lotus-closing-1280.jpg), [lotus accent mobile](evidence/interface-followup/brand-lotus-closing-390.jpg), and [pending story section from a synthetic E2E fixture](evidence/interface-followup/story-pending-test-fixture.jpg). Home screenshots use an empty product-list stub; they do not represent live catalog data.

## Customer and workspace logout controls (2026-10-06)

The integrated customer shell now exposes logout on desktop and in the mobile navigation. Staff and admin workspaces also show a session action. The control calls the logout API before clearing client identity; on a failed request, it keeps the session state and shows a retry message. A successful logout returns the customer to `/dang-nhap`.

On candidate revision `b82eaf3`, `npm ci` and `npm audit` completed with 0 reported vulnerabilities. `npm run check` passed contract validation (102 paths, 121 operations, 60 schemas, 22 enums, 26 fixtures), lint, backend **195/195 with 0 skipped**, and the Vite production build (132 modules). Vite still warns that the minified JavaScript bundle exceeds its 500 kB advisory threshold. `npm run test:e2e` passed **21/21** on a disposable local loopback database. The browser test opens mobile navigation, clicks the visible logout action, verifies HTTP 204, redirect to login, cookie removal, `401 AUTH_REQUIRED`, and the persisted revoked session.

After teardown, a read-only audit found no P02/P05/P06/P11 test databases. The one existing P06 test database had three empty collections; it was dropped after the exact name and empty counts were verified. No live SMTP, PayOS, Gemini, geocoder or production database was called. The visual evidence above shows the requested deep-blue, gold and ivory palette, Vietnamese serif/sans-serif typography, restrained logo-inspired lotus detail and editorial product imagery. Concept images remain visibly disclosed and are not real SKU photographs. Owner-provided product photos (at least three views per SKU), approved cultural stories, provider staging, WCAG/screen-reader review, Atlas restore and UAT remain open. No production deployment occurred.
