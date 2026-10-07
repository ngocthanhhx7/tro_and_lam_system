# Nạp catalog demo vào MongoDB Atlas

Atlas của dự án đang dùng database `trolamtest`. Lệnh dưới đây chỉ cho phép ghi catalog khi đồng thời bật đích `atlas-demo`, khớp chính xác host và database đã xác nhận. URI được đọc từ `backend/.env`; không in, sao chép hoặc commit URI.

Trước khi chạy, kiểm tra `MONGODB_URI` trong `backend/.env` thuộc Atlas demo. Không dùng cấu hình production.

Trong PowerShell tại thư mục gốc repository:

```powershell
$env:DEMO_CATALOG_TARGET = 'atlas-demo'
$env:DEMO_CATALOG_ATLAS_HOST = 'smartlearnai.ln2iwig.mongodb.net'
$env:DEMO_CATALOG_ATLAS_DATABASE = 'trolamtest'
try {
  npm run seed:demo-catalog -w backend
} finally {
  Remove-Item Env:DEMO_CATALOG_TARGET -ErrorAction SilentlyContinue
  Remove-Item Env:DEMO_CATALOG_ATLAS_HOST -ErrorAction SilentlyContinue
  Remove-Item Env:DEMO_CATALOG_ATLAS_DATABASE -ErrorAction SilentlyContinue
}
```

Seed tạo hai danh mục và tối đa tám sản phẩm demo đã được khai báo trong manifest: ba Lifestyle, năm Diplomacy, mỗi sản phẩm có ba ảnh. Lệnh chỉ upsert các slug/SKU demo đã biết, dừng nếu phát hiện xung đột, không xóa collection và không thay đổi các collection khác. Giá và tồn kho không được đặt; sản phẩm ở chế độ chỉ hỏi tư vấn.

Các document lưu đường dẫn ảnh cùng site; lệnh không tải tệp ảnh lên Atlas. Frontend cần phục vụ các asset trong `fondend/public/assets/products/` tại cùng đường dẫn.

Nếu lệnh báo host/database không khớp, hãy dừng và xác minh cấu hình Atlas trước khi thử lại. Không bỏ qua kiểm tra bằng cách sửa guard trong script.

## Kết quả nạp ngày 2026-10-07

Catalog trên Atlas `trolamtest` đã được xác minh có hai danh mục demo và tám sản phẩm published: ba Lifestyle, năm Diplomacy. Mỗi SKU demo có đúng ba đường dẫn ảnh, mọi sản phẩm ở chế độ hỏi tư vấn, không có giá. Các đường dẫn ảnh đều trỏ vào asset cùng site trong dự án.

Trước khi ghi, `products` và `categories` chưa có document nào. Database có document trong một số collection ứng dụng khác; thao tác seed chỉ ghi `products` và `categories`, không đọc nội dung hay sửa các collection đó. Tệp ảnh vẫn nằm trong dự án, không được tải thành binary lên Atlas.
