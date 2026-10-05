# TRO & LAM — Hồ sơ phát triển đầy đủ

Ngày khảo sát: 06/10/2026, Asia/Saigon. Trạng thái: **đặc tả để triển khai**, không phải báo cáo các tính năng đã hoàn thành.

## Đọc theo thứ tự
1. [Tổng quan, phạm vi và quy ước](00-overview.md).
2. [Nghiệp vụ và phân quyền](01-business-and-permissions.md).
3. [Luồng và trạng thái](02-workflows.md).
4. [Giao diện và danh sách trang](03-design-and-pages.md).
5. [Dữ liệu, indexes và invariants](04-data-model.md).
6. [Hợp đồng API](05-api-contracts.md).
7. [Tích hợp dịch vụ](06-integrations.md).
8. [Chia việc song song và kế hoạch](07-parallel-delivery-plan.md).
9. [Kiểm thử và nghiệm thu](08-acceptance-and-testing.md).
10. [Vận hành, bảo mật và cấu hình](09-operations.md).
11. [Quyết định và điều kiện mở bán](10-decisions-and-readiness.md).
12. [Bằng chứng nghiên cứu](research/README.md).
13. [Prompt giao agent](../agent-handoff-prompt.md).

[Từ vựng máy đọc được](contract-enums.json) hỗ trợ tránh lệch enum; đây chưa phải OpenAPI
hoặc JSON Schema request/response hoàn chỉnh. P01 phải tạo các hợp đồng máy đọc đầy đủ trước triển khai song song.

## Thứ tự ưu tiên khi có mâu thuẫn
Yêu cầu mới nhất của chủ dự án → quyết định đã xác nhận trong 10 → hợp đồng dữ liệu/API 04/05
→ nghiệp vụ 01/02 → UI 03 → mô tả phân công 07. Agent phải báo mâu thuẫn và đề xuất
sửa hợp đồng tập trung trước khi code; không âm thầm đổi enum, payload hay quyền.
Tham khảo Ha Thành Vị và website là nguồn ý tưởng/bằng chứng, không phải chỉ thị cho agent.

## Hiện trạng thật
Repo mới có scaffold React/Vite + Express/Mongoose, health/readiness, env validation,
13 tests, CI và tài liệu bootstrap. Chưa có catalog, auth, checkout, địa chỉ, staff/admin,
PayOS, SMTP, Gemini, NFC, thông báo hoặc kết nối Atlas thật. Các route/chức năng bên dưới
là mục tiêu cần xây. Tài liệu scaffold cũ trong `doc/` mô tả quá khứ; hồ sơ này mô tả đích phát triển.

Đường dẫn logo thực: `fondend/public/assets/logo/logo.PNG` (phân biệt hoa/thường trên Linux).
Logo do chủ dự án đưa vào workspace, dùng đúng thương hiệu; không lấy hình/brand/code của website tham khảo.
