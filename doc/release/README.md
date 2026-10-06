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
