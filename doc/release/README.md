# P11 — trạng thái QA và release

## Phạm vi và kết luận

Đánh giá sơ bộ trên baseline 3939722b2472a8468a55d5f07d8f66d776a78546
(2026-10-06). Đây là kiểm kê acceptance và bằng chứng hiện có, không phải chứng nhận
production-ready. Chưa triển khai production và chưa gọi provider live.

Trạng thái hiện tại: **chưa qua release gate**. Backend server khởi tạo app mà không
truyền domain routers; createApp mặc định nhận danh sách router rỗng. Vì vậy phần lớn
API domain chưa được lộ qua server tích hợp. Frontend có các module route đã lắp, nhưng
chưa có bằng chứng browser-to-API. P07 support/review và P10 assistant chưa có trong
baseline được kiểm tra.

## Bằng chứng chạy được trong P11

Các dependency được mượn từ QA checkout có package-lock SHA-256 giống hệt
(B342AB23F04EE6F0D347A1ABFF3B407F0D95675DB6F10B19E90E8C2B76F88F9E). P11 worktree
không có node_modules; lệnh dùng Node 24.21.0 và resolver tạm để tìm dependency trong
QA checkout. Không cài, chép hay ghi dependency vào source P11.

| Hạng mục | Kết quả | Giới hạn |
| --- | --- | --- |
| Contract validation | PASS — OpenAPI 3.1.0, 102 paths, 121 operations, 60 DTO schemas, 22 frozen enums, 23 DTO fixtures | Chạy scripts/validate-contracts.js trên source P11 |
| ESLint | PASS — exit code 0 | Chạy trên source P11 với cấu hình ESLint hiện có |
| Backend tests | 137 pass, 0 fail, 2 skip trên 139 tests | P05/P06 replica-set tests skip vì chưa đặt P05_TEST_REPLICA_SET_URI và P06_TEST_REPLICA_SET_URI |
| Frontend build | BLOCKED — Rollup không resolve được react/jsx-runtime từ P11 worktree | Worktree không có workspace node_modules links; build cần được chạy lại sau khi coordinator cài dependency theo lockfile |
| npm run check | Chưa chạy nguyên script | Các phần contract, lint và backend test được chạy riêng; frontend build chưa hoàn tất |
| Browser/E2E | Chưa có kết quả | Chưa có Playwright package hay script E2E trong manifests; backend server hiện không mount domain routers |

Contract validation, lint và backend tests đã chạy trên source của baseline P11.
Frontend build chưa có bằng chứng pass. Vì vậy không gộp kết quả thành “check pass”.
Chi tiết mapping test và gap theo từng AC ở acceptance-coverage.md.

## Playwright và điều kiện để bắt đầu E2E

Đã kiểm tra package manifests và node_modules ở các checkout khả dụng: không có
Playwright, playwright-core, Puppeteer hoặc script test:e2e. Có Chromium cache trên máy,
nhưng binary trình duyệt không cung cấp runner hay fixtures.

Chưa thêm harness. Hiện server gọi createApp(env), trong khi backend/src/app.js mặc định
domainRouters là mảng rỗng; chưa có customer/guest flow nào chạy qua API server thật.
Thêm test dùng mock network ở trạng thái này sẽ không kiểm tra được giao diện với API
đã ráp và không thay thế integration trong acceptance plan.

Sau khi coordinator mount router domains và P07/P10 được tích hợp, đề xuất harness nhỏ
trong tests/e2e:

1. Public browse → guest cart → checkout bằng test database riêng; xác minh order chỉ tạo
   một lần sau retry và email được queue. Không đánh dấu PayOS paid giả.
2. Guest order lookup với credential sai/đúng; xác minh PII chỉ xuất hiện sau proof.
3. Customer address → order đủ điều kiện → review/complaint khi P07 được mount.
4. Staff fulfillment và admin block → restricted appeal → decision sau khi route domains
   được composition root kết nối.
5. Chạy viewport 360/390/768/1280, keyboard focus, labels, lỗi form và reduced motion.

Để bật test E2E, coordinator cần chọn và khóa phiên bản Playwright trong package manifest
và lockfile chung, định nghĩa script, test server wiring và chỉ cho phép fake adapter ở
NODE_ENV=test. Bước đó nằm ngoài P11 worktree này vì các file manifest/composition là
file tích hợp chung.

## Thiết lập môi trường an toàn

- Cài Node 24.x; package manager dùng package-lock chung.
- Trong checkout mới, chạy npm ci từ root. Không chép node_modules từ một workspace
  khác; workspaces cần symlink tới chính source đang kiểm tra.
- Tạo backend/.env từ backend/.env.example chỉ khi file chưa tồn tại; nếu đã có thì sửa
  có chủ đích, không ghi đè. MONGODB_URI mẫu chứa placeholder và không chạy được. Dùng
  database bỏ đi dành riêng cho test, phải là MongoDB replica set khi cần transaction.
- Chỉ chạy P05/P06 race tests với P05_TEST_REPLICA_SET_URI và
  P06_TEST_REPLICA_SET_URI trỏ tới database test riêng. Không trỏ test, seed, migrate
  hoặc cleanup tới production.
- Tạo fondend/.env.local từ fondend/.env.example chỉ khi chưa tồn tại. Giữ
  VITE_API_BASE_URL ở local proxy; không đưa provider keys vào biến VITE_* hoặc bundle.
- File .env thật phải ở ngoài Git. Không gửi credential trong issue, log, screenshot,
  commit hay chat. Kiểm tra git status và git check-ignore trước khi ghi giá trị thật.
- Chạy npm run check sau khi dependency đã cài trong checkout tích hợp. Chạy riêng từng
  package test nếu cần chẩn đoán; ghi rõ replica-set tests nào skip.
- Dùng fixture synthetic có nhãn test. Không gửi email khách thật, tạo payment/refund
  thật, hoặc cấu hình production trong đợt QA này.

## Blocker và đầu vào owner

Các điều kiện R01–R12 vẫn là đầu vào trước production theo planning 10. Cần owner cấu
hình qua môi trường bí mật và xác nhận chính sách/nội dung; tài liệu này không hàm ý
rằng thông tin đó đã được cung cấp.

| ID | Cần cấu hình/xác nhận | Bằng chứng còn thiếu |
| --- | --- | --- |
| R01 | Domain frontend/API, tài khoản hosting và quyền deploy | Cookie, CORS, session và deep-link trên staging; quyền deploy |
| R02 | Atlas URI/user/access list riêng cho môi trường thật | Replica-set race run và restore rehearsal; hai race suites hiện skip |
| R03 | SKU, giá, tồn, saleMode, ảnh và quyền sử dụng | Danh mục thật được owner duyệt; ảnh/demo không được trình bày như hàng đang bán |
| R04 | SMTP mailbox, from, shop recipient và OUTBOX_ENCRYPTION_KEY | Gửi/nhận thực trên staging và kiểm tra retry; unit tests không thay thế |
| R05 | PayOS merchant, client/API/checksum keys và webhook URL | Webhook/sandbox/reconciliation thật; chưa có kết quả sandbox |
| R06 | Phí/vùng ship, COD, đổi trả/refund, retention và chính sách công khai | Giá trị allowlisted do owner duyệt và rehearsal nghiệp vụ |
| R07 | Địa chỉ, hotline, email và kênh social của shop | Thông tin contact thật được duyệt trước public |
| R08 | Nguồn story, nghệ nhân/hoa văn và mapping NFC | Nội dung văn hóa xác minh và bản quyền media |
| R09 | Geocoder, key/quota/billing và dữ liệu địa giới | Provider thật; manual fallback hiện là yêu cầu tiếp tục duy trì |
| R10 | Gemini key/model khả dụng, quota/ngân sách | Provider live và fallback; không giả lập câu trả lời provider trong production |
| R11 | Media storage, backup, retention, RPO/RTO | Upload/retrieval ổn định và restore evidence |
| R12 | Admin bootstrap owner và quy trình khôi phục | Runbook thực hành an toàn, xác nhận quyền; không tạo mật khẩu mặc định trong repo |

Không ghi secret hoặc giá trị mẫu trông như secret vào tài liệu. Không tự bật tích hợp
provider và không deploy production.
