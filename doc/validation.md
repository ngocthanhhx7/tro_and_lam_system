# Kiểm tra scaffold — 06/10/2026

- Runtime kiểm tra: Node 24.21.0; máy hiện có Node 25 mặc định nên dùng runtime 24
  tạm qua npm exec, không thay cấu hình Node toàn máy.
- `npm install`: 291 packages audited, 0 vulnerabilities tại thời điểm kiểm tra.
- `npm run check`: ESLint pass, 13 backend tests pass, React production build pass.
- Vite dev server khởi động thành công trong đường dẫn Windows có ký tự `&`.
- HTTP smoke: trang chủ và SPA fallback trả 200.
- Env thật, node_modules và dist được ignore; không lưu credential vào Git.

Tests kiểm tra env, health, trạng thái DB qua dependency injection, CORS, JSON 404,
JSON sai định dạng và payload quá lớn. Subagent review phát hiện lỗi 413 bị đổi thành 500;
đã sửa và bổ sung test hồi quy.
Chưa có credential Atlas nên chưa xác minh kết nối cluster thực. Chưa deploy Vercel/Render.
CI đã được thêm; kết quả local không thay thế kết quả GitHub Actions hoặc approval của đội dự án.
