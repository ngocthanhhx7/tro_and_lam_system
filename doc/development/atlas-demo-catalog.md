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

Seed tạo hai danh mục và tám sản phẩm demo: ba Lifestyle, năm Diplomacy, mỗi sản phẩm có ba ảnh và giá tham khảo để hiển thị giá bán trực tiếp. Các sản phẩm dùng `saleMode=buy`, không có tồn kho nên chưa thể đặt hàng. Giá là số minh họa cho catalog demo, chưa phải bảng giá được chủ dự án duyệt.

Các document lưu đường dẫn ảnh cùng site; lệnh không tải tệp ảnh lên Atlas. Frontend cần phục vụ các asset trong `fondend/public/assets/products/` tại cùng đường dẫn.

Nếu lệnh báo host/database không khớp, hãy dừng và xác minh cấu hình Atlas trước khi thử lại. Không bỏ qua kiểm tra bằng cách sửa guard trong script.

## Kết quả nạp ngày 2026-10-07

Catalog trên Atlas `trolamtest` được xác minh có hai danh mục demo và tám sản phẩm published: ba Lifestyle, năm Diplomacy. Mỗi SKU có đúng ba đường dẫn ảnh, `saleMode=buy`, một giá tham khảo, không có tồn kho.

Ở lần seed đầu, `products` và `categories` chưa có document nào. Database có document trong một số collection ứng dụng khác; seed chỉ ghi `products` và `categories`, không đọc nội dung hay sửa các collection đó. Tệp ảnh vẫn nằm trong dự án, không được tải thành binary lên Atlas.


Giá tham khảo demo đã nạp (VND):

| Dòng sản phẩm | Sản phẩm | Giá |
|---|---|---:|
| Lifestyle | Lư xông trầm mini | 390.000 |
| Lifestyle | Hũ trà | 590.000 |
| Lifestyle | Bộ chén độc ẩm | 1.290.000 |
| Diplomacy | Bình Thiên Nga | 5.800.000 |
| Diplomacy | Bình Phú Quý | 4.800.000 |
| Diplomacy | Bình Giọt Ngọc | 4.200.000 |
| Diplomacy | Bình Hoa Lam | 3.900.000 |
| Diplomacy | Bình Tỳ Bà | 5.200.000 |
