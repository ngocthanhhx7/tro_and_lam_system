# TRO & LAM

Khung website thương hiệu gốm Chu Đậu: ReactJS, NodeJS/Express và MongoDB Atlas.
Phạm vi hiện tại: scaffold có thể chạy, trang giới thiệu cơ bản, API health, env validation,
CI và tài liệu. Chưa triển khai catalog, lead form, quản trị, NFC hay thanh toán.

## Cấu trúc
```text
fondend/               React + Vite (tên thư mục theo yêu cầu)
  public/
  src/
    app/               App và cấu hình ứng dụng
    assets/            Ảnh, font, icon
    components/        UI dùng chung
    constants/         Hằng số
    contexts/          Context/provider
    hooks/             Custom hooks
    layouts/           Bố cục trang
    pages/             Các trang
    routes/            Router
    services/          HTTP client
    styles/            CSS
    utils/             Hàm thuần
backend/
  src/
    config/            Env, kết nối MongoDB
    constants/         Hằng số API
    controllers/       HTTP request/response
    jobs/              Background jobs
    middlewares/       Lỗi, middleware dùng chung
    models/            Mongoose models
    routes/            Endpoint definitions
    services/          Nghiệp vụ
    utils/             Hàm hỗ trợ
    validators/        Kiểm tra dữ liệu
    app.js             Express app
    server.js          DB, HTTP, shutdown
  tests/               Unit/integration tests
doc/                   Nghiệp vụ, kiến trúc, setup, Gitflow
.github/               CI và PR template
```

## Chạy local
Node **24 LTS**, npm 11. Tại thư mục gốc:
```powershell
npm ci
Copy-Item backend/.env.example backend/.env
Copy-Item fondend/.env.example fondend/.env
```
Điền `MONGODB_URI` thật trong `backend/.env` theo [hướng dẫn setup](doc/setup.md).
```powershell
npm run dev
```
Web: http://localhost:5173. API: http://localhost:5000/api/v1/health.
Backend chỉ mở cổng sau khi kết nối DB thành công; env example không phải credential hoạt động.
Có thể chạy riêng frontend bằng `npm run dev:web` khi chưa có Atlas.

```powershell
npm run check
```
Lệnh này chạy ESLint, backend tests và production build React. Tests dùng dependency injection
cho trạng thái DB, không kết nối Atlas. Atlas thực phải được kiểm tra riêng.

## Tài liệu
- [Thiết kế](doc/design.md)
- [Nghiệp vụ và phạm vi](doc/business-requirements.md)
- [Setup Atlas và deployment](doc/setup.md)
- [Gitflow và review](doc/contributing.md)
- [API](doc/api.md)

Mã nguồn nghiệp vụ được phát triển trên `feature/*`, PR vào `develop`.
Giai đoạn một người: chủ dự án tự review hoặc ủy quyền merge sau CI.
Khi thêm thành viên: người khác tác giả duyệt; Project Leader thực hiện merge.
