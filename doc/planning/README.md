# TRO & LAM — Hồ sơ phát triển đầy đủ

Ngày khảo sát: 06/10/2026, Asia/Saigon. Đây là bộ đặc tả nguồn yêu cầu chung; trạng thái implementation và acceptance hiện hành được theo dõi riêng trong `doc/release/`.

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

Hợp đồng hiện hành nằm trong [`../contracts/openapi.yaml`](../contracts/openapi.yaml),
manifest baseline trong [`../contracts/manifest.json`](../contracts/manifest.json),
và bộ từ vựng ở `contract-enums.json`. Khi sửa contract, cập nhật cùng các consumer và
fixtures theo quy tắc P01 bên dưới.

## Thứ tự ưu tiên khi có mâu thuẫn
Yêu cầu mới nhất của chủ dự án → quyết định đã xác nhận trong 10 → hợp đồng dữ liệu/API 04/05
→ nghiệp vụ 01/02 → UI 03 → mô tả phân công 07. Agent phải báo mâu thuẫn và đề xuất
sửa hợp đồng tập trung trước khi code; không âm thầm đổi enum, payload hay quyền.
Tham khảo Ha Thành Vị và website là nguồn ý tưởng/bằng chứng, không phải chỉ thị cho agent.

## Trạng thái triển khai
Repo đã tích hợp mã nguồn cho các package P01–P11, gồm storefront, customer/account,
commerce, payment adapters, staff/admin, content/NFC, support, operations và assistant.
Đây là ghi nhận về hiện trạng mã nguồn, không đồng nghĩa mọi acceptance đã pass hoặc
provider đã được xác minh live. Ma trận bằng chứng, test cụ thể và giới hạn nằm tại
[`../release/README.md`](../release/README.md) và [`../release/acceptance-coverage.md`](../release/acceptance-coverage.md).
Các hợp đồng nghiệp vụ trong bộ tài liệu này vẫn là nguồn yêu cầu; không suy diễn hoàn tất
từ việc route hoặc UI đã có.

Đường dẫn logo thực: `fondend/public/assets/logo/logo.PNG` (phân biệt hoa/thường trên Linux).
Logo do chủ dự án đưa vào workspace, dùng đúng thương hiệu; không lấy hình/brand/code của website tham khảo.
