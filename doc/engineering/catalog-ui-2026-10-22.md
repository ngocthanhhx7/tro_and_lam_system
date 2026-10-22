# Giao diện ảnh và tên dòng sản phẩm — 22/10/2026

## Thay đổi theo yêu cầu chủ dự án

- Ảnh thẻ sản phẩm dùng khung vuông thay khung 4:5. Giữ `object-fit: contain`, không sửa/cắt ảnh nguồn hoặc watermark; bỏ scale ảnh khi hover thẻ để tránh cắt mép.
- Ảnh chi tiết dùng khung vuông, hai cột cân bằng trên desktop; bỏ giới hạn `max-height: 690px` kế thừa và viền trang trí đè lên ảnh. Khung ảnh không đổi kích thước khi zoom.
- Thumbnail vuông 80px trên desktop, 64px trên mobile. Ảnh lazy trong thẻ dùng `sizes=auto` kèm fallback; ảnh chi tiết dùng ResizeObserver cập nhật kích thước tài nguyên theo khung thực tế và mức zoom.
- Trang chủ thay dấu en dash `–` bằng hyphen `-` trong nội dung tĩnh.
- Tên hiển thị: `Lifestyle Line` → **Dòng gốm đời sống**, `Diplomacy Line` → **Dòng gốm quà tặng**. Đồng bộ menu, tab/bộ lọc, metadata, thẻ, chi tiết, giỏ, giới thiệu, NFC và quản trị.

## Số đo trình duyệt trước/sau

Thẻ đầu danh sách, cùng dữ liệu công khai và viewport; đơn vị CSS px, làm tròn:

| Viewport | Trước | Sau |
| --- | --- | --- |
| 1920 | 323 × 404 | 323 × 323 |
| 1440 | 323 × 404 | 323 × 323 |
| 820 | 257 × 321 | 257 × 257 |
| 390 | 171 × 214 | 171 × 171 |
| 320 | 286 × 358 | 286 × 286 |

Ảnh khác tỷ lệ, ví dụ ảnh dọc Bình Phú Quý được chủ dự án yêu cầu giữ, vẫn có khoảng trống hai bên để bảo toàn nội dung ảnh. Không thể đồng thời lấp đầy khung vuông và giữ nguyên mọi mép ảnh dọc nếu không cắt hoặc kéo méo.

## Dữ liệu và hoàn tác

- Chỉ đổi tên hai danh mục đã công khai qua `catalogService.updateCategory`, cùng transaction, audit và kiểm tra version. Không đổi category ID, slug, mã `product.line`, SKU, quan hệ sản phẩm, giá hoặc tồn kho. Không chạy seed trên production.
- Migration có chế độ mặc định `--preflight` chỉ đọc và `--rollback` kiểm tra tên/version trước khi hoàn tác.
- Release mới: `/opt/tro-lam/releases/c6ce592-image-layout-vietnamese-20261022`.
- Release trước: `/opt/tro-lam/releases/c6ce592-inline-zoom-20261022`.
- Bản sao tên danh mục: `/var/lib/tro-lam/runtime/line-labels-00d401b0-493f-4746-aab8-27bf2adcff1b.json`.

## Kiểm chứng

Lint, build; 20 kiểm thử catalog/validation/ảnh và 4 kiểm thử seed an toàn đạt. Kiểm tra trình duyệt local dùng dữ liệu catalog công khai, không tạo đơn, thanh toán hoặc ghi giỏ production. Ma trận gồm 8 ảnh ở 5 viewport, đi từ thẻ đến chi tiết, đổi thumbnail/nút chuyển ảnh, căn khung, kích thước tài nguyên zoom và chữ trang chủ. Kiểm tra riêng thao tác zoom bằng chuột, bàn phím/Escape, chạm/kéo/chụm hai ngón và reduced motion.

Không thay truy vấn đọc sản phẩm hoặc hợp đồng API; các số đo trên là kích thước hiển thị, không phải benchmark MongoDB hoặc cam kết tốc độ toàn trang. Nội dung mô tả nghiệp vụ và các ảnh sản phẩm được chọn ở lượt trước được giữ nguyên.

## Homepage source photographs (2026-10-22)

Replaced all slides in the two homepage product-line sections with seven source product photographs already recorded in `product-photo-sources-2026-10-22.md`. Exact file hashes and source URLs: `fondend/public/assets/editorial/home-products/sources.json`. Kept watermarks; did not substitute the rejected gold Phú Quý variant. Old generated slideshow originals remain available for rollback but are no longer referenced by the homepage or responsive manifest.

Square contain frames preserve complete photographs. Tablet frame capped at 640px. Responsive WebP derivatives use widths up to 960px without enlarging originals. Manual numbered controls also work with reduced motion. Verified all seven photographs and controls at 1440, 820, 390 and 320px, with no horizontal overflow. Lint and production build pass. No API or database changes.
