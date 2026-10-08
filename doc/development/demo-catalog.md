# Dữ liệu xem trước catalog trên máy local

Script tạo 8 sản phẩm demo trong database riêng `tro_lam_dev_catalog_demo`: 3 mẫu Lifestyle và 5 mẫu Diplomacy. Mỗi sản phẩm có đúng ba tệp gallery khác nhau và một mức giá tham khảo để xem giao diện bán trực tiếp. Giá chưa phải bảng giá được chủ dự án duyệt; tồn kho vẫn chưa được khai báo nên hệ thống chưa cho đặt hàng. Ảnh gốc do chủ dự án cung cấp được ưu tiên; các detail crop được ghi rõ là crop từ ảnh gốc, không phải góc chụp mới. Lư xông trầm mini vẫn dùng concept AI vì thư mục ảnh không có ảnh khớp. Nhãn nguồn thay đổi theo từng ảnh đang xem.

Các SKU demo `DEMO-LIF-NNN` và `DEMO-DIP-NNN` không được coi là hàng bán trực tiếp: API giữ giá tham khảo để hiển thị nhưng luôn trả `availableForPurchase: false`, không đưa chúng vào cart/checkout, kể cả khi DB có tồn kho cũ hoặc bị cấu hình nhầm. Muốn mở bán, chủ dự án cần duyệt SKU, giá, quyền ảnh và khả năng cung ứng rồi tạo SKU được duyệt riêng; không đổi dữ liệu demo để làm cổng này biến mất.

## Điều kiện

- Node.js 24 và dependency của repo đã cài.
- MongoDB chạy trên máy local, lắng nghe loopback.
- Không dùng URI Atlas, tunnel, staging hay production.

## Chạy trên PowerShell

```powershell
$env:DEMO_CATALOG_MONGODB_URI = 'mongodb://127.0.0.1:27017/tro_lam_dev_catalog_demo'
npm run seed:demo-catalog -w backend
Remove-Item Env:DEMO_CATALOG_MONGODB_URI
```

Lệnh mặc định từ chối host ngoài loopback, thông tin đăng nhập, query options và database khác tên. Có thể bật riêng Atlas demo theo hướng dẫn [atlas-demo-catalog.md](atlas-demo-catalog.md). Với slug demo đã có, script chỉ cập nhật gallery, mô tả preview, chế độ bán và giá tham khảo sau khi kiểm tra SKU, dòng và danh mục vẫn thuộc bộ seed này; không xóa collection, không thay đổi tồn kho hay trạng thái. Nếu slug xung đột với sản phẩm khác, lệnh dừng.

Khi chạy backend local với database này, storefront có thể hiển thị các bản ghi ở trạng thái published. Giữ nhãn nguồn ảnh cạnh ảnh đang xem; concept AI không phải ảnh chụp SKU. Trước khi đưa dữ liệu lên production, chủ dự án cần xác nhận SKU, quyền dùng ảnh, tên sản phẩm, thông số, giá, tồn kho và khả năng cung cấp; không đưa bản ghi demo này lên production.

## Mở website với catalog demo

Lệnh `npm run dev` thường dùng `MONGODB_URI` đã cấu hình trong `backend/.env`. Nếu URI đó trỏ tới một database khác, website sẽ đọc catalog của database đó. Để xem 8 sản phẩm demo trên MongoDB loopback, bảo đảm MongoDB local đang chạy và catalog đã được seed, sau đó chạy:

```powershell
npm run dev:demo
```

Lệnh này khởi động frontend và backend, đặt `MONGODB_URI` chỉ cho các tiến trình con thành `mongodb://127.0.0.1:27017/tro_lam_dev_catalog_demo`, đặt CORS theo `FRONTEND_PORT`, rồi dùng dữ liệu đã có. Lệnh không seed, sửa hay xóa dữ liệu; cấu hình database bên ngoài trong `backend/.env` không bị thay đổi. Dừng bằng `Ctrl+C`.

Nếu cổng mặc định đang bận, chọn cổng trống cho cả hai tiến trình trong cùng PowerShell:

```powershell
$env:PORT = '5001'
$env:FRONTEND_PORT = '5174'
npm run dev:demo
```

Để tái tạo các ảnh crop từ ảnh gốc sau khi đổi ảnh nguồn, chạy `python fondend/scripts/build-owner-photo-derivatives.py` từ repository root (cần Pillow), sau đó chạy seed lại để cập nhật gallery trong database demo loopback.

## Kiểm tra database local (2026-10-07)

Seed loopback xác nhận database `tro_lam_dev_catalog_demo` có 8 sản phẩm `buy`: 3 Lifestyle, 5 Diplomacy; mỗi bản ghi có đúng 3 ảnh và một giá tham khảo dương. Không có tồn kho demo, nên checkout không cho đặt hàng. Đây chỉ xác nhận MongoDB loopback local, không xác nhận production.

## Xác minh storefront demo (2026-10-07)

Chạy seed loopback thành công: 8 sản phẩm published, 3 Lifestyle, 5 Diplomacy, đúng 3 ảnh mỗi sản phẩm. Với `FRONTEND_PORT=5174` và `PORT=5001`, `npm run dev:demo` khởi động cả Vite và API; `GET /` trả HTTP 200 và `GET /api/v1/products?page=1&limit=20` trả đủ 8 sản phẩm với 3 ảnh mỗi sản phẩm. Hai tiến trình demo đã được dừng sau khi xác minh. Cổng mặc định 5173 lúc đó đang được tiến trình khác sử dụng nên không bị dừng hoặc thay đổi.
