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
| R07 | Hotline/Zalo `0966051231` và Facebook/Messenger `gomchudautrovalam` đã có trong [hồ sơ kênh liên hệ](../brand/contact-channels.md); địa chỉ cửa hàng, email và giờ làm việc chưa được xác nhận | Xác nhận các chi tiết còn thiếu và tiếp tục dùng đúng hotline/social đã cung cấp |
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

After teardown, a read-only audit found no P02/P05/P06/P11 test databases. The one existing P06 test database had three empty collections; it was dropped after the exact name and empty counts were verified. No live SMTP, PayOS, Gemini, geocoder or production database was called. The visual evidence above shows the requested deep-blue, gold and ivory palette, Vietnamese serif/sans-serif typography, restrained logo-inspired lotus detail and editorial product imagery. Concept images remain visibly disclosed and are not real SKU photographs. Owner-provided product photos and usage rights, approved cultural stories, provider staging, WCAG/screen-reader review, Atlas restore and UAT remain open. No production deployment occurred.

## P08/P10 and storefront accessibility browser acceptance (2026-10-06)

On clean worktree `D:\WW\tro_lam_verify_a11y_20261006` at candidate `b19b9ae`, P11 exercises two additional flows through Chromium, Vite, Express and the isolated loopback MongoDB replica set. The content flow creates a synthetic draft through the admin API and confirms the public story route stays hidden; publishes it and verifies only the Vietnamese locale renders; creates an NFC tag and reads the published story; then revokes the tag and confirms its story content is no longer shown. All content is explicitly synthetic and makes no cultural or product-provenance claim.

The guest assistant flow runs with Gemini disabled and a zero test budget. It confirms the real API returns the documented unavailable fallback, empty citations and a handoff suggestion; the UI renders that response and the separate guest-owner cookie remains HttpOnly and scoped to `/api/v1/assistant`. This is fallback/browser evidence, not a live Gemini result or delivered human response.

Axe 4.13.0 scans nine public routes at 390px and 1280px and the open mobile navigation against WCAG 2.0/2.1 A/AA and WCAG 2.2 AA rules. The selected scans pass with no violations after low-contrast caption and gold-accent colors were darkened. Escape closes the mobile dialog and restores focus to its opener. This automated scan is not a manual screen-reader or complete WCAG audit.

`npm ci` installed 314 packages and reported 0 vulnerabilities. `npm run check` passed contracts (102 paths, 121 operations, 60 schemas, 22 enums, 26 fixtures), lint, backend **195/195 with 0 skipped**, and Vite build (132 modules; the JavaScript bundle remains above the 500 kB advisory threshold). `npm run test:e2e` passed **24/24**.

P11 teardown removed its database. P02/P05 test databases were removed by their tests; the exact P06 database was audited to contain three empty collections and removed. A final read-only prefix audit returned `[]` for dedicated P02/P05/P06/P11 databases. No provider credentials, external provider calls, production data or deployment were used. Gemini staging, cultural-source approval, manual screen-reader/full WCAG review, Atlas restore and owner UAT remain open.

## GitHub Actions quality workflow (2026-10-06)

Added [`.github/workflows/quality.yml`](../../.github/workflows/quality.yml) for pull requests and pushes to `develop`/`main`, plus manual dispatch. It installs the locked Node 24 dependencies and Chromium, starts a disposable MongoDB 7 single-node replica set, sets distinct loopback databases for P02/P05/P06/P11, then runs `npm run check` and `npm run test:e2e`. It has read-only repository permissions and does not configure SMTP, PayOS, Gemini, geocoder, storage, Atlas or production credentials. The test Mongo container is removed even when a preceding step fails.

This turn could not execute the workflow locally because Docker is not installed in the Windows workspace; the workflow has not yet produced a GitHub Actions run. Local clean-worktree verification remains the evidence above. The first remote `quality` run, owner-controlled branch rules, provider staging, restore rehearsal, manual accessibility review and UAT remain open.

## Local run with the quality workflow database settings (2026-10-06)

On clean verification worktree `D:\WW\tro_lam_verify_a11y_20261006` at `b19b9ae`, Node `24.21.0`, `npm run check` passed with the same loopback P02/P05/P06 replica-set URI variables configured by `quality`: contract validation (102 paths, 121 operations, 60 schemas, 22 enums, 26 fixtures), lint, backend **195/195 with 0 skips**, and Vite build (132 modules; 550.77 kB minified JavaScript, above the 500 kB advisory threshold). `npm run test:e2e` passed **24/24** with the strict P11 test-database name pattern. YAML parsing also confirmed the workflow triggers and both check/E2E steps. A post-run MongoDB audit found `[]` for dedicated P02/P05/P06/P11 database prefixes after verifying and removing the exact empty P06 test database. This validates the environment settings and tests locally, not the GitHub-hosted container startup or remote Actions result. No provider or production service was configured or called.

## Catalog publication image minimum and current storefront brief (2026-10-06)

The first P11 acceptance revision permitted image-free drafts and required at least three gallery images before publication. The owner clarified the rule on 2026-10-07: published products may have 1–5 images, while the demo catalog keeps exactly three per product. The current API, admin form and tests enforce that clarification.

On a clean verification worktree based on integrated revision `90dc763`, Node `24.21.0`, `npm run check` passed contracts (102 paths, 121 operations, 60 DTO schemas, 22 enums, 26 fixtures), lint, backend **196/196 with 0 skipped** using separate local loopback P02/P05/P06 replica-set URIs, and Vite build (132 modules). `npm run test:e2e` passed **25/25**, including the public home and line pages, quick-contact links, mobile/desktop axe scans, admin catalog CRUD, registration verification and password reset. The JavaScript bundle is 551.12 kB minified (151.89 kB gzip), above Vite's 500 kB advisory threshold.

The P11 teardown removed its uniquely named test database. P02/P05 removed their generated databases; P06's exact database had three empty collections and zero documents before removal. Final prefix audit found no P02/P05/P06/P11 test database. No live provider, production database or deployment was used.

The latest owner brief is reflected in the current storefront: deep blue-green and gold accents on ivory, self-hosted Noto Serif/Be Vietnam Pro, editorial layouts, ceramic imagery disclosures and a restrained lotus ornament based on the supplied logo. Concept media is not represented as real SKU photography. Owner-approved product images/rights and product data (R03), cultural content approval (R08), remote CI execution, provider staging, manual accessibility review, Atlas restore rehearsal and owner UAT remain open.

## Clean-install acceptance on commit 694ae9a (2026-10-06)

A fresh detached worktree at `694ae9a` completed `npm ci` with 314 packages and 0 audit vulnerabilities. The only install notice was the existing ESLint 9 deprecation warning. `npm run check` passed contract validation (102 paths, 121 operations, 60 DTO schemas, 22 enums and 26 fixtures), lint, backend **196/196 with 0 skipped**, and the 132-module production build. Vite reports a 551.12 kB minified JavaScript bundle above its 500 kB advisory threshold.

`npm run test:e2e` passed **25/25** using a new P11 loopback test database. After teardown, P11 database `tro_lam_p11_e2e_test_a749bb420a1e` was absent; P02/P05 databases were removed by their tests. P06 database `tro_lam_p06_test_454af9cd4409` had three empty collections and zero documents before exact cleanup. Final audit found no P02/P05/P06/P11 databases.

This verifies the locked install and current local acceptance suite. The first GitHub Actions run, owner SKU photography and rights, approved cultural content, provider staging, manual accessibility review, Atlas restore rehearsal and owner UAT remain outstanding. No production deployment or live provider call occurred.

## P11 admin role-change browser follow-up (2026-10-07)

The admin browser flow changes a synthetic customer to staff through the real role endpoint. It checks that the form requires both a reason and explicit confirmation, verifies the success response and persisted role, confirms the former customer session returns `401 SESSION_EXPIRED`, and reads the session revocations plus redacted `identity.user.role` audit record from the isolated test database.

`npm run test:e2e` passed **26/26** in the clean verification checkout. The clean source revision passed `npm run check`: contract validation, lint, backend **196/196 with 0 skipped**, and the 132-module Vite build. A read-only local-loopback prefix audit found no P02/P05/P11 databases. The exact P06 database `tro_lam_p06_test_cc096f3ed05d` contained three empty collections and zero documents before it was removed; a second prefix audit was clean. No real SMTP, PayOS, Gemini, geocoder, production database or deployment was used. The first GitHub Actions run, provider staging, owner UAT, manual accessibility review and Atlas restore rehearsal remain open.

## P02 last-admin concurrent role-change replica-set follow-up (2026-10-07)

A dedicated loopback MongoDB replica-set test races two active administrators attempting to demote each other. Exactly one role mutation succeeds; one active administrator remains, the demoted account's auth version increments and its old session is revoked, and one successful redacted role audit is persisted. The service-level fake-repository test remains as a fast unit check.

In the isolated `feature/p02-last-admin-race` worktree, `npm run check` passed contract validation, lint, backend **197/197 with 0 skipped**, and Vite build (132 modules). The suite ran with distinct loopback replica-set URIs for P02/P05/P06; the final read-only database-prefix audit returned `[]` for P02/P05/P06/P11. No live provider, production data or deployment was used. The first remote GitHub Actions run and owner admin-bootstrap/recovery rehearsal remain open.

## P11 admin audit-filter browser follow-up (2026-10-07)

The admin role-change browser flow now follows its real persisted audit event into `/admin/logs`. It filters by action, target ID and a date range, verifies the query sent to the live test API, opens the redacted detail, and checks the affected customer's email is absent.

The targeted browser flow passed **1/1**; the complete suite passed **26/26**. On the same worktree, `npm run check` passed contracts, lint, backend **197/197 with 0 skipped**, and the 132-module build. The read-only database-prefix audit returned `[]` for P02/P05/P06/P11 after teardown. No provider or production database was used. A full sensitive-log scan and manual accessibility review remain open.

## P11 catalog API-error recovery browser follow-up (2026-10-07)

The catalog browser flow receives a test-only 503 from the list endpoint, checks the visible error and retry control, then retries into a separately stubbed empty 200 response. The page renders its empty state and clears the error alert. No sample listing or provider result is fabricated.

The focused test passed **1/1**; the complete `npm run test:e2e` passed **27/27**. `npm run check` passed contracts, lint, backend **197/197 with 0 skipped**, and Vite build (132 modules). The local read-only test-database-prefix audit returned `[]` for P02/P05/P06/P11 after teardown. WCAG review and owner catalog UAT remain open.

## P11 staff support queue browser follow-up (2026-10-07)

The customer/staff support round-trip now starts from `/staff/support`: it confirms a new ticket appears in the open queue, opens the ticket from that list, claims it, returns to the queue, selects the `assigned` filter and verifies the matching API request and ticket status, then opens it again from the filtered results. Existing assertions continue through the staff/customer conversation and ensure the customer cannot see the internal note.

The focused browser test passed **1/1**, and `npm run test:e2e` passed **27/27**. `npm run check` passed contract validation, lint and backend **197/197 with 0 skipped**, then built the 132-module frontend. The minified JavaScript bundle remains **551.12 kB**, above Vite's 500 kB advisory threshold. The local loopback database audit returned `[]` for P02/P05/P06/P11 after cleanup; the exact empty P06 test database was verified to contain zero documents before removal. No real provider, production database or deployment was used. Broader staff capability UAT, provider staging, remote GitHub Actions execution and manual accessibility review remain open.

## P11 public contact and staff lead queue browser follow-up (2026-10-07)

The public contact form submits a synthetic inquiry and receives only a reference ID plus `deliveryStatus: queued`; the response does not expose the submitted email or message. The anonymous browser is denied `/staff/contacts`. A staff session loads the lead in the default `new` queue, filters by contact kind, claims it, changes it to `contacted` with an internal note, and filters it back from the contacted queue. Database assertions verify the contact, encrypted `new_lead` outbox event and both successful status/assignment audit events. The test harness uses only `support.p11@example.test`; background workers are disabled, so no real email is sent.

`npm ci` installed 314 packages with 0 audit vulnerabilities. The focused browser test passed **1/1**; the full `npm run test:e2e` passed **28/28**. `npm run check` passed contract validation, lint and backend **197/197 with 0 skipped**, then built the 132-module frontend. The minified JavaScript bundle remains **551.12 kB**, above Vite's 500 kB advisory threshold. A post-cleanup audit returned `[]` for dedicated P02/P05/P06/P11 databases after confirming the exact empty P06 database had zero documents before removal. No SMTP, production data or deployment was used. SMTP staging/deliverability, broader staff UAT, remote GitHub Actions execution and manual accessibility review remain open.

## Public route code splitting (2026-10-07)

Public, account, staff, and admin page modules now load when their route is opened. A shared accessible suspense state covers the brief module load. Browser acceptance checks that the public home page does not request admin or staff page modules; the existing end-to-end suite continues through customer, staff, and admin routes to verify navigation and guards.

On the isolated `feature/perf-route-splitting` worktree, `npm ci` installed 314 packages with 0 audit vulnerabilities. `npm run build` produced 133 modules: the entry JavaScript fell from **551.12 kB** (151.89 kB gzip) to **301.43 kB** (95.72 kB gzip), with route-specific chunks and no Vite chunk-size warning. The focused home flow passed **1/1**; full `npm run test:e2e` passed **28/28**; `npm run check` passed contracts, lint, backend **197/197 with 0 skipped**, and build. A post-cleanup local database-prefix audit returned `[]` for P02/P05/P06/P11 after verifying and dropping the exact empty P06 test database. No production service or provider was used. This improves initial JavaScript transfer; it does not replace field performance measurement on the owner-configured hosting/domain.

## Published CMS/story/NFC metadata follow-up (2026-10-07)

Published story, CMS page and active NFC routes set title, description, Open Graph and Twitter metadata from the published title and first paragraph. Unpublished/locale-missing content and revoked NFC use status-specific metadata without publishing draft text. The focused metadata browser flow passed **1/1** and the full `npm run test:e2e` passed **28/28**. `npm run check` passed contracts, lint, backend **197/197 with 0 skipped**, and the 133-module route-split build (301.79 kB entry JavaScript, 95.86 kB gzip). The test database `tro_lam_p06_test_524ff9f2bd6c` was verified at zero documents before removal; a final P02/P05/P06/P11 prefix audit returned `[]`. This metadata runs after client-side content loads; initial HTML metadata, SSR/prerender, canonical/share URLs, sitemap and Search Console still require an owner-configured domain and hosting. No live provider, production database or deployment was used.

The project already included the `ai-seo` and `seo-audit` Claude Code skills. Added `.claude/skills/tro-lam-search-copy/SKILL.md` for Vietnamese brand copy with owner/source-backed claims, honest concept-image disclosures and current-guidance checks for SEO/GEO markup. Claude Code discovery lists all three skills at project scope. Claude CLI was not run.

## Integrated notification, address snapshot and locale acceptance (2026-10-07)

P09 commit `6c10f94` adds a local MongoDB replica-set test for the actual `operations.delivery` outbox projection. It validates the event, persists one notification per recipient, simulates a lost sent acknowledgement, retries without duplicating or replacing notification IDs, and verifies owner-scoped list/read behavior. The focused test passed **1/1**; the full integrated backend suite passed **198/198 with 0 skips** after enabling P02/P05/P06/P09 loopback replica-set tests.

P11 commit `b710600` changes the checkout acceptance flow to use a saved customer address. It creates an order, edits and deletes that address in the browser, and checks both API and database state to confirm the order recipient snapshot stays unchanged. The focused flow passed **1/1**; the integrated `npm run test:e2e` passed **28/28**, including English published CMS Open Graph locale `en_US` and the address snapshot flow.

Locale metadata commit `2131fd8` carries the selected published locale to Open Graph (`vi_VN` or `en_US`) for published story, CMS and NFC content. Missing/unpublished/revoked states retain their status-specific metadata. `npm run check` passed OpenAPI validation (102 paths, 121 operations, 60 DTO schemas, 22 frozen enums, 26 fixtures), lint with no warnings, backend 198/198 with no skips, and the 133-module production build (301.86 kB entry JavaScript, 95.88 kB gzip).


## P09 replica-set coverage added to quality workflow (2026-10-07)

The GitHub Actions quality job now sets `P09_TEST_REPLICA_SET_URI` in addition to P02/P05/P06. A local run of that exact check composition against the available loopback replica-set PRIMARY passed contracts, lint, backend **198/198 with 0 skipped** and the 134-module build. The run executed the P02 bootstrap/last-admin races, P05 stock reservation race, P06 open-refund unique-index race and P09 outbox notification projection. Test-created database state was audited; empty P06 indexed test databases were removed, and the final P02/P05/P06/P09 prefix audit returned empty. This is local evidence only; no remote GitHub Actions run has been triggered.

## P07 guest order support browser follow-up (2026-10-07)

The guest order support flow now accepts up to five private image attachments, links the initial message to its ticket, opens a guest-safe conversation route, and exposes a support link from order details. The browser acceptance verifies order access through the normal email challenge, upload/finalize/download, staff customer-visible reply and internal note, guest follow-up, and denial of ticket access without the order proof. Ticket ownership and attachment linkage are also checked in the isolated P11 database.

`npm run test:e2e` passed **38/38** against a fresh loopback P11 database; teardown dropped that exact database and removed its temporary media directories. With the P02/P05/P06/P09 loopback replica-set suites enabled, `npm run check` passed contracts (102 paths, 121 operations, 60 DTO schemas, 22 frozen enums, 26 DTO fixtures), lint, backend **205/205 with 0 skipped**, and the 135-module Vite build (302.52 kB entry JavaScript, 96.07 kB gzip). A post-check read-only prefix audit found no P02/P05/P06/P09/P11 test databases; the exact empty P06 test database was verified at zero documents before removal. No live provider, Atlas data, or production deployment was used. Guest support and attachment behavior is covered locally; durable production attachment storage and its R11 retention/backup policy still need owner configuration.

## P06 failed-refund stale-version guard (2026-10-07)

The internal `failRefund` service now accepts an optional expected version and returns `VERSION_CONFLICT` without changing the refund or paid aggregate when the caller is stale. The payment-service regression test checks the stale request first, then records the failure against the current version and confirms the order returns to `paid`. The focused payment suite passed **11/11** and lint passed. `npm run check` passed contract validation (102 paths, 121 operations, 60 DTO schemas, 22 enums, 26 fixtures), lint, backend **200 passed / 5 skipped / 0 failed**, and the 135-module build. The five skips are the environment-gated P02 bootstrap/last-admin races, P05 checkout race, P06 open-refund index race, and P09 outbox projection; this run did not configure their replica-set URIs. No public API or permission changed. Admin still has no operation to record a manual refund failure; the owner decision to add a route remains pending. No provider, remote database, or production system was used.
