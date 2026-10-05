# TRO & LAM — Phạm vi nghiệp vụ, quyền và tiêu chí nghiệm thu

Ngày lập: 06/10/2026. Trạng thái: đặc tả triển khai đề xuất từ yêu cầu chủ dự án; không phải tuyên bố các chức năng đã hoàn thành. Đọc cùng `02-workflows.md` và các hợp đồng API/data trong bộ tài liệu planning. Tên thư mục frontend được giữ đúng yêu cầu hiện tại: `fondend/`.

## 1. Mục tiêu và phạm vi

TRO & LAM phát triển gốm Chu Đậu kết hợp thủ công truyền thống, thiết kế đương đại và NFC Storytelling. Website phục vụ nhận diện thương hiệu, giới thiệu sản phẩm, kể chuyện văn hóa, thu lead quà tặng và bán hàng. Đối tượng chính 25–55 tuổi, thu nhập trung bình khá/cao, khách hàng thành thị, doanh nghiệp/đại lý/tổ chức ngoại giao; thiết kế cần mở đường cho nội dung tiếng Anh nhưng bản đầu ưu tiên tiếng Việt.

| Dòng | Nội dung đầu vào từ chủ dự án | Cách bán mặc định đề xuất |
|---|---|---|
| Lifestyle | Lư xông trầm mini, hũ trà, bộ chén độc ẩm; bọc lụa, phụ trợ xơ mướp tự nhiên | Sản phẩm công bố giá và tồn kho được mua trực tiếp |
| Diplomacy | Bình Thiên Nga, Phú Quý, Giọt Ngọc, Hoa Lam, Tỳ Bà | Có `saleMode=buy|quote|both`; không suy đoán mọi bình đều chỉ báo giá |
| NFC Storytelling | Nguồn gốc, hoa văn, nghệ nhân, câu chuyện văn hóa | Trang truy cập URL NFC công khai; chức năng xác thực hiện vật phải được định nghĩa riêng |

Sản phẩm chưa có giá chính thức dùng CTA “Yêu cầu tư vấn”, không đặt giá giả hoặc nhận thanh toán bằng giá demo. Không tự tạo chứng nhận nguồn gốc, tuyên bố sức khỏe, số năm làng nghề hay thông tin nghệ nhân chưa có nguồn/duyệt nội dung. Tài sản logo có sẵn tại `fondend/public/assets/logo/logo.PNG`; agent phải kiểm tra file thực tế trước khi dùng.

Ba actor được cấp tài khoản là `customer`, `staff`, `admin`. Guest là trạng thái chưa đăng nhập. SMTP, payOS, Gemini và dịch vụ bản đồ/giao vận là tích hợp, không phải role đăng nhập.

## 2. Ma trận quyền bắt buộc

“Của mình” là ownership kiểm tra tại server, không phải chỉ ẩn nút frontend. Admin bao gồm quyền vận hành staff. Các quyền mua cá nhân nếu mở cho staff/admin vẫn tuân ownership như customer; không có quyền sửa đơn cá nhân qua giao diện vận hành để tự bỏ qua chính sách.

| Nghiệp vụ | Guest | Customer | Staff | Admin |
|---|---|---|---|---|
| Xem/search/filter catalog, nội dung đã publish, NFC công khai | Có | Có | Có | Có |
| Giỏ hàng, checkout sản phẩm bán trực tiếp | Có | Có, giỏ đồng bộ tài khoản | Có thể mua cá nhân | Có thể mua cá nhân |
| Tra cứu đơn đầy đủ | Token riêng hoặc OTP xác minh | Đơn có `userId` của mình | Đơn phục vụ vận hành | Kế thừa staff |
| Hủy đơn theo chính sách | Sau xác minh quyền đơn | Đơn mình | Thực hiện với lý do, đúng trạng thái | Kế thừa staff |
| Sổ địa chỉ/trang quản lý riêng, định vị | Form checkout tạm, không sổ tài khoản | CRUD của mình | Sổ cá nhân nếu mua | Sổ cá nhân nếu mua |
| Đánh giá sản phẩm | Chuyển đăng nhập và claim đơn trước | Đơn mình đã giao; một review/order/product | Như customer với đơn cá nhân | Như customer, cộng kiểm duyệt |
| Liên hệ, tư vấn, lead quà tặng | Có, chống spam | Có | Xử lý lead được phân công | Xem toàn bộ/quản lý phân công |
| Ticket/khiếu nại/đổi trả | Contact hoặc ticket với token đơn được xác minh | Ticket của mình; có hoặc không gắn đơn | Tiếp nhận, phân công, phản hồi, xử lý | Kế thừa staff, quyết định hoàn tiền |
| Dashboard đơn/ticket/công việc | Không | Tóm tắt tài khoản mình | Dashboard riêng cho vận hành | Dashboard vận hành và quản trị |
| Sản phẩm xem/thêm/sửa/xóa | Public only | Public only | Không sửa catalog | CRUD, xuất bản, lưu trữ |
| Tồn kho | Chỉ trạng thái khả dụng public | Như guest | Xem, thao tác cấp phát theo đơn | Điều chỉnh tồn kèm lý do/audit |
| User xem/thêm/sửa/khóa/mở/đổi role | Không | Hồ sơ mình; không role/status | Không quản lý users | Có, áp dụng bảo vệ admin cuối |
| Kháng nghị tài khoản khóa | Chỉ với appeal session sau xác minh | Tài khoản khóa có màn riêng | Không quyết định | Xem, duyệt/từ chối kèm lý do |
| Thông báo | Xác nhận đơn/email được phép; không inbox tài khoản | Inbox mình/read/read-all | Inbox mình và sự kiện công việc | Inbox mình và sự kiện quản trị |
| Nội dung CMS/NFC, cấu hình công bố | Public only | Public only | Read-only nghiệp vụ | CRUD/publish |
| System/audit logs | Không | Không | Không | Đọc/lọc; không sửa/xóa bằng API |
| Gemini chatbot | Hỏi tri thức công khai | Như guest | Như guest | Cấu hình nguồn tri thức được duyệt |
| Hoàn tiền thực tế | Không | Yêu cầu hoàn tiền | Đề xuất, ghi chứng cứ | Quyết định và xác minh thực thi |

## 3. Dữ liệu và ranh giới ownership

| Tài nguyên đề xuất | Chủ sở hữu / quy tắc truy cập | Bất biến |
|---|---|---|
| `users` | User xem hồ sơ mình; admin quản lý tối thiểu cần thiết | Role chỉ customer/staff/admin; status active/blocked; email chuẩn hóa unique; mật khẩu hash, không xuất response |
| `addresses` | Collection riêng, `userId` bắt buộc; customer CRUD bằng `(id,userId)` | Tối đa một mặc định/user; đơn lưu snapshot độc lập; không expose địa chỉ qua public API |
| `carts` với items nhúng | User cart bằng session; guest cart bằng định danh guest opaque | Client giá chỉ hiển thị; server định giá lại; ownership không lấy từ body |
| `products` | Admin quản lý; public chỉ publish và các trường an toàn | Bản đầu một SKU/product, SKU unique; lựa chọn mẫu/kích thước là product ID khác, chưa có product_variants; archive khi đã có đơn; snapshot đơn giữ tên/giá/ảnh tại thời điểm mua |
| `inventory`, `stock_reservations`, `inventory_movements` | Admin điều chỉnh; staff thao tác trong workflow đơn | `available=onHand-reserved`; không âm; transaction/conditional write chống oversell |
| `orders` với statusHistory nhúng | Customer sở hữu qua userId; guest qua token/OTP; staff/admin quyền vận hành | Code không phải bí mật; snapshot người nhận; tiền VND số nguyên; trạng thái có version |
| `payment_attempts`, `payment_events`, `refunds` | Nội bộ server; customer/guest chỉ trạng thái/link an toàn của đơn mình | Không lưu credentials payOS; webhook signature + amount + order mapping + idempotency |
| `reviews` | User mua hàng sở hữu; public chỉ review đã được phép công bố | Unique `(userId,orderId,productId)`; không sửa sao/nội dung để tạo đánh giá tốt giả |
| `tickets`, `ticket_messages`, `attachments` | Customer hoặc guest đã xác minh, staff/admin vận hành | Tin nội bộ staff không trả cho customer; file không public đoán được URL |
| `account_appeals` | Chỉ chủ tài khoản qua appeal scope và admin | Một pending/user; không dùng appeal token đăng nhập hoạt động thông thường |
| `notifications` | `recipientUserId` riêng từng người | Unique recipient/event/channel; read không thay trạng thái đơn |
| `contacts` | Guest/customer gửi; staff/admin tiếp nhận | Consent mục đích liên hệ; chống spam; email gửi khác với lead đã lưu |
| `pages`, `stories`, `nfc_tags` | Public chỉ publish; admin CRUD | NFC story không tự chứng minh hàng chính hãng; tag active/revoked, thay tag bằng record mới khi cần |
| `sessions`, `auth_challenges` | Server-owned | Token chỉ lưu hash; expiry kiểm tra trong app, không chỉ dựa TTL cleanup |
| `audit_logs`, `outbox_events` | Server ghi; admin đọc bản đã che dữ liệu | Không ghi password/OTP/session/URI DB/token đơn; sự kiện không bị mất khi email lỗi |

Guest đăng ký sau mua không tự chiếm đơn chỉ vì biết email/số điện thoại/mã đơn. Claim phải xác minh quyền email đã dùng cho đơn bằng OTP hoặc guest order token kết hợp tài khoản verified, trong transaction `userId=null -> currentUserId`; không chuyển đơn của user khác. Sau claim thu hồi guest credential cho đơn.

Staff chỉ thấy thông tin người nhận cần giao hàng/chăm sóc; không thấy hash mật khẩu, token, địa chỉ khác chưa dùng trong đơn, cuộc hội thoại riêng không liên quan. Tệp export chứa PII là tính năng admin riêng, không bật mặc định. Xóa địa chỉ không thay lịch sử đơn. Xóa/archive sản phẩm không làm mất lịch sử thanh toán/review/ticket. Không hard-delete user có giao dịch; khóa hoặc xử lý ẩn danh theo chính sách lưu trữ riêng, không xóa lịch sử tài chính tùy tiện.

## 4. Defaults để agent có thể triển khai song song

Các mục sau là quyết định đề xuất cho bản đầu, có thể cấu hình và phải nêu trong bàn giao; không phải chính sách thương mại đã được chủ dự án xác nhận.

| ID | Mặc định triển khai | Điểm cần chủ thương hiệu chốt trước go-live |
|---|---|---|
| DEC-01 | Việt Nam, VND; thời gian lưu UTC, hiển thị Asia/Ho_Chi_Minh | Bán quốc tế, ngôn ngữ, thuế/hóa đơn |
| DEC-02 | COD và payOS qua feature flags; không có credentials thì không hiện phương thức lỗi | Merchant, giới hạn COD, đối soát thực tế |
| DEC-03 | `saleMode=buy|quote|both`; quote-only không vào checkout, both chỉ mua khi có giá/tồn hợp lệ | Bảng giá/ảnh thật/SKU/tồn kho/đóng gói |
| DEC-04 | Quote vận chuyển do server từ cấu hình khu vực; không giả tích hợp hãng | Phí/miễn phí/vùng phục vụ và nhà vận chuyển |
| DEC-05 | Guest checkout yêu cầu tên, email, điện thoại, địa chỉ; không ép đăng ký | Có cần chỉ điện thoại và SMS provider hay không |
| DEC-06 | Guest cart server, cookie opaque HttpOnly token chỉ lưu hash; local cache ids/qty tùy chọn; merge cộng qty rồi kiểm tra tồn/giới hạn, hiển thị xung đột | Giới hạn mua SKU |
| DEC-07 | Giữ tồn payOS đề xuất 15 phút, cấu hình cùng expiry payment link; COD pending không tự hết hạn, cảnh báo staff để hủy thủ công; rate limit/max pending orders chống chiếm tồn | Thời gian cảnh báo/xử lý COD và TTL payOS trước go-live |
| DEC-08 | Customer tự hủy khi `pending`; sau confirmed gửi ticket; đơn đã trả tiền tạo yêu cầu refund riêng | Điều kiện hủy, trả hàng, hàng làm theo yêu cầu |
| DEC-09 | Window yêu cầu đổi/trả dự kiến 7 ngày từ delivered, cấu hình; luôn cho gửi complaint/support | Chính sách vỡ/hỏng vận chuyển, phí trả hàng |
| DEC-10 | Review 1–5 sao sau delivered; không có voucher tự thưởng theo nguồn tham khảo | Kiểm duyệt nội dung, thời hạn sửa review |
| DEC-11 | Inbox thông báo + transactional email; polling bản đầu, realtime mở rộng sau | SMTP, retention, email marketing opt-in |
| DEC-12 | Admin duyệt refund; staff chỉ đề xuất; refund gateway chỉ khi provider hỗ trợ đã xác minh | Cách hoàn ngân hàng/thủ công, quyền chi tiền |
| DEC-13 | Gemini chỉ công khai, fail rõ khi unavailable; fallback contact/ticket | Model khả dụng, key, chi phí và consent gửi hội thoại |
| DEC-14 | Product create/update/archive admin; xóa cứng chỉ draft chưa tham chiếu | Ai phê duyệt nội dung và xuất bản |
| DEC-15 | Guest secure token có scope/expiry, phục hồi bằng OTP email; code đơn chỉ dẫn đường | TTL cụ thể, thời gian lưu đơn/ticket/PII |

Không hardcode chính sách hoàn tiền, tuyên bố pháp lý hoặc điều khoản bán hàng chưa được phê duyệt thành trang public như chính sách chính thức. Feature flag và notice “chưa cấu hình” dành cho môi trường development; bản production thiếu cấu hình bắt buộc phải bị chặn go-live, không quảng cáo chức năng không hoạt động.

## 5. Tiêu chí nghiệm thu theo domain

| ID | Điều kiện đạt có thể kiểm tra |
|---|---|
| AC-PUB-01 | Guest search/filter hai dòng; chỉ thấy publish; buy/quote/both CTA đúng contract; không giá giả |
| AC-CART-01 | Giỏ guest còn sau reload; cart account còn sau đăng nhập thiết bị khác; merge báo qty thay đổi |
| AC-CHECKOUT-01 | Nhấn lại/request retry cùng key chỉ tạo một đơn; đổi payload cùng key bị conflict; tiền tính server |
| AC-STOCK-01 | Hai checkout cạnh tranh đơn vị tồn cuối: tối đa một reservation thành công; release đúng một lần |
| AC-TRACK-01 | Biết code/email/phone đơn không đủ lấy chi tiết; token sai/expired và user khác bị từ chối; OTP limit |
| AC-CLAIM-01 | Claim guest order đòi xác minh; không claim được đơn đã thuộc user khác; token cũ mất tác dụng |
| AC-AUTH-01 | Verified email/password reset; session HttpOnly; không tin role body; rate limit/auth challenges expire |
| AC-ADDR-01 | Collection/page riêng; CRUD chỉ own; default unique khi cạnh tranh; geolocation bị từ chối vẫn nhập tay |
| AC-ORDER-01 | Customer xem timeline/snapshot riêng; staff update đúng transition và version; lý do cancel được audit |
| AC-PAY-01 | Webhook giả/chênh tiền không paid; callback browser không paid; webhook lặp không lặp event/stock |
| AC-PAY-02 | Thanh toán đến muộn sau hủy/hết reservation vào exception; không tự ship khi chưa có tồn |
| AC-REVIEW-01 | Đơn chưa giao/không thuộc mình/sản phẩm không trong đơn không review; unique/retry an toàn |
| AC-TICKET-01 | Có support/complaint/return; owner xem thread; staff reply; internal note không lộ; attachment có auth |
| AC-STAFF-01 | Dashboard riêng hiển thị pending/ticket assigned; API product/user/log/refund-admin trả 403 cho staff |
| AC-ADMIN-01 | Admin CRUD product và user; không tự khóa/hạ role; không xóa admin hoạt động cuối, kể cả race |
| AC-APPEAL-01 | Tài khoản khóa bị thu hồi phiên và thấy màn riêng sau xác minh; appeal không mở quyền mua/admin |
| AC-APPEAL-02 | Một pending/user; admin approve unlock và audit atomically; reject có lý do, notification |
| AC-NOTIFY-01 | Inbox/read/read-all chỉ owner; dedup event; email fail có retry và không làm mất đơn/lead |
| AC-CONTENT-01 | NFC URL hiện story publish responsive; draft/revoked không lộ; không biến URL thành chứng nhận giả |
| AC-CONTACT-01 | Gửi contact lưu lead và báo queued/sent/failed theo outbox; sent là SMTP accepted, không chứng minh inbox/đã đọc; lỗi SMTP không hiện “đã gửi email” |
| AC-AI-01 | Không key/quota/timeout báo unavailable và mở hỗ trợ; không lấy PII/order data bằng lời nhắc public |
| AC-AUDIT-01 | Admin lọc audit theo actor/action/resource/date; không token/secret; admin không sửa lịch sử |

Agent cần mapping từng AC tới test unit/integration/E2E thực tế. E2E mock kiểm tra render/form là lớp UI; chứng minh ownership, webhook, transaction và concurrency phải dùng backend tích hợp/DB test độc lập. Chưa chạy không được đánh dấu pass.

## 6. Evidence đã đọc từ hệ thống tham khảo

Repo tham khảo: `D:\WW\ha_thanh_vi_system`, đọc ngày 06/10/2026; chỉ đọc, không chạy hệ thống, không chỉnh sửa hoặc đọc secrets. Đường dẫn dưới đây là tương đối trong repo tham khảo. Đây là quan sát mã nguồn/test đã có, không chứng minh deployment hoạt động.

| Nguồn đã đọc | Quan sát trực tiếp | Dùng cho TRO & LAM |
|---|---|---|
| `README.md` | Liệt kê guest/customer/staff/admin, COD/payOS, SMTP/Gemini và sổ địa chỉ | Tham khảo phạm vi; không lấy giá, nội dung bánh hay credential |
| `backend/src/routes/customerRoutes.ts` | API auth/account/address/review/ticket/notification; staff dashboard/tickets; admin user/log/appeal | Tách quyền theo domain và server guard |
| `backend/src/routes/commerceRoutes.ts` | Checkout/tra đơn/hủy/payment public routes; staff/admin dùng admin/orders route | TRO dùng route theo role rõ; public route vẫn bắt buộc ownership |
| `backend/src/routes/adminProductRoutes.ts` | CRUD products, uploads JPEG/PNG/WebP giới hạn 5MB, thống kê | Admin catalog, không suy ra có inventory concurrency |
| `backend/src/models/customer.ts` | Users ba role; địa chỉ nhúng array users; reviews unique; ticket support/return | TRO tách `addresses`; thêm complaint và guest ticket; không tự đưa voucher vào scope |
| `backend/src/models/order.ts` | Snapshot items/customer; code/accessTokenHash/idempotencyKey; status/paymentStatus riêng | Snapshot và token giữ; chuẩn hóa reservation/payment records |
| `backend/src/constants/order.ts` | Transition order pending/confirmed/shipping/delivered/cancelled/return_requested/returned; payment riêng | Tách return request khỏi fulfillment để vẫn biết hàng đã giao |
| `backend/src/models/accountManagement.ts` | Appeal pending/approved/rejected, partial unique pending/user và audit account | Giữ appeal/audit với ownership riêng |
| `backend/src/controllers/commerceController.ts` | Tra/hủy/payment yêu cầu token hoặc session; checkout gửi mail; staff không refund; notification | Tham khảo controller boundary; TRO dùng outbox để không mất sự kiện |
| `backend/src/controllers/customerController.ts` (đoạn addresses/reviews/tickets) | Địa chỉ qua req.user; review assert; ticket phải gắn owned order; return sau delivered | TRO mở support không cần order; guest verified order hỗ trợ |
| `backend/src/services/customerRules.ts` | Review kiểm userId, delivered và item membership | Giữ điều kiện purchased review |
| `backend/src/services/customerAccountManagementService.ts` (đoạn update/review) | Không tự role/status; giữ admin cuối; tăng authVersion và xóa sessions; approve dùng transaction | Thêm test cạnh tranh admin cuối; không mặc định code nguồn đã xử lý mọi race |
| `backend/src/services/notificationService.ts` | User/role recipients, eventKey upsert; safe wrapper ghi lỗi rồi tiếp tục | Outbox + retry thay chỉ best-effort |
| `backend/src/services/commerceService.ts` (đoạn canAccess/token và tìm webhook amount) | Guest token hash timingSafeEqual; đơn có userId chỉ owner; đối chiếu webhook amount với total | Không dùng email-only claim; verify provider contract riêng |
| `tests/e2e/guest.spec.ts` | Test giỏ persistence/public routes và SMTP lỗi không báo success | Ý định UI phù hợp; chưa chạy ở lượt research |
| `tests/e2e/staff.spec.ts` (đoạn đầu) | Mock API cho update carrier/tracking/timeline và ticket reply | Không xem là chứng cứ backend/shipper thật |
| `tests/e2e/account-management.spec.ts` (đoạn đầu) | Mock API admin đổi role/status và approve appeal | Thêm tests backend ownership/session/transaction thực |
| `tests/e2e/notifications.spec.ts` (đoạn đầu) | Mock poll badge/toast/deep link | Tham khảo UX; không chứng minh delivery production |

Giới hạn research: không audit bảo mật toàn repo, không benchmark, không kết nối Atlas/payOS/SMTP/Gemini của hệ thống tham khảo. Chỉ những files và đoạn ghi rõ trên được sử dụng làm evidence. Các defaults, collection mới, guest claim, geolocation và stock reservation trong tài liệu này là đề xuất TRO & LAM, không gán cho nguồn tham khảo.
