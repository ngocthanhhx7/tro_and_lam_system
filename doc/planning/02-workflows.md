# TRO & LAM — Luồng nghiệp vụ và máy trạng thái

Ngày: 06/10/2026. Dùng AC/DEC trong `01-business-and-permissions.md`. Các enum và flow dưới đây là hợp đồng đề xuất TRO & LAM để các agent thống nhất; chưa phải chức năng đã triển khai. `04-data-model.md` là nguồn chuẩn cho collection/field/enum, `05-api-contracts.md` chuẩn DTO/API; thay đổi hợp đồng phải cập nhật đồng bộ trước code. Không nhân bản máy trạng thái tùy ý giữa frontend và backend.

## 1. Catalog, câu chuyện và lead quà tặng

1. Guest vào trang chủ, xem Lifestyle/Diplomacy, lọc loại/giá/khả dụng, tìm theo tên/slug/từ khóa. Chỉ sản phẩm `published` trả qua public API. Pagination/filter URL có thể chia sẻ; query có giới hạn/validation.
2. Product detail hiển thị gallery, kích thước/chất liệu/cách chăm sóc/hoa văn/câu chuyện NFC đã được duyệt, `saleMode=buy|quote|both`, giá nếu bán trực tiếp, tồn khả dụng có thể mua. Không công khai số tồn nhạy cảm nếu không cần.
3. `buy`: chọn SKU/product ID và qty, thêm giỏ. Bản đầu mỗi product có một SKU; lựa chọn mẫu/kích thước trên UI trỏ product ID độc lập, chưa có variant schema. `quote`: form tên/email/phone, công ty tùy chọn, số lượng, dịp tặng, ngân sách tùy chọn, deadline, nhu cầu cá nhân hóa. `both`: có cả hai CTA, mua chỉ khi giá/tồn hợp lệ. Lead xác nhận được lưu rồi nhân viên tiếp nhận; chưa sinh đơn trả tiền.
4. Staff phân công lead, ghi note nội bộ, gửi tư vấn/báo giá đã được admin cho phép. Bản đầu không tự chuyển báo giá thành order nếu chưa có hợp đồng giá/stock approved. Agent không bịa sản phẩm bespoke/hóa đơn/tích hợp shipping.
5. Admin draft/edit/preview/publish/archive content và product. Product đã có order bị archive thay xóa cứng. Direct bắt buộc price hợp lệ, SKU và cấu hình bán.

Contact/quote lead state: `new -> assigned -> contacted -> closed`; có thể reopen bằng staff/admin kèm lý do. Kết quả thành công/thất bại là outcome/ghi chú tùy chọn, không thêm enum qualified/closed_won/closed_lost ở baseline. Collection chuẩn `contacts`, quote là kind quote, không tạo quote collection hoặc tự convert thành order. AC-PUB-01, AC-CONTACT-01.

## 2. Đăng ký, đăng nhập và tài khoản bị khóa

Register nhập tên/email/password/confirm, consent cần thiết; server validate, hash password, role luôn customer bất kể body. Gửi OTP xác minh email, có expiry/cooldown/attempt limit. Login dùng session cookie HttpOnly/Secure/SameSite và CSRF cho mutation; quyền lấy từ DB/current session. Forgot password phản hồi không tiết lộ tồn tại email, token purpose-bound có expiry và dùng một lần. Reset/đổi role/khóa tăng authVersion, thu hồi phiên cũ; expiry kiểm tra runtime.

Admin thêm tài khoản staff/customer qua invite activation; không gửi mật khẩu plaintext bằng email, không làm lộ password hash. Tạo admin đầu tiên qua script vận hành an toàn, không public register admin. Đổi email cần tái xác minh; không làm user chiếm email người khác. Rate limit theo IP và identity đã hash phù hợp; account challenge không dùng token chung cho mọi mục đích.

Blocked flow:

1. Admin chọn khóa + lý do bắt buộc. Server lưu audit, status blocked và revoke sessions; kiểm tra không khóa/hạ role admin hoạt động cuối hoặc chính actor. Enum TRO là active/blocked, không dùng suspended từ nguồn tham khảo.
2. Session cũ không được hoạt động như account active. Người dùng xác minh danh tính (password/OTP theo policy) nhận restricted appeal session; frontend vào `/tai-khoan/bi-khoa` riêng, xem lý do phù hợp, thông tin liên hệ và form kháng nghị.
3. Appeal credential chỉ `appeal:submit/appeal:status`, không cấp cart account/API customer/staff/admin; guest public browsing vẫn có thể dùng. Không dùng status khóa để tự hủy/giữ tiền của đơn đã đặt.
4. Submit message có giới hạn, rate limit, một pending/user. Admin xem nội dung và evidence, approve/reject với ghi chú; transaction cập nhật appeal/user/audit/outbox. Approve mở tài khoản, yêu cầu login lại. Reject giữ blocked, gửi lý do phù hợp và quy tắc gửi lại sau cooldown cấu hình.
5. Khi blocked customer cần hỗ trợ đơn tồn tại, dùng kênh contact hoặc verified guest-style support credential scope theo đơn; không cấp lại toàn bộ account scope qua order token.

AC-AUTH-01, AC-ADMIN-01, AC-APPEAL-01/02. Test race hai admin cùng hạ admin khác phải vẫn giữ tối thiểu một active admin; thao tác count-then-update không đủ nếu không serialize invariant.

## 3. Địa chỉ riêng và định vị

Trang `/tai-khoan/dia-chi` list/add/edit/delete/set default, collection `addresses`. DTO chuẩn: `recipientName`, `phone`, `line1`, `line2?`, `ward?`, `province?`, `countryCode`, `formattedAddress`, `location?`; cùng `label?`, `postalCode?`, `isDefault`, `version` theo hợp đồng 04/05. Server bổ sung userId/timestamps; location gồm lat/lng/accuracyMeters/capturedAt/source theo schema, không tạo alias recipientPhone/addressLine/coordinates mới. Các trường đơn vị hành chính xác nhận theo dataset hiện hành, không giả giá trị khi provider lỗi.

Không hardcode cấu trúc tỉnh/huyện cũ; dataset hành chính/version nhà cung cấp phải được agent nghiên cứu nguồn chính thức trước triển khai. Nếu chưa có dataset dùng input địa chỉ linh hoạt + validation cần thiết, không bịa danh sách.

1. Nhấn “Dùng vị trí hiện tại” mới gọi geolocation qua HTTPS; giải thích mục đích, không tracking ngầm.
2. Khi được cấp quyền, lấy lat/lng/accuracy; reverse geocode qua adapter/provider đã cấu hình; có timeout/quota/error rõ. Không gửi tọa độ cho Gemini để đoán địa chỉ.
3. Autofill là gợi ý: người dùng xác nhận số nhà, tên người nhận, phone, đơn vị hành chính/chi tiết trước save. GPS không đảm bảo đúng căn hộ/số nhà. Nếu từ chối, browser không hỗ trợ hoặc provider lỗi, nhập tay vẫn hoạt động.
4. Set default transaction đảm bảo tối đa một địa chỉ mặc định; lúc xóa default cho chọn thay thế hoặc bỏ default có chủ ý, không để nhiều default. Query update/delete kết hợp userId từ session.
5. Checkout copy snapshot address đã chọn. User đổi/xóa địa chỉ không sửa đơn đang giao. Guest nhập địa chỉ ngay checkout; không tạo address của tài khoản không sở hữu.

Không yêu cầu quyền định vị để mua. Không lưu tọa độ nếu không cần/không consent; không log raw GPS. AC-ADDR-01.

## 4. Giỏ và checkout có thể retry

Guest cart server, nhận diện bằng cookie opaque HttpOnly/Secure token lưu hash, expiry và CSRF protection. Local cache product ID/SKU/qty chỉ tùy chọn, không là nguồn quyền hoặc giá. Customer cart server và revision, render từ catalog hiện tại. Login merge atomic cộng qty cho cùng SKU, clamp theo max purchase/availability và báo người dùng mọi điều chỉnh; không âm thầm xóa item. Khi logout dọn cache PII/account cart; guest cart mới không mang dữ liệu riêng của user trước. Mọi active authenticated role đều có capability mua cá nhân như customer; role vận hành không bypass ownership.

Checkout:

1. Client lấy quote server từ product ID/SKU/qty + destination + paymentMethod. Server kiểm published, saleMode buy/both, price/SKU, qty, tồn, fee, currency. Client không được quyết định subtotal/discount/shippingFee/paid.
2. Cho xác nhận người nhận, địa chỉ, email/phone, note, phương thức, điều khoản đã publish. Có loading/failure/retry. Nếu giá/availability thay đổi, trả conflict và yêu cầu xác nhận quote mới.
3. Client tạo Idempotency-Key cho một ý định đặt hàng; server scope key theo user hoặc guest checkout session. Cùng key + cùng normalized payload trả cùng kết quả; cùng key payload khác trả 409. Key không được cho attacker lấy đơn người khác; tra replay vẫn kiểm principal/session/token tương ứng.
4. Transaction tạo order snapshot + stock reservation + payment pending/outbox. Nếu đơn/lưu stock thất bại, rollback toàn bộ. Guest nhận order code và secure order credential tại confirmation; email outbox gửi link an toàn theo policy. Token phải random đủ entropy, chỉ lưu hash, có expiry/scope/revoke; không đưa vào log/query string/analytics/referrer. Nếu dùng URL fragment, client bóc token, gửi header và xóa khỏi URL; CSP và third-party scripts hạn chế.
5. COD tạo pending; payOS khởi tạo link bên ngoài DB transaction bằng saga. Nếu create link timeout, order/payment tồn tại với trạng thái rõ và job query/retry; không tạo đơn thứ hai. Không giữ DB transaction mở khi gọi mạng.
6. Cart chỉ remove items đã commit thành công; không xóa cart khi SMTP/payment link lỗi. Confirmation phân biệt “đơn được tiếp nhận”, “chờ thanh toán”, “thanh toán xác minh”.

AC-CART-01, AC-CHECKOUT-01, AC-STOCK-01.

## 5. Tồn kho, reservation và xử lý chậm

Inventory `onHand >= reserved >= 0`. Reservation enum `held|committed|released`; chuyển `held -> committed|released` đúng một lần bằng version/conditional update. `expiresAt` là metadata, không có enum expired. Job xác minh hết thời hạn rồi chuyển held -> released cùng cập nhật reserved trong transaction. Mongo TTL chỉ dọn dữ liệu, không được dùng làm cơ chế tự release tồn.

- Checkout giữ tồn bằng atomic condition `available >= qty`; cập nhật nhiều SKU trong transaction MongoDB replica set (Atlas). Rollback nếu bất kỳ SKU thiếu.
- PayOS reservation TTL đề xuất 15 phút, gắn thời hạn payment link. COD pending không tự expire bản đầu; cảnh báo staff khi quá thời gian chờ cấu hình để xác minh/hủy thủ công. Checkout rate limit theo principal/IP và giới hạn số pending orders/quantity chống chiếm tồn; mọi thay đổi policy COD TTL sau này phải bổ sung acceptance/test.
- Payment accepted đúng thời hạn: giữ reservation held và bảo vệ khỏi expire; không trừ onHand lúc paid. Đến bước xuất kho `shipped`, transaction giảm onHand và reserved cùng lượng rồi reservation held -> committed, đúng một lần. COD confirmed cũng bảo vệ reservation đến xuất kho. Không vừa confirmed vừa shipped trừ tồn.
- Cancel trước xuất kho release một lần. Hàng return chỉ tăng onHand sau staff/admin kiểm hàng thực tế và quyết định có thể tái bán; không cộng tồn ngay customer gửi request.
- Hết reservation và late payment: ghi payment verified cùng exception `late_payment_stock_review`, ngừng auto-confirm; admin/staff kiểm tồn để re-reserve hoặc refund. Không nói đã thanh toán thất bại khi tiền thực sự đã vào.
- Reservation release và payment webhook chạy đồng thời phải serialize trên order/reservation version và đảm bảo không oversell/lost payment.

## 6. Đơn và thanh toán là hai máy trạng thái

Fulfillment đơn:

| Từ | Sang | Ai / điều kiện |
|---|---|---|
| `pending` | `confirmed` | Staff/admin; COD hợp lệ hoặc online paid verified, reservation còn hợp lệ |
| `pending` | `cancelled` | Owner theo policy hoặc staff/admin; release tồn; paid thì tạo refund case |
| `confirmed` | `processing` | Staff/admin bắt đầu chuẩn bị |
| `confirmed` | `cancelled` | Staff/admin theo policy + lý do, chưa xuất kho; không sửa payment paid thành pending |
| `processing` | `shipped` | Staff/admin; có carrier/tracking hoặc lý do giao thủ công; tồn xuất đúng một lần |
| `processing` | `cancelled` | Staff/admin trước giao hãng, điều kiện đặt riêng/custom tuân policy |
| `shipped` | `delivered` | Staff/admin chứng cứ giao; integration vận chuyển chỉ khi đã cấu hình |
| `shipped` | `return_requested` | Hàng giao thất bại cần quay về, staff/admin có chứng cứ; case giữ nguyên delivery facts |
| `delivered` | `return_requested` | Owner gửi return case hợp lệ; không tự hứa chấp thuận/hoàn tiền |
| `return_requested` | `returned` | Return case approved và hàng thực nhận; inspection tồn riêng |

Enum hợp đồng order: `pending|confirmed|processing|shipped|delivered|cancelled|return_requested|returned`. `return_requested` là trạng thái tương thích trong aggregate order; return case riêng giữ lifecycle chi tiết, `previousFulfillmentStatus` và `deliveredAt` không bị mất. Case rejected/withdrawn trả projection về previousFulfillmentStatus bằng transition đặc biệt có audit, không cho PATCH status tùy ý. Giao thất bại ghi shipping event/exception trong shipped, không thêm enum delivery_failed khi contract chưa cập nhật. Terminal `cancelled/returned` không tự revert. Admin sửa nhầm qua nghiệp vụ correction có audit riêng. MVP chỉ full return/refund; partial items/partial refund là phạm vi mở rộng có feature flag và data contract trước triển khai.

Payment:

| Từ | Sang | Điều kiện |
|---|---|---|
| Khởi tạo | `pending` | COD chờ thu hoặc online payment attempt chờ xác minh; không có enum unpaid |
| `pending` | `paid` | COD đã thu, staff/admin ghi chứng cứ và thời gian; đơn delivered không tự đồng nghĩa đã thu |
| `pending` | `paid` | Webhook/query payOS từ server đã verify signature/order/amount/currency |
| `pending` | `failed` hoặc `expired` | Provider/query/job xác minh; chưa có tiền |
| `pending` | `cancelled` | Attempt/link đã hủy được xác minh, chưa có tiền; không suy ra order đã hủy |
| `failed/expired` | `pending` | Attempt mới được phép, stock còn hợp lệ; không reuse attempt đã đóng sai cách |
| `failed/expired` | `paid` | Có payment đến muộn verified; đánh exception khi order không đáp ứng |
| `paid` | `refund_pending` | Admin phê duyệt refund case, chưa phải tiền đã hoàn |
| `refund_pending` | `refunded` | Có provider confirmation hoặc chứng cứ chuyển hoàn đã xác minh |
| `refund_pending` | `partially_refunded` | Dành cho extension partial refund, bị khóa bằng feature flag bản đầu |

Giữ payment attempts/events riêng; order payment aggregate không mất lịch sử thất bại trước đó. Refund case đang xử lý mới để aggregate refund_pending. Khi case failed/rejected, giữ failure reason/evidence và khôi phục aggregate paid hoặc partially_refunded theo ledger thực tế; không giữ refund_pending vô hạn, không báo refunded. Retry tạo/cập nhật case có idempotency, không thực thi lại khoản đã hoàn. COD/payOS không phải actor. Admin không được manually đặt payOS paid chỉ vì ảnh chụp khách gửi; đưa vào manual review rồi xác minh đối soát server/provider.

Enum payment contract: `pending|paid|failed|expired|cancelled|refund_pending|refunded|partially_refunded`; partial refund chưa mở mặc định. Attempt cancelled vẫn có thể nhận thanh toán đến muộn verified và vào exception, không bỏ qua tiền thật. Frontend callback `/thanh-toan/ket-qua` chỉ polling server và hiện pending/verified/failure; tham số URL `success=true` không cập nhật DB. Webhook duplicate/out-of-order không hạ paid về pending, không lặp stock/email; signature invalid hoặc amount không khớp trả xử lý từ chối theo provider contract và log an toàn. Mặc định không gọi refund payOS tự động: admin ghi hoàn ngoài hệ thống đã xác minh và audit, staff chỉ đề xuất; không fake endpoint.

Staff dashboard: queue pending, processing, giao thất bại, ticket chưa tiếp nhận, assigned-to-me, thời gian chờ; filter/date/pagination; không gọi tổng số đơn là doanh thu. Admin revenue tách đơn đặt, tiền thực thu, hoàn tiền, số dư net; dùng payment events và timezone VN. AC-ORDER-01, AC-PAY-01/02, AC-STAFF-01.

## 7. Tra đơn guest và claim tài khoản

Màn `/tra-cuu-don-hang` nhận code + yêu cầu xác minh. Code không phải mật khẩu; response ban đầu không lộ tên/email/địa chỉ/giá trị đơn hoặc account existence. Có secure token trong confirmation link hoặc gửi OTP đến email lưu trong đơn. Không gửi OTP đến email do client tự thay. Limit IP/order/identity; cooldown, expiry, số lần sai; đáp ứng chung chống dò đơn.

Sau token/OTP hợp lệ cấp scoped order session hiển thị đầy đủ items, người nhận, tiền, trạng thái, timeline, payment method, shipping/tracking, cancellation/return/support theo quyền. Staff nội bộ note/PII của người khác không xuất. Order session hết hạn có flow xác minh lại. Trường hợp mất email và token liên hệ hỗ trợ xác minh thủ công, không bypass bằng phone/code đơn.

Claim: customer verified đăng nhập, chọn liên kết đơn guest, chứng minh quyền đơn bằng credential hợp lệ và chính sách email ownership; compare-and-set userId chưa có, revoke guest token, audit/outbox. Nếu đã claimed cùng user trả idempotent; nếu user khác từ chối chung. Customer chỉ xem orders userId của mình, không query tất cả email trùng. AC-TRACK-01, AC-CLAIM-01.

## 8. Đánh giá, hỗ trợ, khiếu nại và đổi trả

Review: customer chọn delivered order và item, 1–5 sao/comment/ảnh optional với moderation. Backend kiểm order.userId và item membership; unique một record/user/order/product. Review không tự được tạo bởi staff; admin có thể hide spam/PII với reason/audit, không sửa sao tích cực thay khách. Public chỉ author display đã bảo vệ PII, không email/phone/order token. Guest muốn review được hướng dẫn login/claim; không đánh giá chỉ nhờ biết code. Không mặc định thưởng voucher từ repo nguồn.

Ticket kind `support|complaint|return`. Support/complaint có thể không gắn đơn; nếu có phải owner hoặc guest order credential. Return yêu cầu delivered, trong window policy cấu hình, lý do/items/ảnh chứng cứ; ngoài window vẫn cho complaint, không tự hứa refund. Guest verified order có thể gửi ticket qua scoped order session; guest không có order dùng contact.

Support state `open -> assigned -> in_progress -> waiting_customer -> resolved -> closed`; waiting_customer có thể quay in_progress, owner có thể reply/reopen theo window cấu hình. Phân công bằng CAS để hai staff không cùng claim; staff/admin nhắn public hoặc internal note tách rõ. Notification đến owner và staff được phân công; không broadcast nội dung riêng cho mọi customer.

Return collection `return_requests`, enum baseline `requested|approved|rejected|received|closed`: requested -> approved hoặc rejected; approved -> received; received -> closed sau inspection/xử lý liên quan. “Đang xem xét”, “chờ khách gửi”, “đã kiểm hàng” là giai đoạn diễn giải/timeline, không thêm enum under_review/awaiting_return/inspected/completed. Rejected là terminal case với lý do; complaint có thể tiếp tục. Approved không tự refunded; hàng received có inspectionEvidence, tình trạng tái bán và hành động stock; admin quyết định refund case riêng. Baseline full return/full refund; schema items/amount mở đường cho tương lai nhưng partial/replacement tắt bằng feature flag và UI không giả hỗ trợ.

Upload giới hạn count/size/type, xác minh MIME/bytes, sanitize tên, signed/auth download, không executable; không expose file riêng bằng public static directory. AC-REVIEW-01, AC-TICKET-01.

## 9. Thông báo, email và contact

Outbox trong cùng transaction nghiệp vụ; worker retry có backoff/dead-letter và eventKey dedup. Inbox DB là thông báo user; SMTP chỉ delivery adapter. Đơn commit rồi SMTP fail vẫn là đơn thật, UI không retry tạo đơn mới. Lead đã lưu nhưng email chưa gửi phải hiện “đã tiếp nhận, đang chờ chuyển thông tin”, không “email đã gửi” giả.

| Sự kiện | Người nhận | Kênh / liên kết |
|---|---|---|
| Order created | Customer hoặc email guest; staff/admin vận hành | Inbox + email xác nhận; guest dùng secure link |
| Order/shipping/payment cập nhật | Owner, staff phụ trách khi exception | Inbox/email; deep link kiểm quyền lại |
| Ticket mới/reply/status | Owner và staff phụ trách | Inbox + email cần thiết; không gửi note nội bộ |
| Khóa/đổi role/appeal decision | User liên quan, admin khi appeal pending | Email và restricted appeal status; sessions revoke |
| Lead/contact mới | Nhân viên phụ trách/admin | Inbox; email nội bộ từ địa chỉ shop |
| Integration/reconciliation failure | Admin | Inbox/cảnh báo vận hành, che PII/secrets |

Inbox phân trang/filter read/unread, read-one/read-all owner only; click không cấp quyền resource. Polling bản đầu 30–60 giây khi tab visible, pause tab hidden, refresh focus; retries có backoff. Không cho notification HTML không sanitize hoặc URL ngoài origin tùy ý.

Contact form guest/customer: tên/email/phone tùy policy/message/consent, honeypot/rate limit; sanitize header, email người gửi chỉ Reply-To được validate, không From tự do. Persist lead/outbox trước acknowledgment; trả 202 queued là đã tiếp nhận, không phải SMTP delivered. Notification/email marketing tách consent khỏi transactional email. Không ghi OTP/password vào email nội bộ/log. AC-NOTIFY-01, AC-CONTACT-01.

## 10. Gemini và NFC

Gemini trả lời từ catalog và story public đã publish; không dùng toàn bộ database/user/orders/system logs làm context. User cần tra đơn chuyển sang UI xác thực, không đưa PII vào prompt công khai. API key chỉ backend; model tên cấu hình phải được kiểm tra provider hiện hành, không hứa model availability. Timeout/quota/unconfigured trả unavailable cụ thể, fallback contact hoặc ticket/handoff; không báo gọi AI thành công khi chưa gọi được. Nội dung AI là tư vấn, không tự đổi giá/tồn/đơn/refund hoặc tạo chứng nhận văn hóa.

NFC tag trỏ URL story đã publish ổn định, có mã tag opaque, trạng thái active/revoked/replaced, xử lý 404 rõ. Có thể kể hoa văn/nghệ nhân/quy trình đã có nguồn; quyền truy cập là public, không phải auth của đơn. Chức năng chứng nhận hàng thật/serial từng hiện vật nếu cần phải thiết kế issuance, chống clone và quản lý thay tag riêng; URL NFC đơn thuần không chứng minh tính xác thực. AC-AI-01, AC-CONTENT-01.

## 11. Kịch bản lỗi và bàn giao bắt buộc

- DB unavailable: mutation 503, không “đặt thành công”; public cache nội dung chỉ khi công bố rõ và an toàn.
- Catalog đổi giá/tồn sau quote: 409 + quote mới, giữ form/cart, không tự thu tiền mức mới.
- Provider timeout: aggregate pending cùng exception unknown + reconciliation, không suy ra failed/paid; không lặp tạo link/thu tiền.
- Hai staff cập nhật: optimistic version 409, UI tải lại, không lost update.
- Token/OTP expired: xác minh lại, không đoán quyền qua code/email/phone.
- Locked user/role changed: sessions revoked, tab hiện lý do phù hợp, mọi API guard kiểm lại.
- Geolocation/SMTP/Gemini thiếu cấu hình: fallback nhập tay/liên hệ/trạng thái thật; tests tách mock và real.
- Refund/return stock: giữ evidence, version/audit, mỗi movement chỉ thực hiện một lần.

Agent bàn giao phải có test ownership từng resource, phép/không phép RBAC, state transition sai, idempotency payload conflict, race stock/admin cuối, payOS signature/amount/duplicate/late, SMTP retry, token claim/revoke, guest privacy và geolocation fallback. Ghi rõ tests chạy thực tế, test mock, chưa chạy, dependency missing và go-live blockers. Không gọi việc đọc source hoặc E2E mock là đã xác minh tích hợp production. Nguồn tham khảo và giới hạn evidence được liệt kê đầy đủ trong `01-business-and-permissions.md` mục 6.
