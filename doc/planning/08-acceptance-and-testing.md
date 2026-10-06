# Kiểm thử, nghiệm thu và Definition of Done

## Các mức bằng chứng
Unit test kiểm tra rules thuần; integration thật chạy Express/Mongoose với test replica set,
provider adapters giả có nhãn; contract test xác minh DTO/roles/errors; E2E đi từ browser qua
API thật tới test DB. Mock-only E2E dùng để phát triển giao diện không thay thế integration.
Provider staging/merchant test là kiểm tra riêng có secret do owner cấu hình, không suy diễn từ mock.

## Ma trận bắt buộc
| ID | Luồng | Điều kiện pass |
| --- | --- | --- |
| A-PUB-01 | Catalog/search/filter | Chỉ published và active; URL query restore; phân trang ổn định; draft direct-ID không rò rỉ |
| A-GST-01 | Guest cart | Không đăng nhập vẫn thêm/sửa/xóa, không dùng giá từ client; reload/session policy đúng |
| A-GST-02 | Guest checkout | Có mã đơn, chỉ một order khi retry; snapshot người nhận; email confirmation queued |
| A-GST-03 | Guest tracking | Mã đơn đơn lẻ không đọc PII; đúng token/OTP mới thấy đầy đủ; sai credential cùng response shape |
| A-AUTH-01 | Register/login/reset | Token purpose/expiry/one-time; no enumeration; logout và role/block revoke session |
| A-ADR-01 | Address CRUD | Collection riêng, tối đa một default, ownership; sửa/xóa address không thay snapshot đơn |
| A-ADR-02 | Geolocation | Cả success/denied/timeout/provider failure; manual address vẫn save/checkout được |
| A-SHP-01 | Shipping quote | Chỉ tỉnh/thành khớp chính xác sau chuẩn hóa mới nhận fee đã cấu hình; thiếu tỉnh, vùng trống, dữ liệu chồng lấn hoặc không khớp phải fail-closed; phí được snapshot vào tổng đơn |
| A-ORD-01 | Pricing/inventory | VND integer server-side; hai checkout tranh SKU cuối chỉ một thành công |
| A-ORD-02 | Idempotency | Same key/body trả cùng order; same key/different body 409; khác khách không dùng chung kết quả |
| A-PAY-01 | PayOS | Invalid signature không paid; webhook hợp lệ đúng amount/currency/order cập nhật một lần |
| A-PAY-02 | Retry/race | Duplicate, out-of-order, timeout then retry, expiry-vs-paid race, late payment after cancel đều có tests |
| A-PAY-03 | Browser return | Fake returnUrl paid không thay DB; UI đối soát bằng API; provider unavailable không mất order |
| A-COD-01 | COD | Delivered không tự paid; đối soát COD có quyền/evidence/audit và idempotent |
| A-REV-01 | Review | Chỉ delivered order item thuộc owner; giới hạn duplicate; edit/moderation không xóa lịch sử không dấu vết |
| A-TKT-01 | Ticket/complaint | Ownership mọi read/write; assignment atomic; state transitions hợp lệ; attachment không public |
| A-BLK-01 | Blocked appeal | Full session bị revoke; restricted session chỉ gửi/xem appeal; approve/reject admin có reason/audit |
| A-STF-01 | Staff | Dashboard/queue/fulfillment/support được phép; product/user/role/audit admin APIs trả 403 |
| A-ADM-01 | Admin | Bao gồm staff; không khóa/demote admin cuối; role/status change invalidates session ngay |
| A-PRD-01 | Product CRUD | Slug/SKU unique, optimistic concurrency; soft delete referenced product, old order vẫn đọc snapshot; drafts may be created without images, but public publication requires at least three images with confirmed usage rights |
| A-NOT-01 | Notification | Read/mark all chỉ owner, unread đúng, duplicated event không tạo trùng |
| A-MAIL-01 | SMTP/outbox | Retry lease/dead-letter, header injection blocked; mail failure không mất đơn/ticket |
| A-AI-01 | Gemini | Grounded public context; PII redaction, invalid product ID filtered; quota/timeout → human fallback |
| A-NFC-01 | Story NFC | Published public, draft private; revoked/missing fallback; không claim authenticity từ URL |
| A-LOG-01 | Audit | Actor/action/entity/time/requestId/reason ghi trước/sau sanitized; không OTP/token/password/PII body |
| A-UI-01 | UI/a11y | Mobile 360/390/768, desktop 1280/1440; keyboard focus, semantic labels, image alt, form errors, reduced-motion |
| A-REL-01 | Release | Clean npm ci Node24, lint/unit/integration/E2E/build pass, health ready, runbook/rollback/backup restore test |

## Security tests cụ thể
Thử user A đọc/sửa address/order/ticket/notification của B; staff sửa role admin; guest dùng sequential
order codes; blocked account dùng session cũ; CSRF cross-site request; reflected/stored XSS trong
review/CMS/contact; NoSQL injection qua sort/filter/$operator; upload polyglot/path traversal;
open redirect checkout URL; SSRF media import/reverse provider URL; spam login/OTP/appeal/contact;
last-admin race; webhook signature timing/type errors; sensitive log scan. Mọi lỗi cần xử lý trước merge.

## Kiểm thử trạng thái
Mỗi transition trong 02 có test allowed/forbidden/duplicate/stale-version. Hai request đồng thời
tranh assignee hoặc default address cần test DB thật. Tests inventory/outbox phải chứng minh atomic rollback
khi một bước fail, không chỉ mock “called once”. TTL index không dùng làm bằng chứng cleanup đúng giờ.
Money totals unit test: qty bounds, zero/negative rejected, expired quote, published disabled,
price changes after cart, archived SKU, tính lại phí giao hàng và giữ nguyên tổng đơn sau checkout.

## Fixture và môi trường
Seed chỉ dev/test, gắn nhãn dữ liệu mẫu; accounts synthetic, passwords local không hardcode production.
Test DB tách cluster/db và khóa scripts destructive theo NODE_ENV; không chạy drop/seed trên production.
CI health scaffolding hiện có tiếp tục giữ 13 test. Agent thêm scripts `test:integration`, `test:e2e`
sau tích hợp nền; tài liệu không tuyên bố các scripts này hiện đã tồn tại.
Provider tests fake adapter phải ghi `mode=test`; production thiếu credentials hiển thị unavailable,
không fallback sang response giả thành công. Screenshots/chứng cứ QA không chứa thông tin khách thật.

## Definition of Done của mỗi task
Đúng contracts/permissions, UI các trạng thái, regression tests phù hợp, lint/build/check liên quan pass,
không secret, migration/index plan, docs cập nhật, commit Conventional Commits, báo file đổi + checks +
giới hạn thật. Khi chưa có key/provider, agent hoàn tất adapter/test/fallback và ghi phần test live đang chờ;
không coi dự án “production complete” khi còn điều kiện mở bán ở 10.

## UAT chủ dự án
Tạo catalog thật → mua guest/customer → PayOS xác minh hoặc COD → staff xử lý/giao/đối soát →
customer review/complaint → admin product/user/block/appeal → thông báo/email → NFC story.
Đối chiếu visual với 03, không so pixel với website khác. Chủ dự án duyệt chính sách/giá/nội dung;
giai đoạn solo agent được merge theo ủy quyền, nhưng không thay owner cung cấp dữ liệu kinh doanh thật.
