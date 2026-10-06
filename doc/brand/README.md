# TRO & LAM — nhận diện và hướng dẫn nội dung

Tài liệu này ghi lại hướng nhận diện đang dùng trong giao diện, để thiết kế Stitch,
nội dung và phần triển khai tiếp tục nhất quán. Đây là hướng thiết kế của dự án;
không thay thế logo hoặc xác nhận thông tin sản phẩm do chủ dự án cung cấp.

## Tinh thần thương hiệu

TRO & LAM giới thiệu gốm Chu Đậu theo hai hướng đã chốt trong hồ sơ dự án:

- **Lifestyle Line** — gốm trong đời sống, góc trà và không gian sống.
- **Diplomacy Line** — gốm cho những dịp trao tặng và nhu cầu tư vấn quà tặng.

Ngôn ngữ hình ảnh ưu tiên chất liệu thật, ánh sáng tự nhiên, bố cục biên tập có khoảng
thở và cách kể chuyện điềm tĩnh. Website tham khảo chỉ gợi ý nhịp bố cục; không sao chép
logo, nội dung, sản phẩm hoặc ảnh của họ.

## Logo

- Dùng đúng tệp `fondend/public/assets/logo/logo.PNG`.
- Giữ nguyên tỷ lệ, nền lam, vòng tròn, chữ và hình sen; không vẽ lại, cắt hoặc đổi màu.
- Logo là ảnh raster vuông có nền. Dùng `object-fit: contain`; không đặt toàn bộ logo làm ảnh nền.
- Bản vector hoặc biến thể nền trong suốt cần chủ thương hiệu cung cấp.

## Màu sắc và chữ

| Vai trò | Giá trị hiện dùng |
| --- | --- |
| Lam thương hiệu (token nền tảng) | `#123F56` |
| Lam editorial (header/ribbon) | `#123F50` |
| Lam đậm | `#092B37` |
| Ngà nền tảng | `#F7F3E9` |
| Ngà editorial | `#F8F5ED` |
| Vàng nhấn | `#D8B35A` |
| Vàng chữ nhỏ trên nền sáng | `#AE8C4A` |
| Mực nội dung | `#1D2930` |

Màu vàng dùng làm chi tiết hoặc chữ lớn trên nền đậm; không dùng làm chữ nhỏ trên nền ngà.
Đo lại tương phản khi thêm thành phần mới; trạng thái không chỉ dựa vào màu sắc.

- **Tiêu đề:** Noto Serif, self-host trong `fondend/public/assets/fonts/`.
- **Nội dung, điều hướng và biểu mẫu:** Be Vietnam Pro, self-host, hỗ trợ tiếng Việt.
- Giấy phép SIL Open Font License được giữ cạnh các tệp font trong thư mục fonts.
- Không tải font ngoài khi đã có bản local.

Chi tiết token, breakpoint và yêu cầu component xem tại
[`doc/planning/03-design-and-pages.md`](../planning/03-design-and-pages.md).

## Hình ảnh và video

- Ảnh xưởng, ảnh tư liệu và ảnh sản phẩm là ba loại khác nhau. Không dùng ảnh biên tập
  để làm ảnh cho một SKU.
- Ghi nguồn, tác giả và giấy phép trong [`doc/brand/media/photography-sources.md`](media/photography-sources.md).
- Video banner MP4 và poster được dùng ở trang chủ. GIF được lưu làm tư liệu, không đưa
  vào thư mục public để tránh tải cùng ứng dụng. Nguồn và ghi công ở
  [`doc/brand/media/video-sources.md`](media/video-sources.md).
- Ảnh trong `fondend/public/assets/products/concepts/` do AI tạo hoặc dẫn xuất từ concept.
  Chúng không xác nhận sản phẩm vật lý, màu men, kích thước, nguồn gốc hay tồn kho. Luôn
  giữ thông báo concept kề gallery; thay bằng ảnh thật đã được duyệt trước khi mở bán.
- Mỗi gallery có thể chứa ít nhất ba hình để hỗ trợ bố cục xem sản phẩm. Nguồn ảnh ghi rõ
  ảnh tạo mới, crop hay ghép; không gọi ảnh dẫn xuất là góc chụp riêng.

## Cách viết

- Viết tiếng Việt tự nhiên, ngắn gọn, mô tả điều khách có thể nhìn thấy hoặc thao tác.
- Dùng đúng tên **Lifestyle Line**, **Diplomacy Line** và tên sản phẩm trong catalog đã
  được duyệt. Không tự đặt giá, kích thước, chất liệu, tồn kho, chính sách hoặc lời chứng thực.
- Chỉ nêu lịch sử, nghệ nhân, kỹ thuật và nguồn gốc khi trang nguồn được kiểm chứng và
  nội dung được duyệt. Ghi liên kết nguồn cạnh tư liệu văn hóa khi phù hợp.
- Tiêu đề trang và mô tả tìm kiếm phải nêu đúng nội dung trang, dùng từ khóa tự nhiên,
  không lặp từ khóa. Alt text mô tả nội dung ảnh; không chèn quảng cáo.
- Với GEO, câu trả lời phải rõ chủ thể và có nguồn kiểm chứng; không tạo FAQ hoặc dữ liệu
  cấu trúc để xác nhận điều chưa có bằng chứng. Tham khảo các hướng dẫn nội bộ tại
  `.claude/skills/seo-audit`, `.claude/skills/ai-seo` và `.claude/skills/copywriting`.

## Điểm vào triển khai

- Hệ thống component và sitemap: [`doc/planning/03-design-and-pages.md`](../planning/03-design-and-pages.md).
- Trang public: `fondend/src/layouts/PublicCatalogLayout.jsx` và `fondend/src/pages/public/`.
- Kiểu chữ và token giao diện: `fondend/src/styles/fonts.css`, `fondend/src/styles/atelier.css`.
- Ghi nguồn media hiển thị cho khách: `/nguon-tu-lieu`.
