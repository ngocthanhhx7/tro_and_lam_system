# Mô hình dữ liệu và bất biến nghiệp vụ TRO & LAM

Ngày lập: 06/10/2026. Trạng thái: **thiết kế đề xuất để triển khai**, không phải mô tả tính năng đã có. MongoDB Atlas + Mongoose, JavaScript ESM theo scaffold. Không sao chép dữ liệu khách hàng, tài khoản hoặc secret từ dự án tham khảo.

## 1. Bằng chứng và khác biệt với hiện trạng

| Nguồn đã đọc | Điều học được | Quyết định TRO & LAM |
| --- | --- | --- |
| `backend/src/app.js`, `constants/http.js` trong TRO | Express, `/api/v1`, health, CORS, rate limit, JSON 100kb | Giữ prefix và health; bổ sung module theo lớp hiện có |
| `D:/WW/ha_thanh_vi_system/backend/src/models/customer.ts` | Users, session, review, ticket; địa chỉ nhúng trong user | Address là collection riêng đúng yêu cầu; ticket message tách để phân trang |
| `.../models/order.ts`, `constants/order.ts`, `services/orderRepository.ts` | Order snapshot, hash token, idempotency, shipping events, lọc hàng đợi | Áp dụng snapshot và truy cập có chứng minh; bổ sung reservation, version, payment attempt/event, state `processing`, `shipped` |
| `.../models/accountManagement.ts` | Appeal pending duy nhất/user, audit account | Giữ một appeal pending; token kháng nghị chỉ có phạm vi hạn chế |
| `.../models/operations.ts` | Notification có eventKey unique/user, system audit | Dedupe event, outbox bền vững, audit append-only |
| `.../models/content.ts` | Site content Mixed và contact | Tách product/category/story/page có schema và version, tránh một document Mixed cho toàn site |
| `.../services/payOsService.ts`, `utils/paymentSignatures.ts` | Adapter PayOS, timeout, xác minh chữ ký và giá trị giao dịch | Đây là tham khảo local, **không chứng minh API PayOS hiện hành**; agent tích hợp phải đối chiếu tài liệu chính thức trước code |

Scaffold TRO hiện chưa có các collection bên dưới, auth, commerce hay worker. Mọi schema, index và chính sách bên dưới là quyết định đề xuất v1 để agent làm việc đồng nhất.

## 2. Quy ước chung

- `_id` là ObjectId; DTO trả `id` string, không lộ field internal. Foreign key dùng ObjectId thống nhất, không trộn string và ObjectId.
- `createdAt`, `updatedAt` UTC; hiển thị và tổng hợp ngày theo `Asia/Ho_Chi_Minh`. Money là số nguyên VND không âm, kiểm tra safe integer, currency cố định `VND`.
- `version` tăng qua conditional update; mutation nhạy cảm nhận `expectedVersion`. Không nhận query Mongo/operator trực tiếp từ client; validators allowlist field.
- Các model độc lập trong `backend/src/models/<domain>/`; controller/service/routes/validators có folder domain tương ứng. Không tạo thêm một cấu trúc monolith cạnh cấu trúc đã duyệt.
- Chỉ `active` user có session nghiệp vụ; `customer`, `staff`, `admin` là role. Guest là context ẩn danh, không có user giả. SMTP, PayOS, Gemini và geocoder là adapter bên ngoài.
- Soft delete sản phẩm/tài khoản có liên kết lịch sử; order/payment/audit không xóa bằng CRUD. Chính sách lưu trữ/anonymize dữ liệu cần chủ dự án duyệt trước production, không tự xóa chứng cứ tài chính.

## 3. Danh mục collection và quyền sở hữu

`?` = optional; mọi string có max length; enum và điều kiện bắt buộc phải được thực thi ở validator và service.

| Collection / package sở hữu | Các field chính | Index và bất biến |
| --- | --- | --- |
| `users` / P02 | name, emailNormalized, phone?, passwordHash, role, status `active/blocked`, emailVerifiedAt?, authVersion, blockedReason?, blockedAt?, blockedBy?, version | unique emailNormalized; `{role,status,createdAt}`. Register luôn customer. Admin không được khóa/hạ role admin cuối cùng; không tự khóa chính mình |
| `sessions` / P02 | userId, tokenHash, authVersion, expiresAt, revokedAt?, lastSeenAt | unique tokenHash; TTL expiresAt; mỗi request kiểm tra expiresAt, user status và authVersion, không dựa vào TTL để auth |
| `restricted_proofs` / P02 (P05 gọi issuance port) | purpose `appeal_access/guest_order_access`, scopes[], userId? hoặc orderId, tokenHash, expiresAt, revokedAt?, issuedAt, identityVerifiedAt, authVersion? | unique tokenHash; TTL expiresAt; exactly một target theo purpose. Appeal phải blocked user đã chứng minh identity; guest order chỉ đúng orderId. Middleware full-session **không chấp nhận proof collection này**; middleware restricted kiểm expiry/revoked/purpose/scope/target mỗi request |
| `auth_challenges` / P02 | purpose `verify_email/reset_password/appeal_access/guest_order_access/invite_user`, userId?, orderId?, invitedRole?, tokenHash, expiresAt, consumedAt?, attempts | unique tokenHash, TTL expiresAt; single use, không lưu mật khẩu/OTP thô; invitedRole chỉ admin server ghi, không nhận role từ form accept invitation |
| `account_appeals` / P02 | userId, message, status `pending/approved/rejected`, reviewedBy?, reviewNote?, reviewedAt?, version | unique `{userId}` partial `{status:'pending'}`; `{status,createdAt}`; approve đồng thời unlock+audit+authVersion, không phát lại session cũ |
| `addresses` / P03 | userId, label?, recipientName, phone, line1, line2?, ward?, province?, countryCode `VN`, postalCode?, formattedAddress, location? `{lat,lng,accuracyMeters,capturedAt,source}`, isDefault, version | `{userId,createdAt}`; unique userId partial isDefault:true. Tối đa 20 địa chỉ/user đề xuất; update default trong transaction; chọn default mới khi xóa default |
| `categories` / P04 | slug, name, description?, parentId?, sortOrder, status `draft/published/archived` | unique slug; parent không được tạo vòng; public chỉ published |
| `products` / P04 | slug, sku, name, line `lifestyle/diplomacy`, categoryId, description, material, dimensions?, careInstructions?, images[{url,alt,sortOrder}], storyId?, saleMode `buy/quote/both`, priceVnd?, status `draft/published/archived`, featured, version | unique slug, sku; `{status,line,categoryId,priceVnd}`; text index name+description. buy/both bắt buộc priceVnd>0; quote không checkout, mở form tư vấn; lựa chọn pricing cụ thể cần chủ dự án xác nhận |
| `inventory` / P05 | productId, onHand, reserved, version | unique productId; `onHand>=reserved>=0`, available=onHand-reserved. P04 chỉ gọi inventory port; không tự ghi stock từ product controller |
| `stock_reservations` / P05 | orderId, items[{productId,quantity}], status `held/committed/released`, expiresAt?, releaseReason?, version | unique orderId; `{status,expiresAt}`; expiresAt chỉ cho PayOS chưa paid. **Không dùng TTL để xóa reservation** trước bù stock |
| `inventory_movements` / P05 | productId, orderId?, eventKey, kind `restock/reserve/release/ship/return/adjust`, onHandDelta, reservedDelta, actorId?, reason | unique eventKey; `{productId,createdAt}`; append-only cùng transaction stock |
| `carts` / P03 | userId? hoặc guestTokenHash, items[{productId,quantity}], version, expiresAt | unique userId partial ObjectId; unique guestTokenHash partial string; TTL expiresAt. Chính xác một chủ sở hữu; client không quyết định giá; cart không giữ stock |
| `orders` / P05 | code, userId?, guestAccessTokenHash?, recipientSnapshot, itemsSnapshot[{productId,sku,name,imageUrl?,quantity,unitPriceVnd}], subtotalVnd, shippingFeeVnd, discountVnd, totalVnd, status, paymentMethod `cod/payos`, paymentStatus, paidAmountVnd, refundedAmountVnd, reservationId, shipping?, note?, statusHistory, version | unique code; `{userId,createdAt}`, `{status,paymentStatus,createdAt}`; totals tính server. Địa chỉ, tên, giá snapshot không đổi khi Address/Product đổi |
| `cod_collections` / P05 | orderId, amountVnd, evidenceReference, idempotencyKey, recordedBy, recordedAt | unique orderId and idempotencyKey; append-only successful full-balance COD collection committed atomically with Order payment ledger; one collection per order |
| `idempotency_records` / P05 | scope, actorKey, keyHash, payloadHash, state `processing/succeeded`, resourceId?, responseStatus?, safeResponse?, expiresAt | unique `{scope,actorKey,keyHash}`; TTL expiresAt chỉ theo policy retention (đề xuất 7 ngày), orderCode luôn unique vĩnh viễn; không lưu guest raw token trong response cache |
| `payment_attempts` / P06 | orderId, provider `payos`, providerOrderCode, paymentLinkId?, status, amountVnd, checkoutUrl?, expiresAt, requestKey, version | unique providerOrderCode; unique `{orderId,requestKey}`; paymentLinkId unique partial string; chỉ một active attempt/order qua partial unique active:true (field `active`) |
| `payment_events` / P06 | provider, dedupeKey, attemptId?, payloadDigest, receivedAt, verifiedAt, processingState `received/applied/review/rejected`, amountVnd?, reasonCode? | unique `{provider,dedupeKey}`; event không đủ provider event id thì dedupe theo reference canonical đã xác minh; không dedupe bằng toàn JSON chưa chuẩn hóa |
| `refunds` / P06 | orderId, paymentAttemptId?, amountVnd, status `requested/approved/rejected/processing/completed/failed`, reason, requestedBy, approvedBy?, externalReference?, version | unique externalReference partial string; tổng completed+in-flight refund không vượt paidAmount; staff chỉ tạo requested, admin duyệt; kết quả hoàn tiền cần chứng cứ |
| `return_requests` / P07 | orderId, ticketId, userId?, items[{productId,quantity,reason,receivedQuantity?,resellableQuantity?}], status `requested/approved/rejected/received/closed`, previousFulfillmentStatus, reviewedBy?, inspectionEvidence?, version | một active request/order qua partial unique `{orderId}` với `active:true`; trả hàng và refund là hai tài nguyên riêng; inventory effect gọi P05 port, không tự ghi inventory |
| `reviews` / P07 | userId, orderId, productId, rating 1..5, comment, images?, moderationStatus `pending/published/hidden`, moderatedBy?, moderationReason?, version | unique `{userId,orderId,productId}`; `{productId,moderationStatus,createdAt}`; chỉ người mua của order delivered, item có trong order; public ẩn email/phone |
| `tickets` / P07 | code, userId? hoặc guestAccessHash?, orderId?, kind `support/complaint/return`, subject, status `open/assigned/in_progress/waiting_customer/resolved/closed`, priority, assignedTo?, version | unique code; `{assignedTo,status,updatedAt}`, `{userId,createdAt}`; guest có order proof; admin/staff nhận/giải quyết; private internal note không trả cho khách |
| `ticket_messages` / P07 | ticketId, authorId?, authorRole `customer/staff/admin/guest`, visibility `customer/internal`, body, attachmentIds?, createdAt | `{ticketId,createdAt,_id}`; customer/guest không được đặt internal; append-only, attachment qua allowlist/storage |
| `contacts` / P07 | name, email, phone?, kind `general/corporate/quote`, productId?, quantity?, company?, message, consentAt, status `new/assigned/contacted/closed`, assignedTo? | `{status,createdAt}`; persist trước enqueue SMTP, không gửi mail đến recipient tùy ý do client nhập |
| `stories` / P08 | slug, title, productIds, origin, artisan?, motifs, sections, media, locale `vi/en`, status `draft/published/archived`, publishedAt?, version | unique `{slug,locale}`; chỉ nội dung đã biên tập và published public; Gemini draft không tự publish |
| `pages` / P08 | slug, title, blocks, locale, status, version | unique `{slug,locale}`; blocks theo schema allowlist, sanitize rich text |
| `nfc_tags` / P08 | publicId, productId?, storyId, status `active/revoked`, createdBy, version | unique publicId ngẫu nhiên; không chứa secret, PII hay quyền auth. NFC mở HTTPS `/nfc/:publicId`; public đọc story đã publish; tag bị revoke trả 410 |
| `notifications` / P09 | userId, eventKey, category `order/support/account/system`, title, body, href, readAt? | unique `{userId,eventKey}`; `{userId,createdAt}`, `{userId,readAt,createdAt}`; href là internal route allowlist; guest nhận mail, không có inbox user |
| `outbox_events` / P09 | eventKey, type, aggregateType, aggregateId, aggregateVersion, payload, state `pending/processing/sent/failed`, attempts, nextAttemptAt, leaseUntil?, lockedBy? | unique eventKey; `{state,nextAttemptAt}`; lease atomic, retry backoff, dead-letter sau 5 lần retry với jitter (delay 1m/5m/15m/1h/6h); notification/mail at-least-once nên consumer dedupe |
| `audit_logs` / P09 | actorId?, actorRole?, requestId, action, targetType, targetId?, outcome, reasonCode?, changesRedacted?, createdAt | `{createdAt}`, `{actorId,createdAt}`, `{targetType,targetId,createdAt}`, requestId; append-only; admin chỉ GET; redact password/token/payment signature/email content |
| `ai_conversations` / P10 | ownerUserId? hoặc guestHash?, messagesRedacted, expiresAt, consentAt? | TTL theo policy đề xuất 30 ngày và purge path; không đưa PII/secret/đơn của người khác vào Gemini |

### Các collection bổ sung để khớp các trang/API

| Collection / owner | Field và indexes | Rules |
| --- | --- | --- |
| `attachments` / P07 | storageKey private, uploadedByUserId? hoặc guestOrderId, purpose `ticket/refund/review`, orderId?, ticketId?, reviewId?, mimeType, bytes, hash, state `pending_upload/ready/rejected/linked`, visibility `customer/internal`, publicDerivativeUrl?, consentToPublishAt?, expiresAt?, version; index owner+createdAt, unique storageKey | Owner/context xác minh trước tạo/download; staff/internal ACL riêng. Magic byte/size kiểm khi finalize. Không public original. Review images chỉ công bố derivative sanitized sau consent+moderation; ảnh chưa duyệt không public |
| `media_assets` / P04 | storageKey, publicUrl, mimeType, bytes, alt, createdBy, status, version; unique storageKey | Admin catalog/CMS public media; không dùng collection này để lưu evidence/private ticket của customer |
| `settings` / P09 | key unique, values schema allowlist, version, updatedBy, updatedAt | Chỉ admin chỉnh business settings shipping zones/fees, COD enabled, checkout limits, support windows; không chứa/edit SMTP/PayOS/Gemini secrets, worker executable hay provider arbitrary URLs |

User archive nếu triển khai phải thêm archivedAt và từ chối login/session khi archived; status vẫn active/blocked.
Baseline UI quản lý user theo yêu cầu không có nút hard-delete. Admin invitation dùng auth_challenges purpose
`invite_user` khi P02 triển khai invitation, token purpose-scoped và single-use như reset; không gửi password.
Guest AI handoff chưa có order dùng ContactRequest, không ticket thread với credential chưa định nghĩa.
Guest ticket đã có order dùng restricted_proofs purpose guest_order_access có orderId match ticket.orderId;
không tạo loại “guest ticket proof” riêng. Cookie assistant guest hash chỉ chứng minh conversation sở hữu,
không trở thành full auth/order credential.

## 4. State machine bắt buộc

Product baseline: một Product tương ứng đúng một SKU/productId; biến thể màu/kích thước ở UI là các productId có SKU riêng, có thể thêm `groupKey` để liên kết. Không collection product_variants hay variantId ở checkout baseline. Nếu cần variant document phase sau, amendment đồng thời schema/inventory/cart/order/API rồi mới mở UI. `saleMode=buy|both` phải có priceVnd safe integer **>0**; giá chưa xác định dùng draft/quote, không bán 0đ.

Address manual fallback: `recipientName`, `phone`, `line1`, `formattedAddress`, `countryCode` bắt buộc; ward/province/postalCode/location optional. Không bắt reverse provider hoặc dataset hành chính để lưu/mua. Auth challenge guest_order_access chứa orderId chỉ server, appeal_access chứa userId chỉ server; response challenge không tiết lộ record tồn tại. TTL cleanup không thay expiry check runtime.

Return/refund baseline **full-only**; `partialReturnsEnabled=false`, `partialRefundsEnabled=false`. Mảng items và refundedAmount giữ extension-compatible, nhưng service từ chối subset/quantity partial và refund amount nhỏ hơn toàn refundable balance khi flags tắt. Full return inspection vẫn phân biệt resellable/damaged quantity; đó là kết quả kiểm hàng chứ không mở partial return. Refund thất bại kết thúc attempt và phục hồi payment aggregate paid/partially_refunded theo completed ledger, chỉ trở lại refund_pending khi admin duyệt retry mới. Không hứa provider refund API: manual evidence baseline.

Contact quote lead baseline dùng `new/assigned/contacted/closed`; `contacted` mapping nghiệp vụ in_progress, `closed` có outcome optional won/lost/not_applicable. Luồng qualified/closed_won/closed_lost là extension, không để UI gửi enum ngoài baseline. Return baseline `requested/approved/rejected/received/closed`; các bước under_review/awaiting_return/inspected là timeline events/note, không enum mới. Ticket `open/assigned/in_progress/waiting_customer/resolved/closed`: open->assigned/in_progress; assigned->in_progress; in_progress->waiting_customer/resolved; waiting_customer->in_progress/resolved; resolved->closed hoặc reopen in_progress theo policy; closed terminal baseline. Staff assignment/status CAS, khách chỉ reply/reopen theo policy.

Order enum chung: `pending, confirmed, processing, shipped, delivered, cancelled, return_requested, returned`. Không dùng `shipping` từ dự án tham khảo.

| From | To | Điều kiện |
| --- | --- | --- |
| pending | confirmed | staff/admin; PayOS phải paid, COD đã kiểm tra thông tin và còn reservation |
| pending | cancelled | khách owner/guest proof hoặc staff; PayOS chưa paid có thể expiry; nếu paid phải theo luồng refund |
| confirmed | processing, cancelled | staff/admin; hủy phải giải phóng stock và mở refund nếu đã thu |
| processing | shipped | Nếu giao qua hãng, bắt buộc `shipping.carrier` và `shipping.trackingNumber`; giao thủ công phải ghi `reason`; PayOS phải paid; commit reservation giảm stock trong cùng transaction |
| processing | cancelled | chỉ staff/admin trước bàn giao; lý do, release reservation, refund khi cần |
| shipped | delivered | staff/admin xác nhận chứng cứ bàn giao; COD đánh dấu paid chỉ khi xác nhận thu tiền |
| shipped, delivered | return_requested | tạo ticket return, lý do; shipped chỉ sự cố giao hàng; delivered trong 7 ngày đề xuất |
| return_requested | returned | staff xác nhận đã nhận/kiểm hàng; inventory chỉ tăng phần đạt tiêu chuẩn bán lại; admin xử lý refund riêng |
| return_requested | shipped hoặc delivered | từ chối yêu cầu trả, khôi phục `previousFulfillmentStatus` đã lưu, lý do bắt buộc |
| cancelled, returned | không có | terminal; sửa sai bằng case hỗ trợ/audit, không sửa lịch sử im lặng |

Payment enum chung: `pending, paid, failed, expired, cancelled, refund_pending, refunded, partially_refunded`. PaymentAttempt dùng `pending/paid/failed/expired/cancelled`; refund riêng tổng hợp vào Order.paymentStatus. COD pending cho tới có chứng cứ thu tiền, không tự expire COD.

- `pending -> paid/failed/expired/cancelled`; `failed/expired/cancelled -> paid` chỉ qua event provider xác minh hoặc reconciliation: late payment không được bỏ qua.
- `paid/partially_refunded -> refund_pending`; completed refund: nếu refundedAmount=paidAmount thì refunded, nhỏ hơn thì partially_refunded. Refund fail trở về paid/partially_refunded theo ledger.
- Không nhận `paymentStatus:'paid'` từ public request, query redirect hoặc Gemini. Staff được xác nhận COD có chứng cứ; admin refund không tự sửa amount ledger.
- Late paid khi đơn/reservation đã hủy: ghi thu tiền và `payment_events.review`, mở case cần staff/admin; không tự hồi sinh đơn/stock, không thông báo giao hàng thành công.

## 5. Transaction và chống race

Atlas phải hỗ trợ transaction; test dùng replica set. Không coi Mongo standalone hoặc mock service là bằng chứng concurrency production.

1. **Checkout:** claim scoped idempotency record bằng unique index; chuẩn hóa+hash payload. Trong transaction đọc product published+buy/both, tính giá/phí server, conditional inventory update với `onHand-reserved>=quantity`, tạo held reservation, order snapshot và outbox event; commit tất cả hoặc rollback tất cả. Multi-item sort productId để thứ tự ổn định. Empty cart, lượng 0/âm/>99, hết hàng hoặc quote-only trả lỗi trước commit. PayOS network gọi **sau** transaction; timeout không xóa order.
2. **Idempotency:** key ít nhất 128 bit ngẫu nhiên, cùng actor+scope+key và payload -> resource cũ; payload khác -> 409. In-progress trả 409 `REQUEST_IN_PROGRESS` + Retry-After. Guest actorKey từ cart cookie server, không từ email tùy ý. Guest token trả một lần rồi lưu cookie scope order và hash server; replay trả cùng order nhưng không lộ lại secret thô. Đã mất cookie phải đi OTP recovery.
3. **Confirm/payment:** giữ reservation held cho đơn paid/COD đã nhận, bỏ expiresAt khi paid trong cùng transaction webhook; ghi event+ledger+order version+outbox. Không giảm onHand lần thứ hai ở webhook.
4. **Ship:** held->committed, `onHand-=qty`, `reserved-=qty`, order->shipped, movements+audit/outbox cùng transaction. Duplicate request/event không trừ hai lần.
5. **Cancel/expire:** held->released CAS, `reserved-=qty`; chỉ PayOS pending/failed/expired/cancelled **chưa có paid event** và qua kiểm tra provider nếu uncertain. Worker không release đơn paid; lease và transaction ngăn race webhook. Nếu provider không xác nhận được trạng thái, đánh dấu review và trì hoãn release, giới hạn+alert việc giữ hàng lâu.

   Reservation chỉ `held|committed|released`, không enum expired; lý do release='expired' và expiresAt là metadata. Online expiresAt mặc định 15 phút và phải align provider link expiration. COD pending không auto-expire baseline: staff queue cảnh báo hold lâu, staff hủy có lý do; giới hạn số pending COD theo principal/guest identity (đề xuất 3, cấu hình) và velocity checks để chống giữ tồn. COD confirmed/paid held bỏ expiresAt; không dùng job online cho COD.
6. **Return/refund:** returned không tự hoàn tiền hoặc tăng toàn bộ stock. Inspection ghi good/damaged quantity; movement unique theo return-item; refund service khóa concurrent refund bằng transaction và conditional available refundable amount.
7. **Default address:** bỏ default cũ và đặt default mới trong transaction; unique partial index là chốt chống race. Đổi address không sửa recipientSnapshot đơn cũ.
8. **Account:** block/role change tăng authVersion và revoke session; ghi audit/outbox trong transaction. Appeal approve+unlock trong transaction, một quyết định cuối qua expectedVersion. Bảo vệ admin cuối bằng transaction trên guard document admin count để tránh hai admin hạ nhau cùng lúc.
9. **Outbox:** tạo event cùng transaction nghiệp vụ, worker claim atomic lease; fail SMTP không rollback paid order. Consumer dedupe notification. Email có thể gửi trùng ở crash giữa send/ack; không hứa exactly-once nếu provider không có idempotency.

## 6. Dữ liệu riêng tư và khởi tạo

- Order code để đọc/hỏi CSKH; **code không đủ để xem đầy đủ PII**. Guest có access cookie/token bí mật hoặc OTP gửi email đơn. Không xác thực bằng mã đơn + số điện thoại có thể đoán.
- Coordinates là optional theo consent, không cần để checkout. Geocoder chỉ gợi ý; người mua xác nhận ward/province/line1. Không lưu vị trí tự động khi chưa đồng ý.
- Seed có 2 line và các tên sản phẩm trong brief, không bịa giá, nghệ nhân, chứng chỉ hoặc tồn kho thật. Data demo gắn nhãn, chỉ môi trường dev/test; production nhập admin có audit.
- Index migration có script kiểm tra duplicate trước build; bật index qua release step có kiểm chứng, không dựa autoIndex production. Không tạo TTL cho order/payment/audit/reservation.
- Media dùng storage adapter do integrator chốt; chỉ DB URL+metadata. Không lưu file uploads ở filesystem ephemeral của Render như persistence production.

## 7. Các quyết định nghiệp vụ còn cần xác nhận trước launch

Chính sách trả trong 7 ngày, giới hạn 20 address, thời hạn reservation PayOS 15 phút, COD không auto-expire, fee theo bảng cấu hình server, cash refund xử lý manual có chứng từ, moderation review trước công bố, bán buy/quote/both từng sản phẩm là mặc định đề xuất. Agent triển khai dưới config và fixture, ghi rõ demo; **không tự khẳng định đây là chính sách chính thức TRO & LAM**. Chưa có voucher/loyalty trong phạm vi yêu cầu; không kéo nghiệp vụ trà/voucher của dự án tham khảo sang gốm.

Quote v1 là contact lead `kind:quote` có productId/quantity và hàng đợi staff/admin để quản lý phản hồi. Đạt mục tiêu khi khách gửi được và staff quản lý được; **không có tự động convert quote thành order** ở baseline. Nếu thêm phase quote acceptance, dùng collection quote riêng có giá snapshot, validUntil, version và acceptance proof; conversion server kiểm giá/thời hạn/tồn kho, không tin số tiền do khách gửi. `both` có cả mua ở giá công bố và yêu cầu báo giá; `quote` chỉ lead, `buy` chỉ checkout.
