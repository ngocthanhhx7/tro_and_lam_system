# P11 — trạng thái QA và release

## Kết luận

P11 đã thêm harness Playwright đi qua trình duyệt, Vite, Express và một MongoDB replica set cục bộ riêng cho test. Bằng chứng tích hợp hiện tại đã có, nhưng chưa đủ để chấp thuận mở bán hoặc production. Chưa deploy production, tạo đơn hàng thật hay gọi PayOS, SMTP, Gemini hoặc geocoder thật.

## Bằng chứng tích hợp

Các lần chạy được ghi ngày 2026-10-06, trên Node 24.21.0.

| Check | Checkout / revision | Kết quả | Giới hạn |
| --- | --- | --- | --- |
| `npm ci` | Checkout QA sạch, dùng package-lock và allowlist script đã commit | Pass | Không đưa browser binary vào Git; dùng Chromium cài/cached ngoài repo |
| `npm run check` | P11 worktree `D:\WW\tro&lam_system\.worktrees\p11-release`, source `b8d6cae` | Pass — contracts 102 paths / 121 operations / 60 schemas / 22 enums / 23 fixtures; lint sạch; backend 177 pass, 2 skip; Vite build 123 modules | Hai test replica-set P05/P06 skip vì chưa cấu hình URI riêng. Build có cảnh báo chunk 522.93 kB. |
| `npm run test:e2e` | Checkout QA sạch `D:\WW\tro_lam_integration_verify_20261006`, source `274aa34` (coordinator base `c755481` cùng P11 `5da5c1b` và `218c85a`) | Pass — 4/4 browser tests | Chạy bằng URI mới, loopback, database riêng khớp mẫu P11. Không kiểm tra provider staging. |
| `npm run test:e2e` | P11 worktree có dấu `&` trong đường dẫn | Không chạy xong — Vite dependency optimizer lỗi `config.js:32098`, báo thiếu `imports` | Cùng source chạy pass trong checkout sạch có đường dẫn không chứa `&`; ghi nhận đây là giới hạn môi trường path của worktree này. |

E2E xác minh public catalog không lộ draft, khách guest thêm sản phẩm vào giỏ và đọc giỏ qua API, checkout trả đúng trạng thái cấu hình R06 chưa sẵn sàng với nút đặt hàng bị khóa, customer bị từ chối staff/admin API, staff bị từ chối admin API, admin đọc được thống kê/catalog, và truy cập staff ẩn danh bị từ chối. Smoke layout chỉ kiểm tra trang catalog ở viewport 390px.

Checkout E2E cố ý dừng ở lỗi `DATABASE_UNAVAILABLE` từ quote do vùng giao hàng/phí/chính sách checkout chưa được cấu hình. Test không tạo order thành công và không giả lập PayOS thành công. Harness dùng fixture tổng hợp `example.test`, không gửi mail, không gọi provider, và teardown xóa đúng database P11. Sau khi teardown, kiểm tra local MongoDB không còn database tên theo prefix `tro_lam_p11_e2e_test_`.

Ma trận acceptance theo từng luồng ở [acceptance-coverage.md](acceptance-coverage.md). Các unit/route tests chứng minh hành vi được nêu tại đó; chúng không thay thế E2E, replica-set race test hoặc UAT của chủ dự án.

## Còn thiếu trước khi mở bán

- Chạy hai replica-set suite P05/P06 trên MongoDB test replica set riêng và giữ bằng chứng race/transaction; hai suite hiện skip.
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
| R12 | Admin bootstrap và quy trình khôi phục | Runbook được diễn tập, không commit mật khẩu mặc định |

Chỉ mở những provider cần thiết sau khi owner cấp cấu hình qua secret store. Nếu credential chưa có, adapter và fallback vẫn báo unavailable; không đổi sang kết quả giả thành công.


## Post-run cleanup audit

Two P11 databases left by interrupted browser attempts were verified against the exact `tro_lam_p11_e2e_test_<12 lowercase hex>` pattern and removed by name: `tro_lam_p11_e2e_test_6bb21c7dbf6a` and `tro_lam_p11_e2e_test_bddfcfe9fffa`. A read-only local MongoDB audit then found no matching test database. The untracked `test-results/` directory contained only Playwright's generated `.last-run.json`; its resolved path was verified inside this P11 worktree before removal.
