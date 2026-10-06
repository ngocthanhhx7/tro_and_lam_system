# Dữ liệu xem trước catalog trên máy local

Script tạo 8 sản phẩm xem trước trong database riêng `tro_lam_dev_catalog_demo`: 3 mẫu Lifestyle và 5 mẫu Diplomacy. Mỗi sản phẩm có ít nhất ba tệp gallery khác nhau. Ảnh gốc do chủ dự án cung cấp được ưu tiên; các detail crop được ghi rõ là crop từ ảnh gốc, không phải góc chụp mới. Lư xông trầm mini vẫn dùng concept AI vì thư mục ảnh không có ảnh khớp. Nhãn nguồn thay đổi theo từng ảnh đang xem. Các bản ghi chỉ dùng để xem bố cục và luồng giao diện; tất cả ở chế độ hỏi tư vấn, không ghi giá hay tồn kho.

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

Script từ chối host ngoài loopback, thông tin đăng nhập, query options và database khác tên. Với slug demo đã có, script chỉ cập nhật gallery và phần mô tả preview sau khi kiểm tra SKU, dòng và danh mục vẫn thuộc bộ seed này; nó không xóa collection hoặc thay đổi giá, sale mode, tồn kho hay trạng thái. Nếu slug xung đột với sản phẩm khác, lệnh dừng. Kết quả in ra số lượng theo dòng, trạng thái chỉ hỏi tư vấn, giá bỏ trống và số ảnh.

Khi chạy backend local với database này, storefront có thể hiển thị các bản ghi ở trạng thái published. Giữ nhãn nguồn ảnh cạnh ảnh đang xem; concept AI không phải ảnh chụp SKU. Trước khi đưa dữ liệu lên môi trường khác, chủ dự án cần xác nhận SKU, quyền dùng ảnh, tên sản phẩm, thông số, giá, tồn kho và khả năng cung cấp; không đưa bản ghi preview lên production.

Để tái tạo các ảnh crop từ ảnh gốc sau khi đổi ảnh nguồn, chạy `python fondend/scripts/build-owner-photo-derivatives.py` từ repository root (cần Pillow), sau đó chạy seed lại để cập nhật gallery trong database demo loopback.

## Kiểm tra database local (2026-10-06)

Truy vấn read-only xác nhận database `tro_lam_dev_catalog_demo` có 8 bản ghi: 3 Lifestyle, 5 Diplomacy; mỗi bản ghi có đúng 3 ảnh; tất cả là `quote`, không có giá và không có tồn kho demo. Đây chỉ xác nhận MongoDB loopback local, không xác nhận dữ liệu trên Atlas hoặc production.
