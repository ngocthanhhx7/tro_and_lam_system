# Assets hình ảnh, video và font

## Minh họa biên tập

`fondend/public/assets/editorial/ceramic-tea-still-life.svg` là minh họa vector nguyên bản do Agy tạo với Gemini 3.8 Flash High theo `/teamwork-preview` (conversation `b39cbdce-4124-4c2d-a0cb-9c6e409af64c`), dựa trên bảng màu logo. `fondend/public/assets/generated/chu-dau-jar-editorial.jpg` là ảnh raster biên tập được tạo ngày 2026-10-06 bằng Agy `/teamwork-preview` → Gemini 3.8 Flash High → image-generator subagent; bản được đưa vào repo có kích thước 1200×896 px, JPEG, SHA-256 `15651607FFC418FB3BFD4871B50BBEB22D166193BB94B25CC80496871EB7B977`. Cả hai đều là hình minh họa do AI tạo, không phải ảnh SKU hay bằng chứng về sản phẩm, hoa văn, nguồn gốc hoặc lịch sử.

Alt gợi ý cho SVG: “Minh họa tĩnh vật bình gốm và chén trà màu lam, men ngà, điểm kim”. Alt gợi ý cho ảnh raster: “Ảnh minh họa AI: hũ gốm hoa văn lam trên vải linen”. Nếu dùng làm trang trí nền và nội dung lân cận đã nói đủ, đặt `alt=""` để tránh đọc lặp. Khi ảnh raster xuất hiện như hình chính, kèm nhãn “Ảnh minh họa do AI tạo; không đại diện sản phẩm đang bán.”

Chưa có ảnh/video sản phẩm thật được chủ dự án cấp. Chưa tải media từ các website tham khảo. Trước khi publish catalog, chủ dự án cần cung cấp ảnh/video đúng SKU, quyền sử dụng, thông số hình chụp và nội dung đã duyệt; không tạo ảnh AI thay cho những bằng chứng này. Agy CLI không được quyền chạy công cụ research web trong phiên này, nên chưa xác minh hai site tham khảo và không lấy asset/copy từ đó.

## Cập nhật nghiên cứu tham khảo — 2026-10-06

Agy web research bị chặn quyền công cụ trong phiên nên không trả kết quả. Coordinator đã thay thế bằng đọc HTML công khai qua HTTP GET, chỉ đọc trang chủ của [saccodo.com](https://saccodo.com/) và [thanhnamhuongky.io.vn](https://thanhnamhuongky.io.vn/). Sắc Cố Đô có phần mở đầu dẫn vào trải nghiệm, các thẻ địa điểm/câu chuyện và hành trình theo bước. Thành Nam Hương Ký mở bằng lời giới thiệu thương hiệu, tiếp theo là câu chuyện, nhóm thẻ sản phẩm, điều hướng danh mục và đăng ký nhận tin. Đây là quan sát bố cục để tham khảo; không tải ảnh/video, không sao chép nội dung, logo, media hay mã nguồn. Ghi chú chi tiết về cách chuyển hóa vào nhận diện TRO & LAM nằm ở [brand-identity.md](brand-identity.md).

Chưa có video hay ảnh sản phẩm thật được chủ dự án cấp trong repo. Ảnh raster phía trên là concept biên tập chân thực được Agy tạo thành artifact JPEG rồi coordinator sao chép vào repo; nó không đại diện SKU thật và không xác thực nguồn gốc. Không tải ảnh/video từ hai website tham khảo. Trước khi publish catalog, chủ dự án cần cung cấp ảnh/video đúng SKU, quyền sử dụng, thông số hình chụp và nội dung đã duyệt; không dùng ảnh AI thay cho bằng chứng này.

## Font tiếng Việt

- **Noto Serif Variable** cho tiêu đề; **Be Vietnam Pro** cho nội dung, điều hướng và số liệu.
- Tệp WOFF2 tự host trong `fondend/public/assets/fonts/`; các subset Vietnamese/Latin được chọn để hiện dấu tiếng Việt đúng. WOFF2 và giấy phép SIL Open Font License đi cùng mỗi bộ font.
- Nguồn tệp: Fontsource packages `@fontsource-variable/noto-serif@5.3.0` và `@fontsource/be-vietnam-pro@5.3.0`; metadata/license trong các tệp OFL cạnh font.
