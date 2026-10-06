# Kế hoạch tinh chỉnh storefront TRO & LAM

Ngày lập: 2026-10-06. Ghi chú triển khai này bổ sung cho `03-design-and-pages.md`; không sửa API, field, enum, quyền hay chính sách kinh doanh.

## Mục tiêu

Giữ nhịp trang chủ đã được chốt: hero thương hiệu → hành trình về TRO & LAM → Lifestyle → Diplomacy → “Gốm dành cho bạn” → phim/câu chuyện và lời mời liên hệ. Hai landing page `/bo-suu-tap/lifestyle` và `/bo-suu-tap/diplomacy` tiếp tục dẫn thẳng tới danh sách sản phẩm tương ứng.

Tinh chỉnh trọng tâm: dùng ảnh concept gắn với sản phẩm của từng dòng làm ảnh đại diện cho các khối Lifestyle/Diplomacy. Ảnh cảm hứng hiện tại đẹp nhưng chưa cho khách thấy trực tiếp mặt hàng; ảnh thay thế phải luôn ghi rõ là concept AI và chưa xác nhận như ảnh chụp SKU thật.

## Hiện trạng đã kiểm tra

- `CatalogHomePage` đã có phần giới thiệu hành trình, hai khối dòng sản phẩm, khu vực “Gốm dành cho bạn” và phim tư liệu. Không cần thêm dòng sản phẩm thứ ba hoặc bỏ featured products.
- Hai landing page dùng chung danh mục có lọc theo line, phần giới thiệu, gợi ý sản phẩm và CTA. Thông tin mua/báo giá lấy theo `saleMode` phía catalog.
- Manifest ảnh concept đã có tám mục sản phẩm, mỗi mục có ba file ảnh. Một số ảnh thứ ba là composition/crop và manifest đã ghi chú; chưa được mô tả thành góc chụp riêng hay ảnh sản phẩm thật.
- Ảnh tư liệu, ảnh nghề, phim, font `Noto Serif`/`Be Vietnam Pro` và ba Claude skill `seo-audit`, `ai-seo`, `copywriting` đã có trong repo. Nội dung văn hóa, giá, thông số, tình trạng bán và quyền media vẫn cần nguồn/duyệt tương ứng.

## Thay đổi UI trong follow-up

1. Dùng ảnh concept hũ trà cho Lifestyle và bình Thiên Nga cho Diplomacy ở trang chủ và đầu trang landing tương ứng.
2. Giữ disclosure nhìn thấy được ngay cạnh ảnh; `alt` nêu đây là concept AI, không nói ảnh là sản phẩm đang bán.
3. Thêm kiểm thử browser xác nhận hành trình, hai line, featured section, liên kết landing page và disclosure ảnh.
4. Giữ nguyên catalog query, điều hướng, giá, inventory, copy chính sách và phân quyền. Không thêm dữ liệu sản phẩm/API mới.

## Research và giới hạn asset

Đã kiểm tra `agy --help` và `agy models`; `gemini-3.8-flash-high` hiện có. Lệnh `/teamwork-preview` ở model đó với effort `high` bị Agy từ chối trước khi trả nội dung vì phiên headless không có quyền `command`; không bật `--dangerously-skip-permissions` và không ghi nhận research Agy là hoàn tất.

Fallback read-only trực tiếp nhận trang `saccodo.com` với HTTP 200 và cấu trúc các section “hành trình”, “khám phá điểm văn hóa”, “sản phẩm”; không tải hay dùng asset/copy của họ. `thanhnamhuongky.io.vn` hiện trả trang Cloudflare “One moment, please...” cho HTTP fetch nên chưa xác minh được nội dung sản phẩm mới trong lượt này. Dùng bản ghi khảo sát có sẵn trong `03-design-and-pages.md` làm reference đã lưu; không bổ sung chi tiết sản phẩm ngoài dữ liệu TRO & LAM đã có.

Trong lượt UI này dùng lại ảnh concept có sẵn, không tạo hoặc tải thêm ảnh. Trước khi thay concept bằng ảnh thật cần chủ dự án cung cấp/duyệt ảnh, thông tin SKU và quyền sử dụng. Duy trì tối thiểu ba file hình trong gallery từng sản phẩm; không gọi composition/crop là ảnh chụp riêng.

## Nghiệm thu

- Browser xác nhận cả hai link từ trang chủ mở đúng landing page và ảnh hiện đúng line.
- Mọi concept image có disclosure nhìn thấy được và alt trung thực; không xuất hiện giá, chất liệu, kích thước hoặc nguồn gốc tự suy diễn.
- Chạy `npm run check` và `npm run test:e2e`; chụp/kiểm tra 360, 390, 768, 1280 và 1440 px, menu keyboard, reduced motion và tràn ngang.
- SEO/GEO copy dùng danh từ sản phẩm rõ, tiêu đề/hierarchy bình thường, mô tả dựa trên facts được duyệt; không tạo nội dung riêng cho AI crawler, schema giả, FAQ hoặc tuyên bố xuất xứ chưa có nguồn.
- Cập nhật acceptance evidence cùng ảnh chụp không chứa PII sau khi browser review hoàn tất.

## Liên hệ nhanh và nhận diện

- Giữ nền ngà, lam đậm, điểm vàng kim và cặp font Noto Serif/Be Vietnam Pro đã được ghi trong brand guide. Họa tiết logo chỉ dùng tiết chế; nút liên hệ dùng kiểu pill nhỏ để tách khỏi nội dung editorial.
- Thêm ba liên kết public dựa trên nguồn chủ dự án cung cấp: Zalo `0966051231`, Messenger cho Facebook `gomchudautrovalam`, Hotline `0966051231`. Chi tiết nguồn ở [`../brand/contact-channels.md`](../brand/contact-channels.md).
- Đặt nút thành một cụm ở góc dưới trái; trợ lý ở góc dưới phải. Liên kết ngoài mở tab mới, link Hotline dùng giao thức điện thoại, focus ring có độ tương phản và animation tắt theo `prefers-reduced-motion`. Tại màn hình dưới 371 px, nhãn chữ được ẩn trực quan nhưng accessible name vẫn còn.
- Browser E2E xác nhận đích và nhãn của cả ba link, khoảng cách ngang với nút trợ lý, không tràn ngang ở 360/390/1280 px. Screenshot ở [`../release/evidence/interface-followup/`](../release/evidence/interface-followup/); ảnh chụp home dùng danh sách sản phẩm trống từ API stub, không phải bằng chứng catalog/provider live.

## Bổ sung theo brief nhận diện 2026-10-06

- Giữ bảng màu lam đậm, vàng kim và nền ngà; dùng Noto Serif cho tiêu đề, Be Vietnam Pro cho nội dung. Hai font tiếng Việt đã được self-host, không đổi token nhận diện đã chốt.
- Thêm SVG hoa sen nét mảnh lấy cảm hứng từ logo tại `fondend/public/assets/editorial/lotus-line-ornament.svg`. Họa tiết chỉ xuất hiện nhẹ ở đoạn kết trang chủ, không sửa hoặc thay logo và không đè lên ảnh sản phẩm.
- Trang chi tiết luôn có vùng biên tập câu chuyện. Câu chuyện đã xuất bản được hiển thị từ DTO hiện có; nếu chưa có nội dung được duyệt, giao diện nói rõ đang chờ biên tập và dẫn tới góc câu chuyện, không tự viết nguồn gốc hay lịch sử.
- Browser E2E kiểm tra vùng câu chuyện chờ nội dung, họa tiết trang trí, tắt video hero khi `prefers-reduced-motion` và không tràn ngang tại 360/390/768/1280/1440 px. Nội dung story được duyệt và ảnh chụp SKU thật vẫn thuộc đầu vào owner R03/R08.
