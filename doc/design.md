# TRO & LAM — Thiết kế khung dự án

Ngày: 06/10/2026. Kiến trúc đã được người dùng duyệt trong chat.

## Phạm vi
Khởi tạo repository có thể chạy bằng npm workspaces: `fondend`, `backend`, `doc`.
Giữ tên `fondend` theo yêu cầu; cấu trúc src tham khảo hai ảnh do người dùng cung cấp.
React + Vite phục vụ giao diện; Express cung cấp REST API; Mongoose kết nối MongoDB Atlas.
Chưa triển khai website bán hàng hoàn chỉnh, quản trị, thanh toán hay hệ thống NFC.

## Kiến trúc
- Frontend: app, assets, components, constants, contexts, hooks, layouts, pages, routes, services, styles, utils.
- Backend: config, constants, controllers, jobs, middlewares, models, routes, services, utils, validators.
- Luồng API: route → controller → service → model. Middleware xử lý lỗi và cấu hình bảo mật chung.
- Khởi động backend chỉ thành công khi kết nối DB thành công. Liveness và readiness tách riêng.
- Các folder chưa có nghiệp vụ dùng README mô tả trách nhiệm, không tạo logic giả.
- Env được kiểm tra trước khởi động; không lưu credential vào Git.

## Kiểm tra và Git
Build React, lint toàn repo, integration test API health/404/CORS và unit test env.
Main/develop khởi tạo bằng commit tài liệu; scaffold nằm trên feature/project-scaffold.
PR vào develop cần một thành viên khác tác giả duyệt; Project Leader merge.
Không tự merge scaffold vào main/develop hoặc triển khai production.
