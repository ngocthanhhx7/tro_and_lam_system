# Làm lại giao diện TRO & LAM

Tham khảo chính: https://thanhnamhuongky.io.vn/ ; phụ: https://saccodo.com/.
Yêu cầu: thay toàn bộ hệ thống trình bày, gom Lifestyle/Diplomacy vào Sản phẩm,
đủ 5 mục điều hướng, footer đầy đủ, favicon thương hiệu. Trang biên tập dùng ảnh/video
thật có nguồn và quyền sử dụng; SKU concept AI chỉ xuất hiện trong gallery sản phẩm kèm
thông báo rõ, không dùng thay ảnh tư liệu hoặc quảng bá như hàng đã xác minh.

Thiết kế: nền ngà, xanh lam sâu, serif lớn; hero ảnh toàn chiều rộng với lớp phủ,
nhịp ảnh–chữ xen kẽ, khoảng trắng rộng, đường viền mảnh, icon SVG đồng nhất.
Giữ nguyên dữ liệu thương mại và API. Không dùng ảnh tư liệu làm ảnh SKU.

Kế hoạch thực hiện:
- [x] Header/footer dùng chung, menu bộ sưu tập, điều hướng mobile, tìm kiếm, favicon.
- [x] Trang chủ ảnh lớn, giới thiệu, hai bộ sưu tập, sản phẩm, phim tư liệu.
- [x] Câu chuyện, Về chúng tôi và nguồn ảnh; nội dung CMS đã xuất bản vẫn đọc qua route trang công khai.
- [x] Chuẩn hóa danh mục, chi tiết, liên hệ, giỏ hàng, thanh toán, tài khoản bằng lớp trình bày chung.
- [x] Contract, lint, backend tests và production build đã chạy qua `npm run check`.
- [x] Playwright tích hợp chạy 6/6 trên replica set loopback riêng; gồm catalog/cart/checkout guest ở 390px, phân quyền customer/staff/admin và hai luồng xác minh email.

Media biên tập: ảnh bàn xoay Earl Wilcox/Unsplash; bình Chu Đậu Marie-Lan Nguyen,
Wikimedia Commons, CC BY 2.5; phim VTV4 phát theo yêu cầu qua YouTube chính thức.
Hero dùng video do chủ dự án cung cấp từ Facebook Reel Tro & Lam (ghi nguồn tại
`doc/brand/media/video-sources.md`). Ảnh nguồn ngoài chỉ dùng cho nội dung biên tập và
ghi nguồn trên trang riêng; concept ảnh AI chỉ dùng trong gallery có disclosure.

Kiểm tra clean-tree trên source `0fb7d9d`, ngày 2026-10-06: `npm run check` pass
(contracts, lint, 185 backend tests pass, 0 skip với URI loopback riêng P02/P05/P06;
Vite build 128 modules). Playwright chạy 6/6 trên database P11 loopback riêng; teardown
xóa database và truy vấn hậu kiểm không còn database test. Bundle 543.66 kB vẫn có cảnh
báo vượt 500 kB. Kết quả và giới hạn nằm trong
[`doc/release/interface-refresh-evidence.md`](../release/interface-refresh-evidence.md).

Rà ảnh chụp home phát hiện video hero có phụ đề gắn sẵn trong footage. CSS đã phóng
khung và cắt phần dưới để phụ đề không đè lên dòng chú thích; ảnh home được chụp lại.
UI smoke sau chỉnh sửa xác nhận không tràn ngang ở 360/390/768/1280/1440 px và video
dừng theo `prefers-reduced-motion`. Trước/sau và các giới hạn còn lại xem tại
[`doc/release/interface-refresh-evidence.md`](../release/interface-refresh-evidence.md).
