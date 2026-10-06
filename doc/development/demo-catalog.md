# Dữ liệu xem trước catalog trên máy local

Script tạo 8 sản phẩm xem trước trong database riêng `tro_lam_dev_catalog_demo`: 3 mẫu Lifestyle và 5 mẫu Diplomacy. Mỗi sản phẩm có ít nhất ba ảnh concept cùng sản phẩm. Các bản ghi chỉ dùng để xem bố cục và luồng giao diện; ảnh được tạo bằng AI hoặc dẫn xuất từ concept, không xác nhận hàng hóa thực tế. Tất cả ở chế độ hỏi tư vấn, không ghi giá hay tồn kho.

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

Script từ chối host ngoài loopback, thông tin đăng nhập, query options và database khác tên. Nó không xóa collection hoặc cập nhật bản ghi đã có; nếu dữ liệu hiện hữu không đúng bất biến demo, lệnh dừng để tránh ghi đè. Kết quả in ra số lượng theo dòng, trạng thái chỉ hỏi tư vấn, giá bỏ trống và số ảnh.

Khi chạy backend local với database này, storefront có thể hiển thị các bản ghi ở trạng thái published. Giữ nhãn ảnh concept AI cạnh ảnh trong giao diện. Trước khi đưa dữ liệu lên môi trường khác, chủ dự án cần xác nhận SKU, quyền dùng ảnh, tên sản phẩm, thông số, giá, tồn kho và khả năng cung cấp; không đưa bản ghi preview lên production.

## Kiểm tra database local (2026-10-06)

Truy vấn read-only xác nhận database `tro_lam_dev_catalog_demo` có 8 bản ghi: 3 Lifestyle, 5 Diplomacy; mỗi bản ghi có đúng 3 ảnh; tất cả là `quote`, không có giá và không có tồn kho demo. Đây chỉ xác nhận MongoDB loopback local, không xác nhận dữ liệu trên Atlas hoặc production.
