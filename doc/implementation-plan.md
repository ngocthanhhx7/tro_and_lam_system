# Scaffold Implementation Plan

**Goal:** Khung React/Express/Atlas chạy được và đẩy lên Git theo Gitflow.
**Architecture:** npm workspaces, frontend theo ảnh tham khảo, backend phân lớp.
**Tech Stack:** React, Vite, Express, Mongoose, ESLint, Node test runner, Supertest.

- [x] Tạo workspace và cấu hình Node 24 LTS, env example, ignore, lint.
- [x] Tạo frontend: entry tại src/main.jsx, app/App.jsx, routes/AppRoutes.jsx, layout và trang giới thiệu scaffold; HTTP client và hook kiểm tra API.
- [x] Tạo backend: app.js độc lập server.js để test không cần Atlas; env validator, kết nối mongoose, health route/controller/service, lỗi 404/500.
- [x] Kiểm tra API bằng Supertest: liveness, readiness mất DB, 404, CORS; kiểm tra env thiếu URI và port không hợp lệ.
- [x] Ghi tài liệu nghiệp vụ, cấu trúc, cài đặt Atlas, deploy và Gitflow; thêm CI và PR template.
- [x] Chạy npm install, npm run lint, npm test, npm run build; kiểm tra không có secrets được track.
- [ ] Commit Conventional Commits, push main/develop/feature; tạo PR vào develop khi quyền GitHub cho phép.
