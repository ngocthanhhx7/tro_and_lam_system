# Assets hình ảnh, video và font

## Minh họa biên tập

`fondend/public/assets/editorial/ceramic-tea-still-life.svg` là minh họa vector nguyên bản do Agy tạo với Gemini 3.8 Flash High theo `/teamwork-preview` (conversation `b39cbdce-4124-4c2d-a0cb-9c6e409af64c`), dựa trên bảng màu logo. `fondend/public/assets/generated/chu-dau-jar-editorial.jpg` là ảnh raster biên tập được tạo ngày 2026-10-06 bằng Agy `/teamwork-preview` → Gemini 3.8 Flash High → image-generator subagent; kích thước 1200×896 px, SHA-256 `15651607FFC418FB3BFD4871B50BBEB22D166193BB94B25CC80496871EB7B977`. `fondend/public/assets/generated/chu-dau-jar-editorial-motion.mp4` là clip chuyển động 6 giây, 1200×896, H.264 không âm thanh, tạo từ chính ảnh concept này bằng chuyển động zoom rất nhẹ; SHA-256 `2C6CFD6E847D41E1EE264D67A3BCCD945B1E0858E82173C10D6EA27AC84A8B1A`. Đây là media minh họa do AI tạo và animate, không phải footage quay thật, ảnh SKU hay bằng chứng về sản phẩm, hoa văn, nguồn gốc hoặc lịch sử.

Alt gợi ý cho SVG: “Minh họa tĩnh vật bình gốm và chén trà màu lam, men ngà, điểm kim”. Alt gợi ý cho ảnh raster: “Ảnh minh họa AI: hũ gốm hoa văn lam trên vải linen”. Nếu dùng làm trang trí nền và nội dung lân cận đã nói đủ, đặt `alt=""` để tránh đọc lặp. Khi ảnh raster xuất hiện như hình chính, kèm nhãn “Ảnh minh họa do AI tạo; không đại diện sản phẩm đang bán.”

Chưa có ảnh/video sản phẩm thật được chủ dự án cấp. Clip MP4 hiện có chỉ là ảnh concept chuyển động, không được gọi là video quay sản phẩm. Chưa tải media từ các website tham khảo. Trước khi publish catalog, chủ dự án cần cung cấp ảnh/video đúng SKU, quyền sử dụng, thông số hình chụp và nội dung đã duyệt; không tạo ảnh AI thay cho những bằng chứng này. Agy CLI không được quyền chạy công cụ research web trong phiên này, nên không lấy asset/copy từ đó.

## Cập nhật nghiên cứu tham khảo — 2026-10-06

Agy web research bị chặn quyền công cụ trong phiên nên không trả kết quả. Coordinator đã thay thế bằng đọc HTML công khai qua HTTP GET, chỉ đọc trang chủ của [saccodo.com](https://saccodo.com/) và [thanhnamhuongky.io.vn](https://thanhnamhuongky.io.vn/). Sắc Cố Đô có phần mở đầu dẫn vào trải nghiệm, các thẻ địa điểm/câu chuyện và hành trình theo bước. Thành Nam Hương Ký mở bằng lời giới thiệu thương hiệu, tiếp theo là câu chuyện, nhóm thẻ sản phẩm, điều hướng danh mục và đăng ký nhận tin. Đây là quan sát bố cục để tham khảo; không tải ảnh/video, không sao chép nội dung, logo, media hay mã nguồn. Ghi chú chi tiết về cách chuyển hóa vào nhận diện TRO & LAM nằm ở [brand-identity.md](brand-identity.md).

Theo yêu cầu tiếp theo, ngày 2026-10-06 CLI đã xác nhận có model `gemini-3.8-flash-high` và nhận một yêu cầu tạo thêm ảnh qua `/teamwork-preview`; CLI trả “no output produced” vì cần quyền `command` và headless mode không thể hỏi quyền. Không dùng `--dangerously-skip-permissions`; không có ảnh mới nào được tạo trong lần thử này. Ảnh JPEG/clip Agy đã liệt kê ở trên là các asset concept có sẵn trong repo, không phải kết quả của lần gọi vừa bị chặn.

Chưa có video quay thật hay ảnh sản phẩm thật được chủ dự án cấp trong repo. JPEG và clip MP4 phía trên là concept biên tập do Agy tạo; clip chỉ animate ảnh tĩnh, không đại diện SKU thật và không xác thực nguồn gốc. Không tải ảnh/video từ hai website tham khảo. Trước khi publish catalog, chủ dự án cần cung cấp media đúng SKU, quyền sử dụng, thông số hình chụp và nội dung đã duyệt; không dùng ảnh AI thay cho bằng chứng này.

## Font tiếng Việt

- **Noto Serif Variable** cho tiêu đề; **Be Vietnam Pro** cho nội dung, điều hướng và số liệu.
- Tệp WOFF2 tự host trong `fondend/public/assets/fonts/`; các subset Vietnamese/Latin được chọn để hiện dấu tiếng Việt đúng. WOFF2 và giấy phép SIL Open Font License đi cùng mỗi bộ font.
- Nguồn tệp: Fontsource packages `@fontsource-variable/noto-serif@5.3.0` và `@fontsource/be-vietnam-pro@5.3.0`; metadata/license trong các tệp OFL cạnh font.

## Tình trạng sử dụng trong giao diện — 2026-10-06

`CatalogHomePage.jsx` đặt poster JPEG làm ảnh đại diện cho hero và cung cấp MP4 bằng phần tử `<video controls playsInline preload="none">`. Clip không tự phát; khi trình duyệt không hỗ trợ video, nội dung `<img>` là phương án hiển thị dự phòng. Chú thích ngay dưới media nói rõ ảnh do AI tạo và clip chỉ animate ảnh concept, không phải footage hay ảnh SKU. Không dùng asset này làm bằng chứng sản phẩm.

Coordinator đã mount route module P04 vào `AppRoutes` trong commit `8043da3`, cùng route fragment P03 và public content P08; import correction nằm ở `7af79ad`. `npm run check` trên detached QA checkout commit `7af79ad` pass (contract validation, lint, backend 92/92, Vite build 86 modules). Chưa có browser/E2E evidence, và backend routes chưa được gắn vào server composition.

## Additional editorial PNG — 2026-10-06

`fondend/public/assets/generated/chu-dau-ceramic-editorial-2026.png` was generated with Agy `/teamwork-preview`, Gemini 3.8 Flash High, using the `image-generator` subagent (conversation `bfb9cb5e-6b42-44dd-b652-e57e405dc7a1`). It is 1200 × 896 pixels, 2,094,386 bytes, SHA-256 `F44C18C04210B82CDA24791F5BC5EA55ECEC0FC2003362274E8D2756114AD323`. The image is an original blue-and-ivory tea-jar concept with a matching cup on linen. It contains no text, logo, person, SKU identifier, or supported provenance claim.

`CatalogHomePage.jsx` displays the PNG in a separate editorial section with lazy loading and this adjacent caption: “Ảnh minh họa do AI tạo; không đại diện cho sản phẩm đang bán.” It is a visual concept only. It does not replace owner-approved SKU photos, usage-rights documentation, or product evidence.

On 2026-10-06 the coordinator rechecked Agy and confirmed `gemini-3.8-flash-high` was listed, then retried image generation interactively through `/teamwork-preview`. The CLI displayed “AI: Out of credits”; no new image was produced. Existing Agy-generated assets above remain the artwork used by the current storefront. Do not describe this retry as successful generation or as web research.
