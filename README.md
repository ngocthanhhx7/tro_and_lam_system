# TRO & LAM

Website giới thiệu và thương mại gốm Chu Đậu với storefront công khai, tài khoản,
giỏ/checkout có kiểm tra cấu hình, workspace staff/admin và các adapter dịch vụ.
Các hợp đồng và phạm vi đầy đủ nằm trong `doc/planning/`; bằng chứng kiểm thử cùng
những điều kiện còn mở nằm trong `doc/release/`.

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
Điền `MONGODB_URI` trong `backend/.env` theo [hướng dẫn setup](doc/setup.md).
Không dùng production URI cho local hoặc test.
```powershell
npm run dev
```
Web: http://localhost:5173. API: http://localhost:5000/api/v1/health.
Backend chỉ mở cổng sau khi kết nối DB thành công; env example không phải credential hoạt động.
`npm run dev` chờ API báo sẵn sàng rồi mới mở Vite, tránh lỗi proxy `ECONNREFUSED` trong lúc backend khởi động. Proxy dùng `PORT` từ môi trường hoặc `backend/.env`; có thể ghi đè bằng `API_PROXY_TARGET`. Nếu API chưa sẵn sàng sau 30 giây, lệnh báo kiểm tra log backend và cấu hình kết nối.
Có thể chạy riêng frontend bằng `npm run dev:web` khi chưa có Atlas.

```powershell
npm run check
```
Lệnh này xác thực contract, chạy ESLint, kiểm thử khởi động local/backend tests và build frontend. Unit/route tests dùng
dependency injection. Các test replica-set cần URI loopback riêng; browser E2E yêu cầu
`P11_E2E_MONGODB_URI` có tên database theo mẫu kiểm thử. Xem
[bằng chứng release](doc/release/README.md) trước khi diễn giải kết quả.

## Các phần đã có trong mã nguồn

- Storefront tiếng Việt với danh mục, tìm kiếm, hai dòng Lifestyle/Diplomacy, gallery,
  câu chuyện, liên hệ và trạng thái tải/lỗi/rỗng.
- Tài khoản customer, xác minh email và khôi phục, hồ sơ/địa chỉ, giỏ guest/customer,
  đơn hàng, hỗ trợ và đánh giá có kiểm tra quyền.
- Workspace riêng cho staff/admin, catalog/CMS, xử lý vận hành, audit, notifications
  và bootstrap admin có runbook.
- Adapter cùng test/fallback cho SMTP outbox, PayOS, Gemini và geocoder. Provider live
  không được xem là đã xác minh khi thiếu credential/staging.

Ảnh trong `fondend/public/assets/products/concepts/` là concept AI, không xác nhận sản phẩm
hoặc tồn kho. Dữ liệu sản phẩm, giá, sale mode, media có quyền và chính sách cần chủ dự án
xác nhận theo R03/R06 trước khi mở bán. Domain, Atlas, mailbox, PayOS, contact, nội dung văn
hóa, geocoder, Gemini, media storage và bootstrap được liệt kê tại
[readiness](doc/planning/10-decisions-and-readiness.md).

## Tài liệu
- [Hồ sơ phát triển đầy đủ và kế hoạch chia agent](doc/planning/README.md)
- [Prompt giao agent hoàn thiện dự án](doc/agent-handoff-prompt.md)
- [Thiết kế](doc/design.md)
- [Nhận diện thương hiệu và hướng dẫn nội dung](doc/brand/README.md)
- [Nghiệp vụ và phạm vi](doc/business-requirements.md)
- [Catalog demo chỉ dùng local](doc/development/demo-catalog.md)
- [Setup Atlas và deployment](doc/setup.md)
- [Gitflow và review](doc/contributing.md)
- [API](doc/api.md)

Mã nguồn nghiệp vụ được phát triển trên `feature/*`, PR vào `develop`.
Giai đoạn một người: chủ dự án tự review hoặc ủy quyền merge sau CI.
Khi thêm thành viên: người khác tác giả duyệt; Project Leader thực hiện merge.

Logo do chủ dự án cung cấp nằm ở `fondend/public/assets/logo/logo.PNG`.
