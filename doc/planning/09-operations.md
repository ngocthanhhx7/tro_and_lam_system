# Kiến trúc vận hành, bảo mật và release

## Module boundaries
Express route → validator → auth/capability/ownership middleware → controller → service → Mongoose model.
Controller chuyển HTTP/DTO, service giữ rules và transaction. Provider integrations là adapter injectable,
không import SDK vào mọi controller. Frontend route/layout → page → hooks/services → DTO, không tự tính
giá authoritative. API contract ở 05 và schema/indexes ở 04 là nguồn chung; root owner quản lý composition.

## Authentication/session
Opaque random 256-bit session token, hash lưu collection; HttpOnly/Secure cookie production,
expiry server-side, rotate khi login/privilege change và invalidate khi logout/password/role/status change.
CSRF token cho mutation + kiểm tra Origin; GET không side effects. Password Argon2id với cost kiểm tra
trên runtime, không encrypt/reversible. Email/reset/OTP challenge token có purpose, one-use, expiry,
attempt counter và hashed secret; không log hoặc trả OTP trong API production.
RBAC server và ownership query cùng điều kiện; không lấy `userId`, role hoặc price authoritative từ body.
Admin cuối không bị tự khóa/demote/delete, kiểm tra trong transaction tránh race.

Blocked user xác minh credential đúng để nhận **restricted appeal session**; session này không có quyền
đọc/sửa tài khoản/đơn hay checkout. Chỉ appeal create/list-own/detail và logout; không xóa block để làm
UI hoạt động. Public xem catalog vẫn được; business decision ở 10 xác định chặn commerce với identifier
đã xác minh mà không thể hứa phát hiện mọi guest là cùng người bị khóa.

## Cookie + Vercel/Render
Không triển khai cookie như thể `project.vercel.app` và `api.onrender.com` là cùng site.
Baseline production ưu tiên custom frontend/API domains cùng registrable domain hoặc reverse proxy API
cùng origin. Dùng HTTPS, cookie Secure/HttpOnly/SameSite=Lax theo topology, fetch `credentials: include`,
CORS exact origin + credentials=true; không wildcard. Nếu bắt buộc hai site khác nhau, cần SameSite=None;
Secure, CSRF và thử browser third-party-cookie restrictions; phương án này có rủi ro mất session nên
không coi chỉ đổi SameSite là hoàn tất. API proxy `/api/*` đứng trước SPA rewrite.
Cookie domain/path phải hẹp hợp lý; có tên riêng full/guest/restricted credentials để không dùng lẫn.

## Inventory/DB consistency
Mongo Atlas replica set transactions cho checkout, reserve, paid, cancel, stock movement và outbox.
Schema constraints và indexes phải deploy idempotent; production autoIndex=false, migration explicit.
Update dùng `version`/conditional state, conflict 409. Price/address/item snapshots bất biến sau checkout.
Reservation expiry bằng worker, không TTL xóa dữ liệu nghiệp vụ. Archive sản phẩm có đơn thay hard-delete.
Webhook/reconciliation/cancel dùng chung transition service, không cho ba luồng tự viết paid độc lập.

## Workers và durability
Baseline Mongo outbox + lease worker, unique dedupe keys, claim atomically và lease expiry khi crash.
Chạy process worker tách web, có health/last-run/dead-letter dashboard. Job scheduler cần thật trên
Render worker/cron service, không giả định serverless timer luôn chạy. Không giữ task quan trọng chỉ
trong memory; external provider calls không giữ transaction DB lâu.
Khi scale nhiều instance, rate-limit/session/event delivery dùng shared store (Mongo/Redis nếu chọn),
không tin limiter memory đủ chống spam toàn cụm. Redis là tùy chọn, chưa dependency scaffold.

## Audit và logs
Audit append-only qua backend, actorId/role/action/entityId/time/requestId/reason/change-summary đã redacted.
Admin được xem/export có quyền, không UI xóa log. Không gọi DB collection “immutable” nếu DB user có thể sửa;
production dùng phân quyền/retention và backup phù hợp. Logs cấu trúc với levels, request latency/status,
correlationId và provider error category; không log headers cookie/authorization, query token,
password/OTP/keys, full address/email/body webhook/chat. Customer-visible order timeline tách staff notes.

## Cấu hình và tích hợp hiện có

Các biến được kiểm tra ở `backend/src/validators/env.validator.js`; tên mẫu nằm trong
`backend/.env.example`. Production phải dùng secret store, không lưu giá trị thật trong Git.

| Nhóm | Cấu hình đã triển khai |
| --- | --- |
| Core | `NODE_ENV`, `PORT`, `MONGODB_URI`, `CORS_ORIGIN`, `PUBLIC_WEB_URL`, `TRUST_PROXY` |
| Session/CSRF | `CSRF_SECRET`, `SESSION_COOKIE_NAME`, `RESTRICTED_COOKIE_NAME`, `GUEST_ORDER_COOKIE_NAME`, `CSRF_COOKIE_NAME`, `COOKIE_PATH`, `COOKIE_SAME_SITE`, `SECURE_COOKIES` |
| Outbox/mail | `OUTBOX_ENCRYPTION_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_TIMEOUT_MS`, `SUPPORT_INBOX_EMAIL` |
| Payment | `PAYOS_ENABLED`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `PAYOS_TIMEOUT_MS`; webhook URL dùng cấu hình route/deployment, không phải secret từ trình duyệt |
| Assistant | `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_TIMEOUT_MS`, `AI_DAILY_BUDGET` |
| Background jobs | `RESERVATION_SWEEP_INTERVAL_MS`, `PAYMENT_RECONCILIATION_INTERVAL_MS`, `BACKGROUND_WORKERS_ENABLED`; tiến trình riêng chạy `node src/worker.js` |

Geocoder và media storage chưa có provider được cấu hình. Geolocation vẫn phải cho phép
nhập địa chỉ thủ công; catalog media upload trả `MEDIA_UNAVAILABLE` đến khi chủ dự án
cấu hình storage. Checkout có adapter đọc `shippingZones` từ business settings và chỉ báo
giá cho tỉnh/thành khớp cấu hình; khi thiếu vùng/phí đã được owner xác nhận hoặc địa chỉ
không khớp thì quote vẫn fail-closed. COD, phí, đổi trả/refund và các giới hạn mở bán tiếp
tục chờ đầu vào R06, không suy diễn giá trị mặc định. Không lưu provider credential trong
`VITE_*` hay business settings.

Feature chưa có credential phải disabled/unavailable rõ ràng; không dùng key giả hoặc response paid giả.
Validate schema/env khi bật tính năng, tránh backend chết vì một tính năng tùy chọn disabled.
Không gửi keys vào `VITE_*`. `.env.example` chỉ tên biến/mẫu vô hại, `.env` không Git.

## Backup, retention và phục hồi
Backup Atlas theo plan/provider khả dụng, owner xác nhận lịch/RPO/RTO trước mở bán; test restore vào DB tách
trước release. Export/import phải không overwrite production ngầm; kiểm tra integrity orders/payments/stock.
Retention đề xuất cấu hình theo loại challenge/session/outbox/ticket/audit; owner duyệt chính sách trước
cleanup dữ liệu thật. TTL phù hợp challenge/session, không đơn hàng/log tài chính hay reservations cần release.
Media storage lifecycle/backup và mapping trong DB cần cùng kế hoạch; rollback app không tự rollback payments.

## Release checklist
1. Workflow [quality](../../.github/workflows/quality.yml) chạy contract/unit/replica-set/E2E/build trên
   pull request; xác minh run xanh trên GitHub trước release. Contracts frozen, source diff không chứa secrets.
2. Staging rehearsal: catalog thật hoặc fixture gắn nhãn, roles, guest/customer purchase, block appeal,
   SMTP/PayOS/geolocation/Gemini lỗi bình thường và provider live khi credentials cho phép.
3. Domain/cookie/CORS, Atlas access list, webhook verification, worker scheduler và upload storage đã xác minh.
4. Owner-only initial admin provisioning uses [the one-time bootstrap runbook](../runbooks/first-admin-bootstrap.md); the script requires explicit database and mailbox confirmation, refuses any existing admin, and never includes a default password.
5. Chủ dự án xác nhận giá/tồn kho/chính sách/liên hệ/nội dung và không còn fixture hiển thị như thật.
6. Tag release Conventional Commits/version; production từ main, config deploy riêng.
7. Health liveness + readiness và smoke checkout sau deploy; monitor errors, mail queue, pending payments,
   inventory exceptions, worker lease/lag. Rollback về artifact ổn định, giữ data migrations backward-compatible.

Chủ dự án hiện làm một mình và cho phép tự review/merge; vẫn giữ feature branches, CI và commits chuẩn.
Khi thêm thành viên, áp dụng reviewer khác tác giả theo doc/contributing.md. Tài liệu này không thực hiện
deployment hay thay cấu hình provider/branch-protection trong đợt lập kế hoạch.
