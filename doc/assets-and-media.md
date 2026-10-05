# Assets hình ảnh, video và font

## Minh họa biên tập

`fondend/public/assets/editorial/ceramic-tea-still-life.svg` là minh họa vector nguyên bản do Agy tạo với Gemini 3.8 Flash High theo `/teamwork-preview` (conversation `b39cbdce-4124-4c2d-a0cb-9c6e409af64c`), dựa trên bảng màu logo. Hình tự mô tả là concept minh họa, không phải ảnh sản phẩm. Không thêm tuyên bố về hoa văn/lịch sử; không mô tả SKU, kích thước, nghệ nhân hoặc hiện vật cụ thể; không dùng thay ảnh bán hàng.

Alt gợi ý: “Minh họa tĩnh vật bình gốm và chén trà màu lam, men ngà, điểm kim”. Nếu dùng làm trang trí nền và nội dung lân cận đã nói đủ, đặt `alt=""` để tránh đọc lặp.

Chưa có ảnh/video sản phẩm thật được chủ dự án cấp. Chưa tải media từ các website tham khảo. Trước khi publish catalog, chủ dự án cần cung cấp ảnh/video đúng SKU, quyền sử dụng, thông số hình chụp và nội dung đã duyệt; không tạo ảnh AI thay cho những bằng chứng này. Agy CLI không được quyền chạy công cụ research web trong phiên này, nên chưa xác minh hai site tham khảo và không lấy asset/copy từ đó.

## Cập nhật nghiên cứu tham khảo — 2026-10-06

Agy web research bị chặn quyền công cụ trong phiên nên không trả kết quả. Coordinator đã thay thế bằng đọc HTML công khai qua HTTP GET, chỉ đọc trang chủ của [saccodo.com](https://saccodo.com/) và [thanhnamhuongky.io.vn](https://thanhnamhuongky.io.vn/). Sắc Cố Đô có phần mở đầu dẫn vào trải nghiệm, các thẻ địa điểm/câu chuyện và hành trình theo bước. Thành Nam Hương Ký mở bằng lời giới thiệu thương hiệu, tiếp theo là câu chuyện, nhóm thẻ sản phẩm, điều hướng danh mục và đăng ký nhận tin. Đây là quan sát bố cục để tham khảo; không tải ảnh/video, không sao chép nội dung, logo, media hay mã nguồn. Ghi chú chi tiết về cách chuyển hóa vào nhận diện TRO & LAM nằm ở [brand-identity.md](brand-identity.md).

Chưa có video hay ảnh sản phẩm thật trong repo. Agy CLI xác nhận phiên này không có image-generation tool trực tiếp; lần gọi image-generator bị chặn do headless CLI không được cấp quyền `command`. Vì vậy chưa tạo được ảnh raster chân thực. SVG biên tập phía trên là hình minh họa trang trí, không phải ảnh thật hoặc SKU; không dùng để xác nhận đặc tính sản phẩm.

## Font tiếng Việt

- **Noto Serif Variable** cho tiêu đề; **Be Vietnam Pro** cho nội dung, điều hướng và số liệu.
- Tệp WOFF2 tự host trong `fondend/public/assets/fonts/`; các subset Vietnamese/Latin được chọn để hiện dấu tiếng Việt đúng. WOFF2 và giấy phép SIL Open Font License đi cùng mỗi bộ font.
- Nguồn tệp: Fontsource packages `@fontsource-variable/noto-serif@5.3.0` và `@fontsource/be-vietnam-pro@5.3.0`; metadata/license trong các tệp OFL cạnh font.
