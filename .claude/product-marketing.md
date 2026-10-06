# TRO & LAM — bối cảnh nội dung SEO/GEO

Đây là hồ sơ viết nội dung, không phải bằng chứng rằng sản phẩm đang có hàng hoặc thương hiệu là nhà sản xuất chính thức. Ưu tiên nguồn trong `doc/planning/research/` và dữ liệu do chủ dự án xác nhận.

## Bối cảnh đã được giao

- Tên thương hiệu dùng trong giao diện: **TRO & LAM**. Logo do chủ dự án cung cấp nằm ở `fondend/public/assets/logo/logo.PNG`.
- Dự án giới thiệu gốm Chu Đậu theo hai dòng: **Lifestyle** và **Diplomacy**. Giữ nguyên tên hai dòng này trong dữ liệu; phần mô tả cho khách hàng viết tiếng Việt.
- Nhóm mẫu được nêu trong brief: Lifestyle gồm lư xông trầm mini, hũ trà, bộ chén độc ẩm; Diplomacy gồm Thiên Nga, Phú Quý, Giọt Ngọc, Hoa Lam, Tỳ Bà. Tên mẫu là đầu mối catalog, chưa xác nhận SKU, biến thể, quyền phân phối, giá hoặc tồn kho của TRO & LAM.
- Font giao diện: Noto Serif cho tiêu đề; Be Vietnam Pro cho nội dung và điều khiển.
- Hai website tham khảo trong brief chỉ dùng để học nhịp kể chuyện và bố cục; không lấy văn bản, ảnh, dữ liệu sản phẩm hoặc nhận diện của họ.

## Quy tắc nội dung

- Viết tiếng Việt tự nhiên, có dấu; ưu tiên câu rõ nghĩa, mô tả cụ thể, giọng điềm tĩnh và giàu cảm giác vật liệu.
- Có thể dùng các nhãn điều hướng đã thống nhất: “Hành trình TRO & LAM”, “Gốm dành cho bạn”, “Lifestyle”, “Diplomacy”.
- Không tự khẳng định lịch sử, niên đại, nguồn gốc của từng món, nghệ nhân, kỹ thuật, chất liệu, kích thước, độ bền, chứng nhận, quan hệ chính thức với làng nghề/nhà sản xuất, quà tặng ngoại giao đã được sử dụng, giá, ưu đãi, chính sách, địa chỉ, hoặc còn hàng. Chỉ đưa vào trang khi có nguồn và chủ dự án duyệt.
- Ảnh trong `fondend/public/assets/products/concepts/` là concept AI hoặc ảnh crop/ghép từ concept. Luôn ghi rõ là ảnh minh họa ý tưởng, không dùng làm bằng chứng về hàng thật; không gán thông số hay men/màu chính xác dựa trên ảnh. Thay bằng ảnh hàng hóa đã duyệt trước khi mở bán.
- Không tạo đánh giá, số lượng đã bán, chứng thực khách hàng hay FAQ chỉ để nhắm từ khóa. Không nhồi từ khóa vào tiêu đề, alt text hoặc đường dẫn.

## Hướng SEO/GEO

- Gán một nhu cầu tìm kiếm chính cho mỗi URL; dùng title, H1, mô tả và liên kết nội bộ nhất quán với đúng trang.
- Viết phần mở đầu trả lời trực tiếp trang nói về gì. Với nội dung cần nguồn, nêu nguồn/ngày và tách dữ kiện đã xác minh khỏi mô tả biên tập.
- Ưu tiên trang dòng sản phẩm, trang sản phẩm, câu chuyện thương hiệu và hướng dẫn chăm sóc khi có dữ liệu đáng tin. Mọi tuyên bố sản phẩm phải truy về catalog đã được duyệt hoặc nguồn chính thức.
- Chỉ xuất JSON-LD `Product`, `Offer`, `AggregateRating`, `Organization` hoặc địa chỉ khi có dữ liệu thật và được duyệt; không tạo giá, tồn kho, đánh giá, địa chỉ hay hồ sơ doanh nghiệp để lấp trường.
- Có thể đề xuất `llms.txt` hoặc định dạng dễ trích dẫn như một thử nghiệm nội dung; không hứa chúng làm tăng thứ hạng hay bảo đảm được hệ thống AI trích dẫn.
- Nếu chưa có domain, analytics hoặc Search Console, đánh dấu đó là đầu vào thiếu; không bịa số liệu hiệu suất hay kết quả GEO.
