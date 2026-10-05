# Thiết kế giao diện và đặc tả trang TRO & LAM

Ngày khảo sát: **06/10/2026 (Asia/Saigon)**. Trạng thái: đề xuất triển khai; không phải giao diện đã hoàn thiện. Tài liệu này mô tả thiết kế, nội dung và hành vi UI để các agent frontend làm song song trên cùng hợp đồng nghiệp vụ/API.

## 1. Nguồn và phạm vi quan sát

| Nguồn | Bằng chứng đọc thực tế | Kết luận có thể sử dụng |
| --- | --- | --- |
| [Thành Nam Hương Ký](https://thanhnamhuongky.io.vn/) | Đã mở trang chủ bằng browser, xem screenshot desktop khoảng 1265×713 và mobile viewport 390×844; đọc cây accessibility các phần trang chủ | Header nâu/vàng, hero hình/video phủ tối và chữ serif lớn, kể chuyện xen kẽ hình sản phẩm, hướng dẫn truy xuất, câu chuyện và footer hỗ trợ. Mobile chuyển menu thành hamburger, giữ biểu tượng giỏ hàng. |
| [Sắc Cố Đô](https://saccodo.com/) | Đã đọc trang chủ bằng web và browser, xem screenshot desktop khoảng 1265×713 và mobile 390×844; đọc navigation/sections | Header trắng, hero ảnh phong cảnh có lớp xanh tối, tiêu đề display nổi bật, CTA vàng, nội dung di sản theo section, giải thích trải nghiệm vật phẩm–công nghệ, sản phẩm và gallery. Mobile chuyển navigation thành menu, hero xếp giữa. |
| `fondend/public/assets/logo/logo.PNG` | Đã mở ảnh thực bằng công cụ xem ảnh | Logo vuông, nền xanh lam đậm có texture, vòng tròn/chữ vàng kim, minh họa sen và dòng “GỐM CHU ĐẬU”. |
| Ảnh đính kèm của người dùng | Brief doanh nghiệp và đường dẫn logo | Là nguồn yêu cầu thương hiệu, không phải screenshot hai website tham khảo. |

Giới hạn: chỉ khảo sát trang chủ công khai và các link xuất hiện trong cây accessibility, chưa kiểm thử checkout/account/admin hai website. Web-fetch Thành Nam ban đầu timeout nhưng browser mở và xem được. Hero trên mobile có thời điểm nền trống khi media/animation chưa tải; screenshot sau cho thấy nội dung Sắc Cố Đô đã xuất hiện. Không khẳng định cả hai site có UX thanh toán hoặc bảo mật tốt. Không lấy/sao chép logo, hình ảnh, video hay nội dung thương hiệu của họ. Screenshot chỉ được quan sát trong phiên công cụ, chưa lưu thành file trong repository.

Các quan sát màu/font trên đây là mô tả bằng mắt; **không khẳng định mã màu hoặc tên font chính xác của nguồn**. Mọi token bên dưới là đề xuất riêng cho TRO & LAM. Các nội dung địa lý/lịch sử quảng bá trên site tham khảo không được dùng làm dữ liệu đã xác minh cho thương hiệu.

## 2. Hướng thiết kế đã đề xuất

Kết hợp nhịp kể chuyện giàu hình ảnh của Thành Nam với cách dẫn từ vật phẩm văn hóa sang trải nghiệm số của Sắc Cố Đô. Đổi sang bản sắc gốm Chu Đậu: xanh hoa lam, màu men ngà, điểm vàng từ logo; khoảng thở lớn, ảnh gốm rõ chất liệu, chữ dễ đọc. Trang bán hàng ưu tiên giá, biến thể, tồn kho và CTA; trang storytelling ưu tiên nghề, nghệ nhân, hoa văn và nguồn gốc có biên tập.

Hai tuyến rõ ràng:

- **Lifestyle Line**: khám phá → chọn SKU/biến thể → giỏ → đặt hàng; các mặt hàng có giá/tồn kho hợp lệ mới có CTA mua.
- **Diplomacy Line**: khám phá → chi tiết → gửi yêu cầu quà tặng/báo giá. Không mặc định tất cả sản phẩm ngoại giao chỉ báo giá: `saleMode = buy | quote | both` quyết định CTA từng sản phẩm. `buy` mua trực tiếp; `quote` chỉ gửi yêu cầu báo giá; `both` có cả CTA mua và tư vấn/báo giá, với yêu cầu báo giá tách khỏi giỏ. Không dùng giá “0đ” cho mặt hàng báo giá, không cộng sản phẩm quote vào giỏ mua trực tiếp.

Baseline dữ liệu: mỗi product là **một SKU**, có giá/tồn kho riêng. Khi giới thiệu lựa chọn kích thước/hoa văn khác nhau, UI chọn product/SKU ID khác đã tồn tại trong catalog; không tự tạo API variants hay nested variant schema chưa được thống nhất.

Brand Awareness và storytelling không thay thế luồng thương mại: CTA “Khám phá bộ sưu tập” và “Tư vấn quà tặng” luôn có đích thật. Không bịa thành tựu, chứng nhận, số năm, nghệ nhân, địa chỉ, hotline, giá sản phẩm hoặc feedback. Nội dung chưa có dữ liệu phải được đánh dấu draft, không đưa dữ liệu mẫu lên production như dữ liệu thật.

## 3. Design tokens dùng chung

| Token | Giá trị đề xuất | Cách dùng |
| --- | --- | --- |
| `--color-brand` | `#123F56` | Header/footer, CTA chính, chữ trên nền sáng |
| `--color-brand-deep` | `#092B3B` | Hero overlay, hover CTA |
| `--color-gold` | `#D8B35A` | Chi tiết trang trí, đường viền, accent trên nền đậm |
| `--color-paper` | `#F7F3E9` | Nền chính, gợi màu men/nguyên liệu |
| `--color-surface` | `#FFFFFF` | Form, card, màn vận hành |
| `--color-ink` | `#1D2930` | Body text |
| `--color-muted` | `#52626B` | Secondary text |
| `--color-border` | `#D8DFE1` | Viền form/table |
| `--color-success` / danger | `#216345` / `#A12B35` | Trạng thái có icon và chữ đi kèm |
| `--color-warning` | `#81540B` | Cảnh báo trên nền sáng |
| Font heading | `Noto Serif`, fallback Georgia/serif | Tiếng Việt đủ dấu; serif dành tiêu đề thương hiệu |
| Font body | `Be Vietnam Pro`, fallback system-ui/sans-serif | Form, navigation, dữ liệu và nút |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64, 96px | Dùng token thay giá trị tùy tiện |
| Container | max 1200px; gutter 16/24/32px | Mobile/tablet/desktop |
| Radius | 8px control; 12px card; pill chỉ chip/badge | Không áp pill cho mọi thành phần |
| Shadow | Nhẹ, dành dropdown/modal | Không dùng shadow dày cho product card |

Token accent vàng không dùng làm chữ nhỏ trên nền ngà. Agent phải đo contrast khi hiện thực: body tối thiểu 4.5:1, chữ lớn 3:1; focus indicator rõ trên mọi nền. Có thể chỉnh token để đạt tiêu chí mà vẫn giữ hướng thương hiệu. Font self-host WOFF2 có license phù hợp hoặc dùng system fallback; không thêm request bên ngoài không cần thiết.

Responsive: 0–639 mobile, 640–1023 tablet, >=1024 desktop. Đây là breakpoint triển khai, không phải viewport đã kiểm thử. H1 desktop 48–64px/mobile 32–40px, H2 32–40/26–30px; body tối thiểu 16px, line-height 1.6. Public section padding 48/80px; workspace dùng nhịp gọn 24/32px. Không font quá lớn gây đẩy CTA xuống quá sâu trên điện thoại.

Logo hiện có là raster với nền và chữ chi tiết, không phải SVG trong suốt. Dùng `object-fit: contain`, giữ tỷ lệ, không cắt mất sen/chữ, không đổi màu. Header dùng chiều cao khoảng 56–64px với nền phù hợp; ở kích thước nhỏ có thể bổ sung wordmark bằng text cạnh ảnh để đọc rõ. Cần chủ thương hiệu cấp vector/biến thể nền trong suốt về sau; không tự tuyên bố đã có. Không đưa toàn ảnh logo làm nền hero. Asset URL `/assets/logo/logo.PNG` phân biệt hoa thường khi deploy Linux.

## 4. Layout và components chung

- `PublicLayout`: announcement tùy dữ liệu; header logo/nav (Bộ sưu tập, Câu chuyện, Quà tặng doanh nghiệp, Liên hệ), search, tài khoản, giỏ; footer thông tin đã xác minh/chính sách/tra cứu. Mobile menu drawer khóa focus, đóng Escape/overlay, trả focus nút mở.
- `AccountLayout`: sidebar tài khoản hoặc tabs/mobile drawer; breadcrumb; vùng thông báo. Public header vẫn dùng được. Route auth không làm mất giỏ guest.
- `StaffLayout`: sidebar dashboard/đơn hàng/hỗ trợ/báo giá/thông báo, header user; table/filter/pagination; admin chuyển được vào workspace staff.
- `AdminLayout`: thêm sản phẩm, users, nội dung, NFC, audit logs và cấu hình được phép. Chỉ hiển thị menu theo quyền nhưng server mới là nơi quyết định quyền thật.
- Shared: Button, Input, Select, Checkbox, Textarea, Dialog, Drawer, Badge, Toast, Alert, Skeleton, EmptyState, Pagination, DataTable, ProductCard, Money, OrderTimeline, FileUpload, NotificationPanel.
- Không dùng toast làm phản hồi duy nhất cho lỗi form. Field error đặt sát input; summary lỗi liên kết đến field; focus field lỗi đầu sau submit. `aria-live` cho kết quả gửi/đổi trạng thái.

Đặt components tái dùng trong `fondend/src/components`, page theo actor trong `pages`, layout trong `layouts`, cấu hình route trong `routes`, API wrapper trong `services`, hooks trong `hooks`, token CSS trong `styles`. Không agent nào tạo thư mục `frontend` khác với `fondend` đã thống nhất.

## 5. Sitemap và đặc tả trang public/guest

Routes là hợp đồng đề xuất cho frontend; API endpoints nằm trong tài liệu API. Product slug, article slug và NFC token phải có validation. Query pagination/filter nằm trên URL và khôi phục được khi back.

| ID / route | Nội dung và thao tác chính | Trạng thái/kiểm tra bắt buộc |
| --- | --- | --- |
| PUB-01 `/` | Hero gốm/ảnh nghề có H1, 2 CTA; 2 line; featured buy/quote/both; câu chuyện Chu Đậu; giải thích NFC 3 bước; vật liệu bao bì; bài viết; CTA quà doanh nghiệp | Không video bắt buộc để hiểu trang; poster/fallback ảnh; sản phẩm loading skeleton; section không dữ liệu ẩn hoặc empty có ý nghĩa; mobile ảnh/CTA xếp dọc |
| PUB-02 `/san-pham` | Search tên/keyword; filter line/category/price cho buy hoặc both/saleMode/availability; sort; pagination; product card giá hoặc “Yêu cầu báo giá” | Empty theo bộ lọc có reset; lỗi có retry; không trộn quote vào filter giá giả; không mất filter khi xem chi tiết/back |
| PUB-03 `/bo-suu-tap/:line` | Intro Lifestyle/Diplomacy, ảnh, công dụng, sản phẩm và CTA theo mode | Line không hợp lệ 404; dữ liệu draft không public; mobile 2 cột nếu ảnh/tên đủ đọc, 1 cột khi cần |
| PUB-04 `/san-pham/:slug` | Gallery zoom accessible; tên/line/SKU; giá/tồn kho; lựa chọn mẫu khác trỏ product/SKU ID riêng; mô tả kích thước/chất liệu/hoa văn/cách dùng; bao bì; NFC/câu chuyện; shipping/care; reviews đã duyệt; liên quan | Buy: chọn SKU, qty, thêm giỏ/mua ngay; quote: CTA báo giá; both: cả CTA mua và tư vấn. SKU hết hàng disable mua có lý do; API cập nhật tồn/giá khi thêm giỏ/checkout; sản phẩm ẩn/xóa 404 công khai |
| PUB-05 `/gio-hang` | Line item SKU, qty, xóa, subtotal; phí vận chuyển tính sau; tiếp tục mua/checkout | Guest cart authoritative trên server qua cookie opaque; local chỉ cache productId/qty tùy chọn không chứa PII; empty CTA; đổi giá/hết hàng cảnh báo; merge login không nhân qty bất ngờ; subtotal frontend chỉ dự kiến |
| PUB-06 `/thanh-toan` | Guest không bắt đăng ký; tên/SĐT/email/người nhận/địa chỉ; customer chọn địa chỉ; shipping; ghi chú; phương thức; review tổng server; chính sách; đặt hàng | Chặn submit lặp; validation server; đang tạo/khôi phục lỗi có retry an toàn; cart/tổng server thay đổi phải xác nhận mới; không gửi request tạo thanh toán khi form chưa hợp lệ |
| PUB-07 `/thanh-toan/ket-qua` | Hiển thị trạng thái server: chờ/đã thanh toán/hủy/lỗi; mã đơn; tra cứu; hướng dẫn giữ thông tin truy cập | URL return/cancel không là bằng chứng đã trả tiền; polling có timeout và nút kiểm tra lại; không tạo đơn mới do refresh; không hiện PII từ URL |
| PUB-08 `/tra-cuu-don-hang` | Nhập mã đơn → xác minh quyền qua token riêng hoặc OTP tới liên hệ đặt hàng → đầy đủ chi tiết đơn dành cho khách: timeline, items/tổng/phí, người nhận/SĐT/địa chỉ giao, trạng thái thanh toán, hỗ trợ | Preview trước xác minh chỉ thông tin tối thiểu/che PII; sau xác minh xem đầy đủ chi tiết khách được phép, không notes nội bộ/secret/dữ liệu thanh toán nhạy cảm. Mã đơn đơn độc không cho xem PII. Thông báo lỗi chung tránh enumeration; rate-limit; OTP hết hạn/gửi lại có countdown; mất token có luồng xác minh phục hồi |
| PUB-09 `/cau-chuyen` + `/cau-chuyen/:slug` | Câu chuyện thương hiệu/nghề/nghệ nhân/hoa văn, bài viết có nguồn và media được phép dùng | List empty; detail 404 nếu draft; HTML được sanitize; caption/transcript; lazy-load media dưới fold |
| PUB-10 `/nfc/:publicId` | Trang mobile ưu tiên: sản phẩm liên quan, nguồn gốc/hoa văn/câu chuyện, care guide, xem bộ sưu tập/liên hệ | NFC là URL mở bằng điện thoại, không yêu cầu browser NFC API; publicId inactive/unknown có thông báo phù hợp; publicId không tiết lộ người mua/đơn; NFC kể chuyện không tự là chứng nhận chống giả |
| PUB-11 `/qua-tang-doanh-nghiep` | Use case đối tác/ngoại giao; Diplomacy; chọn sản phẩm/qty/ngân sách/thời điểm/cá nhân hóa/liên hệ; gửi báo giá | Data draft rõ; form lỗi/gửi/đã nhận ticket; không hứa thời hạn hay giá chưa được xác nhận; quote submit không là đơn mua/giữ tồn |
| PUB-12 `/lien-he` | Kênh liên hệ thật; form họ tên/email/SĐT tùy trường/bộ phận/chủ đề/message; tạo yêu cầu và SMTP qua server | Gửi thành công khi lưu yêu cầu; email retry độc lập; không lộ SMTP; honeypot/rate-limit; message không render HTML nguy hiểm |
| PUB-13 `/chinh-sach/:slug` | Bảo mật, mua hàng, vận chuyển, đổi trả/khiếu nại, thanh toán, điều khoản; version/ngày áp dụng | Là nội dung phải được chủ dự án duyệt trước production; không tự công bố chính sách pháp lý như đã được xác nhận |
| PUB-14 `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau` | Form và feedback xác minh; quay lại route hợp lệ; captcha chỉ khi có cấu hình | Không tiết lộ email tồn tại; password manager hoạt động; generic error; token invalid/expired; role không lấy từ form đăng ký |

Giỏ hàng desktop dùng table/two-column summary; mobile card từng item và summary cuối. Checkout desktop form + summary sticky trong giới hạn viewport; mobile summary collapsible có tổng luôn nhìn thấy. Sticky buy CTA mobile không đè consent/message/footer, giữ safe-area. Price format VND theo locale, hiển thị rõ đơn vị và phí chưa tính.

## 6. Sitemap và đặc tả customer

| ID / route | Nội dung và thao tác | Trạng thái/điều kiện |
| --- | --- | --- |
| CUS-01 `/tai-khoan` | Tổng quan, đơn gần đây, unread notifications, shortcut địa chỉ/hỗ trợ | Không dữ liệu có CTA mua; lỗi từng widget không làm trắng toàn trang |
| CUS-02 `/tai-khoan/ho-so` | Tên/contact, đổi mật khẩu theo flow auth; email change cần xác minh | Save loading/error/success; không đổi role; không mất draft khi lỗi |
| CUS-03 `/tai-khoan/dia-chi` | Trang riêng quản lý bảng địa chỉ: `recipientName`, `phone`, `line1`, `formattedAddress`, nhãn/mặc định; ward/province structured tùy chọn theo dataset/provider hiện hành; thêm/sửa/xóa; “Dùng vị trí hiện tại” | Model riêng, không nhét toàn bộ vào User. 1 default nếu còn địa chỉ; delete default yêu cầu chọn lại hợp lý. Geolocation chỉ khi click/đồng ý; reverse geocode lỗi/từ chối/timeout vẫn nhập tay được; kết quả là gợi ý phải xác nhận |
| CUS-04 `/tai-khoan/don-hang` | Tabs/filter/pagination; trạng thái fulfillment và payment tách biệt; tìm mã | Empty theo status/reset; loading table; lỗi retry; không thấy đơn người khác |
| CUS-05 `/tai-khoan/don-hang/:id` | Snapshot items/giá/địa chỉ, timeline, payment, invoice nếu có, cancel khi hợp lệ, yêu cầu hỗ trợ/khiếu nại, review item | Cancel chỉ trạng thái cho phép; submit idempotent; timeline từ server; link order ownership xác thực; sửa địa chỉ không sửa đơn lịch sử |
| CUS-06 `/tai-khoan/danh-gia` | Danh sách mua đủ điều kiện đánh giá; rating/comment/ảnh; trạng thái pending/published/hidden | Chỉ order delivered thuộc người dùng; baseline unique theo orderId/productId, mỗi product trong đơn được đánh giá một lần; pending/hidden không hiển thị public; lý do ẩn nếu chính sách cho phép; chỉnh sửa re-moderate theo API; upload có giới hạn |
| CUS-07 `/tai-khoan/ho-tro` + `/:id` | Tạo và theo dõi ticket; chọn đơn tùy chọn, type complaint/support, attachments, hội thoại, status | Không bịa chat realtime nếu chưa có; attachment private; lỗi upload không làm mất message; cảnh báo size/type; ticket closed cần flow reopen/new |
| CUS-08 `/tai-khoan/thong-bao` | Feed, filters, read/unread, mark-read/all, deep-link | Empty có giải thích; count đồng bộ; link còn quyền mới mở; thông báo chứa PII tối thiểu |

Địa chỉ hiện tại là hành động chủ động, không prompt permission ngay khi mở trang. Không gọi nhà cung cấp geocode bằng secret từ frontend; phải ghi rõ provider/data gửi sang bên thứ ba. Tách tọa độ tùy chọn với địa chỉ; người dùng có thể sửa gợi ý không cần giữ location chính xác. `line1` và `formattedAddress` cho phép nhập tay; ward/province structured là tùy chọn, không ép người dùng vào danh sách cũ. Nếu triển khai picker, chọn bộ dữ liệu hiện hành/version đã xác minh và hỗ trợ fallback khi provider hoặc dataset không khớp.

## 7. Staff workspace

| ID / route | Thao tác và nội dung | Bảo vệ/UX |
| --- | --- | --- |
| STF-01 `/staff` | KPI đơn chờ/xử lý, ticket, quote; bộ lọc thời gian; task queue | KPI có định nghĩa; empty không hiển thị demo số; lỗi widget riêng; không cần AI để xem số liệu |
| STF-02 `/staff/orders` + `/:id` | Filter/assign theo scope; nhận việc, xác nhận, đóng gói, vận chuyển, hoàn tất, hủy theo state; note nội bộ; contact khách | State transition hợp lệ server; optimistic concurrency tránh ghi đè; xác nhận thao tác ảnh hưởng khách/stock; audit; không staff sửa giá đơn đã trả |
| STF-03 `/staff/support` + `/:id` | Queue/ticket, assign, priority, reply, chuyển trạng thái; xử lý complaint gắn order | Note nội bộ khác reply khách; nội dung private; không sửa/xóa lịch sử trao đổi; trạng thái gửi lỗi rõ |
| STF-04 `/staff/quotes` + `/:id` | Contact lead kind quote: nhu cầu quà tặng, tư vấn, phân công, ghi chú và follow-up | Dùng trạng thái new/assigned/contacted/closed; không quote document/draft validity/conversion trong baseline; không tạo paid order từ lead. Quote acceptance có hợp đồng riêng ở phase sau |
| STF-05 `/staff/notifications` | Order/ticket assignment, nhắc việc | Deep link kiểm tra quyền; read/unread |
| STF-06 `/staff/customers/:id` | Thông tin liên hệ và đơn/ticket cần để CSKH | Quyền dữ liệu tối thiểu, che bớt khi phù hợp; không đổi role/khóa user |

Table desktop có sticky header, filter rõ và pagination server. Mobile chuyển card/đưa cột phụ vào details; hành động chủ chốt không bị ẩn chỉ do thiếu chiều rộng. Bulk transition không thuộc mặc định; nếu thêm phải trả kết quả từng item và audit đầy đủ.

## 8. Admin workspace và appeal bị khóa

Admin có toàn bộ nghiệp vụ staff qua quyền server. Không fork UI staff thành bản admin trùng code.

| ID / route | Nội dung và thao tác | Trạng thái/điều kiện |
| --- | --- | --- |
| ADM-01 `/admin` | Overview đơn/doanh thu/catalog/ticket/appeal, liên kết staff | KPI theo ngày/timezone, dữ liệu server; phân biệt doanh thu nhận tiền và doanh số tạo đơn |
| ADM-02 `/admin/products` + `/new` + `/:id/edit` | Xem/thêm/sửa/archive, categories/line, mỗi product một SKU/price/stock, media, care/story, buy/quote/both, draft/published | Validate unique SKU/slug; buy/both phải có giá hợp lệ; báo giá không để 0đ; soft-delete sản phẩm được đơn tham chiếu; preview nội dung và lỗi field |
| ADM-03 `/admin/users` + `/:id` | Tìm/xem/thêm/sửa thông tin cho phép; role customer/staff/admin; khóa/mở khóa với reason; lịch sử | Không đọc password; không tự đặt password rõ/gửi mail password; invite/reset an toàn. Không hạ quyền/khóa admin cuối; thao tác role/status có confirm/re-auth theo policy, audit; refresh quyền ngay |
| ADM-04 `/admin/appeals` + `/:id` | Queue pending, đọc lý do/tài liệu, request bổ sung, approve/reject reason, mở khóa qua quyết định explicit | Không approve tự động bởi Gemini; tránh xử lý lặp; notify quyết định; audit quyết định và thay đổi user tách rõ |
| ADM-05 `/admin/content` | Brand/story/articles/policies; draft/preview/publish; media metadata/source | Sanitize HTML, không public draft; nguồn văn hóa do người có thẩm quyền duyệt |
| ADM-06 `/admin/nfc` | Mapping token ↔ story/product, kích hoạt/tắt, URL preview | Token không dùng như order auth; revoked state UX; không tiết lộ metadata nội bộ |
| ADM-07 `/admin/logs` | Filter actor/action/entity/time, audit detail đã redacted | Read-only UI; không secret/OTP/payment raw/location/chat nhạy cảm; phân trang; không cho UI xóa dấu vết |
| ADM-08 `/admin/settings` | Chỉ cấu hình business an toàn được API cho phép, không sửa secrets từ UI mặc định | Phân quyền, field allowlist, confirm/persistence error; SMTP/payOS/Gemini secret ở env/server |
| ADM-09 `/admin/notifications` | Feed admin, appeal/escalation/payment issue | Không dựa notification làm bằng chứng payment; deep link kiểm tra quyền |
| ADM-10 `/admin/reviews` | Queue đánh giá pending, xem nguồn order/product được phép, publish/hide có reason; dùng `POST /admin/reviews/:id/moderation` | Không sửa nội dung khách để giả đánh giá; expectedVersion tránh ghi đè; audit moderation; public chỉ published |
| BLK-01 `/tai-khoan/bi-khoa` | Màn riêng: account bị khóa, lý do công khai phù hợp, logout; gửi appeal; mã/status appeal và phản hồi | Blocked session không truy cập nghiệp vụ customer/staff/admin; chỉ limited auth cho status/appeal/logout. Không redirect loop. Appeal rate-limit/anti-spam; form attachments private; rejected có policy gửi lại được định nghĩa |

Khi account bị khóa, public browsing vẫn theo quyền guest; không coi “khóa” là xóa đơn hoặc xóa dữ liệu. Luồng guest purchase và blocked-user purchase phải được policy/authorization xử lý rõ, không cho blocked token bypass chỉ bằng gọi guest API. UI appeal phải dùng được sau revoke session bằng cơ chế limited verification, không yêu cầu quyền customer đầy đủ.

## 9. Trạng thái và accessibility áp dụng mọi trang

Mỗi page/feature bàn giao có năm trạng thái tối thiểu: happy, loading, empty, validation error, server/network error; thêm unauthenticated/forbidden/not-found nếu có quyền/ID. Skeleton có chiều cao dự kiến, không layout shift lớn. Error có lời giải thích hành động được, retry không lặp transaction. Offline form không xóa draft. 401 đưa vào auth flow; 403 có trang rõ; status blocked đưa vào appeal.

- Navigation semantic `header/nav/main/footer`, skip link, một H1; heading thứ bậc. Breadcrumb có current page.
- Keyboard đầy đủ; focus visible; dialog trap focus/Escape/return focus; thông báo screen-reader; không chỉ dùng màu cho trạng thái.
- Touch target ít nhất 44×44px đề xuất; label thật, không dùng placeholder thay label; autocomplete tên/SĐT/email/address; password reveal có accessible name.
- Product ảnh alt mô tả sản phẩm/hoa văn; ảnh decorative alt rỗng; video có caption/transcript và điều khiển. Hero không autoplay sound; `prefers-reduced-motion` tắt parallax/carousel tự động.
- Kiểm tra 320, 390, 768, 1024, 1440px và zoom 200%; không horizontal overflow toàn trang. Đây là **checklist triển khai**, chưa được chạy trên TRO & LAM.
- Cart change/new notification thông báo nhẹ, không cướp focus. Disabled CTA có lý do, order cancel/role change modal giải thích tác động.
- Asset responsive `srcset/sizes`, width/height/aspect-ratio; lazy-load dưới fold, hero tối ưu tải; hạn chế video nặng; app chạy được khi media lỗi.

## 10. Nội dung cần chuẩn bị và nghiệm thu frontend

Content inventory: ảnh Lifestyle từng SKU/variant, ảnh Diplomacy từng bình, ảnh packaging lụa/xơ mướp, ảnh nghệ nhân/làng nghề có quyền sử dụng, nguồn story/hoa văn, hướng dẫn care, thông số/giá/tồn kho, chính sách thương mại, thông tin liên hệ thật, bản dịch nếu mở EN. Giai đoạn đầu tiếng Việt; thiết kế schema hỗ trợ locale nhưng không hiển thị nút English hoạt động giả.

Tiêu chí nghiệm thu UI:

1. Mọi route trong actor scope có page/loading/error/empty và guard đúng; link/CTA đi đến đích có thật.
2. Product buy/quote/both không lẫn hành vi; guest checkout không bắt đăng ký; lookup có verification và sau xác minh hiển thị đầy đủ chi tiết đơn dành cho khách; payment lấy trạng thái server.
3. Customer address/ticket/review/order chỉ lấy dữ liệu chủ sở hữu; staff/admin tuân scope server; blocked appeal truy cập được bằng flow giới hạn.
4. Component shared/token được dùng thống nhất; logo thật không sai tỷ lệ; không assets lấy trái phép từ website tham khảo.
5. Có kiểm thử desktop/mobile, keyboard, 200% zoom và contrast; có ảnh nghiệm thu từ sản phẩm triển khai, không ghi nhận screenshot nguồn là screenshot sản phẩm.
6. Gemini chỉ hỗ trợ soạn/tóm tắt theo dữ liệu được phép, UI gắn nhãn gợi ý; người xử lý duyệt nội dung và quyết định tài khoản/tài chính.

Agent frontend bắt đầu bằng danh sách page IDs được giao, route/API contract và file ownership trong tài liệu điều phối. Không tự thêm state máy/đổi schema API; gửi đề nghị thay đổi hợp đồng cho người tích hợp trước khi các agent phụ thuộc dùng.
