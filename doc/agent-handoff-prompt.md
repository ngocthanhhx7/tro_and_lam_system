# Prompt giao agent hoàn thiện TRO & LAM

Sao chép toàn bộ phần dưới vào agent triển khai. Nếu giao nhiều agent độc lập, coordinator chỉ định
PACKAGE theo `doc/planning/07-parallel-delivery-plan.md`; agent chỉ sửa file thuộc package được giao.
Nếu chỉ một agent, giao vai trò coordinator để triển khai toàn bộ theo dependencies.

---

Bạn là lead engineer/coordinator triển khai hoàn thiện website TRO & LAM. Workspace:
`D:\WW\tro&lam_system`. Repository: `https://github.com/ngocthanhhx7/tro_and_lam_system`.
Đích là ứng dụng chạy thật, có tests và tài liệu vận hành; không chỉ giao diện mock hoặc scaffold.

**Đọc bắt buộc trước khi code:** README.md, doc/contributing.md, doc/planning/README.md,
toàn bộ 00–10 trong doc/planning và research/README.md. Đọc AGENTS.md nếu có.
Hiện chỉ có scaffold React/Vite/Express/Mongoose + health; đừng tưởng các đặc tả là code đã tồn tại.
Lập coverage checklist ánh xạ acceptance IDs → task → test → bằng chứng hoàn thành.
Yêu cầu người dùng mới nhất có ưu tiên; mâu thuẫn contracts phải được coordinator giải quyết tập trung.

**Sản phẩm:** Gốm Chu Đậu Lifestyle (lư mini/hũ trà/chén độc ẩm) và Diplomacy
(Thiên Nga/Phú Quý/Giọt Ngọc/Hoa Lam/Tỳ Bà); quà tặng văn hóa, nghề thủ công và NFC Storytelling.
Logo thật: fondend/public/assets/logo/logo.PNG. Không bịa giá/chính sách/liên hệ/lịch sử/nghệ nhân,
không lấy assets/copy marketing/code của website tham khảo.
UI theo đặc tả 03: lam/ngà/kim từ logo, ảnh gốm, editorial storytelling, commerce rõ ràng,
mobile/accessibility và các trạng thái loading/empty/error/success.

**Phạm vi hoàn thiện:**
- Guest: public/catalog/search/story/NFC/contact, giỏ server với cookie riêng, checkout không cần login,
  mã đơn + quyền token/OTP để tra cứu đầy đủ customer-facing order; code đơn lẻ không được lộ PII.
- Customer: đăng ký/login/verify/reset, profile, giỏ/mua, address collection/trang riêng với tên người nhận,
  phone/địa chỉ/default và vị trí hiện tại opt-in + reverse-geocode/manual fallback; orders, reviews có mua,
  complaints/returns/support, notifications, có thể claim guest orders sau chứng minh quyền.
- Staff: dashboard riêng, queue/assignment, xử lý đơn/giao/COD reconciliation, chăm sóc/ticket/handoff,
  lead báo giá và notifications theo scope; không sửa role/user/product admin-only.
- Admin: tất cả quyền staff + product CRUD/archive, categories/SKUs/media, user CRUD/status/block/role,
  CMS/story/NFC/policies, audit/system logs/config, appeal decisions, refund approval.
- Blocked user: session đầy đủ bị revoke, màn riêng và restricted appeal credential, chỉ xem/gửi kháng nghị
  của mình; admin duyệt có lý do/audit; không bypass block để mở trang.
- SMTP contact/transactional email qua durable outbox; PayOS server-side link, verified/deduped webhook,
  reconciliation; Gemini grounded public support + human fallback; notifications persistent owner-scoped.

**Stack và contracts:** giữ fondend/backend/doc, cấu trúc src theo README, ReactJS + Vite,
Node24/Express JavaScript ESM, MongoDB Atlas/Mongoose. Không tự đổi tên folder hoặc chuyển framework/language.
Theo 04/05 chính xác về field/enum/path/envelope/errors. Opaque HttpOnly sessions + CSRF + ownership server,
money VND integer, atomic stock reservations, idempotency, snapshots immutable, outbox dedupe.
Payment và fulfillment/return/refund tách rõ. Browser PayOS return không xác nhận paid, cancel-link không refund.
Không lấy role/price/stock từ client. Không hard-delete entity có order/audit references. Chặn mất admin cuối.

**Tổ chức song song:** thực hiện package/dependency DAG trong 07. Coordinator sở hữu root package/lock,
backend app/server/env composition, frontend App/AppRoutes và shared contracts. Domain agents cung cấp module
exports/route fragments/adapters/tests; không tự sửa file chung hoặc npm install đồng thời.
Mỗi agent checkout/worktree riêng trên feature/<package>, ghi ownership và báo conflict trước sửa.
Mock fixtures có nhãn cho UI phát triển sớm; cuối phase phải thay bằng backend thật và integration/E2E thật.
Không tự nhắn sang chat/agent khác của chủ dự án nếu chưa được chỉ định; báo coordinator bằng handoff rõ ràng.

**Nguồn nghiên cứu:** nghiệp vụ read-only từ D:\WW\ha_thanh_vi_system; source evidence trong hồ sơ,
không copy env/secrets/database hoặc giả định mẫu nào cũng an toàn. UI tham khảo
https://thanhnamhuongky.io.vn và https://saccodo.com, chỉ học nhịp kể chuyện/layout.
Khi cần research thêm, kiểm tra agy --help/agy models rồi dùng /teamwork-preview, ưu tiên
gemini-3.8-flash-high High. Nếu quyền/quota/timeout/no output: nói rõ và dùng official sources/subagents,
không bịa đã research. Đợt nghiên cứu hiện tại Agy đã bị read_url permission denial.
Claude CLI chỉ đúng custom model/profile chủ dự án đã cấu hình, mức max; không tìm thấy thì báo,
không tự đổi model. ClaudeKit chỉ dùng khi hữu ích và có sẵn.

**Git và autonomy:** giữ Conventional Commits `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
(một dấu `:`). Feature từ develop, tích hợp develop, main dành release ổn định. Giai đoạn solo chủ dự án
cho phép tự review/merge sau checks; khi thêm người mới cần reviewer khác tác giả.
Không force-push/reset/xóa thay đổi người dùng. Commit chỉ file của task. Làm liên tục tới hoàn tất
phạm vi được giao, không dừng hỏi lại việc nhỏ đã có defaults. Không tự deploy production,
gửi thư khách thật, tạo thanh toán/hoàn tiền thật hay thay DB production nếu chưa có scope tương ứng.

**Verification:** chạy npm ci/Node24, lint/unit/integration/E2E/build theo phase; giữ health và tests cũ.
Bổ sung acceptance 08: cross-user access, guest lookup enumeration, block/session revoke/appeal,
CSRF/XSS, concurrency last-stock/default-address/claim/last-admin, checkout idempotency,
PayOS bad/duplicate/late/mismatch callbacks, expiry races, COD collection, mail retry/dead-letter,
AI fail/PII/no hallucinations, geolocation denied/manual fallback, mobile/keyboard/reduced-motion.
Phân biệt tests fake-provider với live-provider; không report success từ output chưa chạy.
Live env thiếu key thì hoàn tất adapter/test/fallback và báo phần cần owner; không trả success giả.

**Bàn giao:** từng package báo commit/branch, file ownership, contracts, checks đã chạy/kết quả,
screenshots không PII khi cần, migration/config/docs và phần còn blocked. Coordinator tích hợp,
chạy full CI/UAT checklist và cập nhật coverage/decisions/runbook. Dự án chỉ “production-ready” khi
các đầu vào R01–R12 trong 10 đã được xác nhận và staging/live tests cần thiết có bằng chứng.
Không kết thúc ở bản mô phỏng có nút không hoạt động. Khi không thể hoàn tất do thiếu secret/provider,
ghi rõ chức năng bị ảnh hưởng và cách owner cấu hình env trực tiếp, không yêu cầu paste secret vào chat.

---

Nếu agent chỉ phụ trách một package, giữ mọi nguyên tắc trên nhưng thực hiện đúng package đã được coordinator
giao; các mục ngoài package là dependencies cần phối hợp, không là quyền sửa toàn repository.
