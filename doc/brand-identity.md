# TRO & LAM — bộ nhận diện triển khai

Trạng thái: hướng dẫn thiết kế số theo logo có trong repo và hồ sơ planning. Đây là hệ thống triển khai giao diện, không phải tuyên bố pháp lý về nhãn hiệu hay chứng minh xuất xứ từng sản phẩm.

## Ý niệm

Thương hiệu gốm Chu Đậu với hai tuyến Lifestyle và Diplomacy, kể bằng nhịp editorial gọn, vật liệu thật và trải nghiệm mua rõ ràng. Giữ dấu hiệu lam, men ngà, sen và vàng kim nhìn thấy trên logo; trang sản phẩm phải phân biệt mua trực tiếp với yêu cầu tư vấn theo `saleMode`.

## Màu

| Tên | Mã | Vai trò |
| --- | --- | --- |
| Lam thương hiệu | `#123F56` | Điều hướng, CTA chính, chữ đậm trên nền sáng |
| Lam sâu | `#092B3B` | Nền đậm và lớp phủ ảnh |
| Men ngà | `#F7F3E9` | Nền nội dung, thẻ editorial |
| Trắng | `#FFFFFF` | Form và vùng thao tác |
| Kim nhạt | `#D8B35A` | Viền, họa tiết và điểm nhấn trên lam; không dùng cho chữ nhỏ trên nền sáng |
| Mực | `#1D2930` | Nội dung chính |
| Chữ phụ | `#52626B` | Mô tả thứ cấp |
| Viền | `#D8DFE1` | Input, card và bảng |

Màu trạng thái dùng thêm: thành công `#216345`, cảnh báo `#81540B`, lỗi `#A12B35`; luôn kèm nhãn/icon, không chỉ đổi màu. Body text phải đạt tương phản WCAG AA 4.5:1; chữ lớn 3:1; focus nhìn rõ trên cả lam và men ngà.

## Chữ

- Tiêu đề: **Noto Serif**, các weight 400/500, hỗ trợ đầy đủ dấu tiếng Việt; Georgia/serif là fallback.
- Nội dung, biểu mẫu, điều hướng và số liệu: **Be Vietnam Pro**, weight 400/500/600/700; `system-ui` là fallback.
- Body từ 16px, line-height khoảng 1.6. H1 desktop 48–64px, mobile 32–40px; không để headline đẩy CTA khỏi màn hình điện thoại.
- Ưu tiên tự host WOFF2 có license OFL; không phụ thuộc font từ bên thứ ba để render nội dung cốt lõi.

## Logo và đồ họa

Logo gốc: [`fondend/public/assets/logo/logo.PNG`](../fondend/public/assets/logo/logo.PNG). Đây là ảnh nền lam có vòng tròn, chữ và sen màu kim. Dùng nguyên file, giữ tỷ lệ, không crop, recolor, tách chi tiết hay kéo giãn. Tệp phân biệt hoa/thường khi deploy Linux. Dùng `object-fit: contain`; trên header nhỏ có thể đặt wordmark text cạnh ảnh.

Đường tròn mảnh, nét hoa sen và họa tiết lam chỉ dùng như chi tiết trang trí có khoảng thở. Không dùng toàn bộ logo làm hero background. Card sản phẩm dùng nền trung tính, ảnh đúng tỷ lệ và tên/giá/CTA dễ so sánh.

## Hình ảnh, video và nội dung

- Ưu tiên ảnh sản phẩm thật do chủ dự án cấp, có quyền sử dụng và ánh sáng cho thấy men, họa tiết, kích thước. Mỗi ảnh cần alt mô tả điều nhìn thấy, không nhồi cụm từ tìm kiếm.
- Asset tạo bằng AI hoặc minh họa vector chỉ dùng làm art direction/editorial; phải được lưu kèm ghi chú nguồn và không trình bày như SKU, nghệ nhân hoặc địa điểm có thật.
- Không tải, cắt hoặc tái sử dụng ảnh/video/copy/logo/code từ Sắc Cố Đô hay Thành Nam Hương Ký. Chỉ học nhịp section và cách dẫn chuyện đã ghi ở `doc/planning/03-design-and-pages.md`.
- Video không autoplay có âm thanh; có poster, caption/transcript và điều khiển. Trang phải dễ hiểu khi video không tải hoặc người dùng bật `prefers-reduced-motion`.
- Không dùng lời chứng thực, số năm, nguồn gốc chi tiết, giá hay chính sách khi chưa có nguồn/duyệt tương ứng.

## Thành phần và nhịp giao diện

Container tối đa khoảng 1200px, gutter 16/24/32px; spacing theo bội 4px; góc control 8px, card 12px. Header public gọn; nội dung kể chuyện xen ảnh rộng và đoạn chữ ngắn. Workspace staff/admin dùng cùng font/màu nhưng nhịp dày hơn, ưu tiên bảng, trạng thái và thao tác.

Breakpoints: mobile 0–639px, tablet 640–1023px, desktop từ 1024px. Kiểm tra 320/390/768/1024/1440px và zoom 200%; menu điện thoại hỗ trợ Escape, focus và hoàn trả focus. Touch target tối thiểu 44×44px.
