# Hướng dẫn câu chữ SEO/GEO cho TRO & LAM

Tài liệu này chuẩn bị cấu trúc và quy tắc biên tập cho tìm kiếm tiếng Việt. Không phải cam kết thứ hạng, nghiên cứu từ khóa đã hoàn tất hay nội dung thương mại được duyệt.

## Skills dành cho Claude Code trong repo

Project đã có các skill trong `.claude/skills/`: [seo-audit](../.claude/skills/seo-audit/SKILL.md), [ai-seo/GEO](../.claude/skills/ai-seo/SKILL.md) và [copywriting](../.claude/skills/copywriting/SKILL.md). Dùng chúng cùng giới hạn nguồn và claims trong tài liệu này; nội dung skill chung không thay thế dữ liệu, chính sách hoặc duyệt của chủ dự án. Số liệu và khuyến nghị SEO/GEO từ nguồn bên thứ ba phải được kiểm tra lại trước khi xuất bản.

## Nguồn và giới hạn claims

Nguồn ưu tiên là dữ liệu chủ dự án đã duyệt, CMS publish và planning trong repo. R03 (SKU/giá/tồn/ảnh), R06 (vận chuyển/đổi trả/chính sách), R08 (câu chuyện/nghệ nhân/hoa văn) và R09 (địa chỉ/geocoder) vẫn cần đầu vào. R07 đã có số Hotline/Zalo và trang Facebook → Messenger trong [hồ sơ kênh liên hệ](brand/contact-channels.md); địa chỉ, email và giờ làm việc chưa được cung cấp. Không suy diễn khi tạo copy.

Phân biệt rõ:

- **Đã được brief xác nhận:** thương hiệu TRO & LAM; gốm Chu Đậu; Lifestyle gồm lư xông trầm mini, hũ trà, bộ chén độc ẩm; Diplomacy gồm Thiên Nga, Phú Quý, Giọt Ngọc, Hoa Lam, Tỳ Bà; quà tặng văn hóa, nghề thủ công, NFC Storytelling; logo do chủ dự án cung cấp.
- **Chưa có căn cứ để xuất bản như dữ kiện:** giá, tồn, kích thước/chất liệu từng SKU, địa chỉ/email/giờ làm việc, lịch sử/mốc thời gian, tên/tiểu sử nghệ nhân, chứng nhận, tác dụng sức khỏe, nhận xét khách hàng, điều kiện giao/đổi trả, quyền dùng ảnh/video và bản dịch tiếng Anh. Hotline/Zalo/Messenger chỉ dùng theo đích đã ghi nguồn; khi số hoặc hồ sơ thay đổi cần xác nhận và cập nhật nguồn.
- Khi thiếu căn cứ, dùng bản nháp CMS hoặc câu trung tính như “Thông tin đang được cập nhật” nếu thiết kế cần chỗ trống; không thay bằng số liệu hay testimonial giả.

## Giọng và từ ngữ

Tiếng Việt tự nhiên, điềm tĩnh, cụ thể và tôn trọng vật phẩm. Dùng tên dòng/sản phẩm đúng brief; giải thích thuật ngữ bằng ngữ cảnh thay vì lặp từ khóa. CTA nói rõ tác vụ: “Khám phá sản phẩm”, “Thêm vào giỏ”, “Yêu cầu tư vấn”, “Tra cứu đơn hàng”. Chỉ cho phép mua trực tiếp khi `saleMode` và giá/tồn do server xác nhận.

Tránh: “tinh hoa nghìn năm”, “di sản hàng trăm năm”, “độc bản”, “chuẩn ngoại giao”, “bền vững”, “thân thiện môi trường”, “chữa lành”, “an toàn tuyệt đối”, “được nghệ nhân X chế tác” nếu chưa có bằng chứng và duyệt. Không tự gắn chứng nhận hoặc giải thưởng.

## Cấu trúc nội dung tìm kiếm

Mỗi trang công khai có một H1 mô tả đúng nội dung, tiêu đề riêng, mô tả ngắn dễ hiểu, URL tiếng Việt nhất quán và link nội bộ có nghĩa. Mục tiêu từ khóa là giả thuyết biên tập cho tới khi có dữ liệu query/analytics; không nhồi cụm từ và không tạo hàng loạt landing page gần trùng.

| Loại trang | Ý định cần phục vụ | Dữ liệu cần có trước khi viết chi tiết |
| --- | --- | --- |
| Trang chủ | Nhận diện TRO & LAM, khám phá gốm Chu Đậu, chọn mua hoặc tư vấn | Nội dung giới thiệu đã duyệt, ảnh/quyền dùng, liên hệ |
| Bộ sưu tập | Duyệt Lifestyle hoặc Diplomacy và lọc đúng nhu cầu | Category/SKU thật, saleMode, ảnh, giá nếu mua trực tiếp |
| Chi tiết sản phẩm | Xem thông số, cách dùng/chăm sóc, giá và hành động tiếp theo | Thuộc tính sản phẩm chính xác, ảnh, giá/tồn được server cấp |
| Câu chuyện/NFC | Đọc thông tin về vật phẩm, hoa văn hoặc nghề | Nguồn nội dung, tác giả/đơn vị duyệt, media có quyền dùng |
| Quà doanh nghiệp | Gửi nhu cầu tư vấn quà tặng | Form hợp đồng và nội dung không hứa giá/thời hạn |
| Liên hệ/chính sách | Tìm kênh thật hoặc điều kiện giao dịch | Chủ dự án cung cấp và duyệt trước publish |

## GEO/answer readiness

- Trả lời câu hỏi bằng câu ngắn, trực tiếp rồi nêu chi tiết có nguồn. Mỗi đoạn nên đọc độc lập được và có chủ thể rõ.
- Đặt tên thương hiệu, dòng sản phẩm và đối tượng trang nhất quán; dùng bảng khi so sánh trường dữ liệu thực.
- Chỉ trích dẫn nguồn thực sự đã đọc; nêu tổ chức, URL và ngày nếu thông tin có thể thay đổi. Không tạo “chuyên gia”, quote hay số liệu để tăng khả năng được trích dẫn.
- Dùng structured data chỉ khi phản ánh đúng nội dung đang hiển thị. `Product`/`Offer` cần giá, currency, availability thực từ catalog; `Review` cần review thật đã publish; `Organization` cần thông tin doanh nghiệp đã xác nhận. Không phát FAQ schema cho nội dung không có trên trang.
- Hướng dẫn GEO bên thứ ba có thể chứa số liệu/vendor claim đã cũ. Xác minh bằng tài liệu tìm kiếm chính thức hoặc nghiên cứu gốc trước khi dùng; không hứa AI sẽ trích dẫn.
- Không mở index cho giỏ, checkout, đơn hàng, hồ sơ, ticket hoặc trang staff/admin. `robots.txt` không thay thế xác thực quyền.

## Metadata và media

- Tạo `title`, description, canonical, Open Graph và alt riêng theo nội dung trang. Độ dài là gợi ý biên tập, không phải giới hạn cứng của Google.
- Frontend cập nhật title, description, Open Graph, Twitter và robots metadata sau khi React xử lý route; trang sản phẩm/câu chuyện chỉ giữ indexability khi API trả nội dung đã công bố. Đây chưa phải SSR/prerender, nên bot chia sẻ không chạy JavaScript có thể chỉ thấy metadata mặc định.
- Giỏ hàng, checkout, tra cứu/chi tiết đơn, hồ sơ, ticket, luồng xác thực và trang staff/admin nhận `noindex, follow`. Những thẻ này không thay xác thực quyền. Chưa có domain chính thức trong cấu hình; chưa phát canonical, URL tuyệt đối cho chia sẻ, robots.txt hay sitemap. Không dùng hostname localhost/staging làm URL chuẩn. Chốt crawl policy, canonical và sitemap sau khi owner cấp domain/hosting R01; không chặn crawler ở robots.txt trước khi có noindex và domain phù hợp.
- Ảnh phải có kích thước khai báo, định dạng tối ưu, `srcset/sizes`, lazy load dưới fold và caption/transcript phù hợp. Alt mô tả ảnh cho người dùng screen reader.
- Chỉ dùng ảnh có nguồn/quyền ghi nhận hoặc asset nội bộ. Asset AI/vector ghi trong manifest tài sản và không được làm giả ảnh sản phẩm thật.
- Chỉ cho phép crawler cần thiết theo quyết định owner sau khi domain thật có (R01); robots/sitemap không được chứa URL riêng hoặc thông tin cá nhân.

## Bàn giao SEO

Mọi thay đổi ghi route, intent, H1/title/description, canonical/indexability, schema source fields, links/media và lệnh kiểm tra. Không báo đã xác minh Search Console, thứ hạng, crawl của Gemini/ChatGPT hay traffic khi chưa có domain, quyền truy cập và phép đo thực.
