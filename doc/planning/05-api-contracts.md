# API contract v1 — TRO & LAM

Ngày 06/10/2026. **Hợp đồng đề xuất**, cần đóng băng ở P01 trước agent triển khai; hiện API chỉ có health. Tất cả route dưới `/api/v1` trừ UI routes. Phối hợp với [mô hình dữ liệu](04-data-model.md), [kế hoạch song song](07-parallel-delivery-plan.md).

## 1. Envelope, HTTP và phân trang

Các tên/giá/địa chỉ/mã trong JSON examples chỉ là fixture minh họa contracts, không phải dữ liệu
kinh doanh thật được phép publish. Invitation từ admin cần POST `/auth/invitations/accept`
với `{token,password,name}`, purpose invite_user single-use và invitedRole từ challenge server;
response user+session theo auth policy, không nhận role tự chọn từ người được mời.

Success JSON: `{ "data": <object|array>, "meta": { "requestId": "..." } }`. Danh sách thêm `meta.pagination={page,limit,total,totalPages}`. Create 201; async accepted 202; mutation có DTO trả 200; DELETE thành công 204 không body. Money suffix `Vnd`, date ISO UTC, `id` string, boolean đúng kiểu. Fields passwordHash/tokenHash/authVersion/signature/internal notes không serialize.

```json
{"data":[{"id":"507f1f77bcf86cd799439011","name":"Hũ đựng trà","line":"lifestyle","saleMode":"buy","priceVnd":450000}],"meta":{"requestId":"f44ef8a6-01aa-4ae9-b738-6e878fb90123","pagination":{"page":1,"limit":20,"total":1,"totalPages":1}}}
```

Giá trên là fixture minh họa, không là giá chính thức. Error giữ dạng scaffold: `{error:{code,message,details?},meta:{requestId}}`; details là mảng `{field,code,message}` đã redact. P01 thêm meta nhưng giữ code `NOT_FOUND`, `PAYLOAD_TOO_LARGE`, `INTERNAL_ERROR`. Health ngoại lệ **giữ nguyên** `GET /health/live -> {status:'ok'}`, `GET /health/ready -> {status:'ready'|'unavailable',database:'connected'|'disconnected'}` 200/503 (`backend/src/controllers/health.controller.js`, `services/health.service.js`). Provider webhook ACK theo tài liệu provider, không ép envelope nội bộ.

| HTTP | code | Cách UI xử lý |
| --- | --- | --- |
| 400 | VALIDATION_ERROR, BAD_REQUEST | lỗi đúng field, giữ input |
| 401 | AUTH_REQUIRED, SESSION_EXPIRED | login/recovery, giữ route mong muốn |
| 403 | FORBIDDEN, ACCOUNT_BLOCKED, CSRF_INVALID | không retry; blocked chuyển màn kháng nghị |
| 404 | NOT_FOUND | cùng phản hồi cho resource không tồn tại hoặc không thuộc khách |
| 409 | VERSION_CONFLICT, OUT_OF_STOCK, IDEMPOTENCY_CONFLICT, REQUEST_IN_PROGRESS, INVALID_TRANSITION, PENDING_APPEAL_EXISTS, ALREADY_REVIEWED | reload dữ liệu; request in progress retry bounded |
| 410 | LINK_EXPIRED, NFC_REVOKED | xin link mới hoặc thông báo tag ngừng hoạt động |
| 413/415 | PAYLOAD_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE | đổi file |
| 422 | CHECKOUT_NOT_ALLOWED, REVIEW_NOT_ELIGIBLE | giải thích điều kiện nghiệp vụ |
| 429 | RATE_LIMITED | Retry-After, không tự spam |
| 503 | DATABASE_UNAVAILABLE, PAYMENT_UNAVAILABLE, MAIL_UNAVAILABLE, AI_UNAVAILABLE, GEO_UNAVAILABLE, MEDIA_UNAVAILABLE | degraded UI, đơn đã tạo vẫn hiển thị; không fake thành công |

Page mặc định 1, limit 20 max100. q trim max120, enum sort allowlist; stable tie-break id. Riêng message/audit dùng cursor opaque encode timestamp+id, limit max100, trả `meta.nextCursor` thay total. Không trộn page và cursor. Endpoint không ghi sort có default createdAt desc. Client không gửi raw Mongo filter. expectedVersion required ở order transition/user status/role/appeal/refund/content mutations; mismatch 409.

## 2. Auth và permission

- Opaque cookie session `HttpOnly; Secure` ở production, `SameSite=Lax` khi frontend/API cùng site. Dev localhost secure=false. Cross-site Vercel/Render cần `SameSite=None; Secure`, CORS credentials+origin allowlist và kiểm tra CSRF; ưu tiên custom domain cùng site để giảm third-party cookie failure. Không lưu bearer auth trong localStorage.
- `/auth/csrf` cấp token chống CSRF; mọi browser mutation kèm `X-CSRF-Token`, Origin allowlist. Login/register/guest checkout cũng bảo vệ CSRF; webhook exempt CSRF nhưng bắt signature. Server đọc user status+role+authVersion mỗi request.
- Ký hiệu: **G** guest/public, **C** customer active (staff/admin được dùng chức năng self như customer), **S** staff hoặc admin active, **A** admin active, **B** token appeal-scoped được cấp sau chứng minh danh tính blocked, **O** owner C hoặc guest order-proof. API kiểm tra quyền server, route guard React chỉ phục vụ UX.
- Blocked user không được dùng chức năng customer/staff/admin kể cả còn cookie cũ; chỉ auth recovery/appeal scope. Login đúng credential blocked trả 403 ACCOUNT_BLOCKED với appeal context ngắn hạn; tránh reveal qua email chưa xác minh.
- Staff có quyền queue order/support, operational dashboard, refund request và internal note; không role/user status/catalog/CMS/financial approval/system logs. Admin kế thừa S.
- Guest cart opaque cookie, order code+secret proof; tra cứu full order không public. Email OTP recovery uniform 202 tránh enumeration, rate limit theo IP và hash identity; token single-use. Token không xuất URL/log, hỗ trợ Authorization scope guest riêng nếu cần nhưng không dùng bearer login.

Capability baseline: C có `self.profile/self.addresses/self.orders/self.reviews/self.tickets/self.notifications/self.vouchers`; S thêm `orders.operate/support.operate/contacts.operate/dashboard.operations/refunds.request`; A có `catalog.manage/content.manage/users.manage/appeals.review/refunds.approve/refunds.complete/audit.read/statistics.read/settings.manage/vouchers.manage`. A kế thừa S và self-service. Middleware module dùng capability đã map từ role server; không nhận capability do client gửi. Appeal proof chỉ `appeal.submit/appeal.read`, guest proof chỉ `guest.order.read/guest.order.cancel/guest.payment.create/guest.ticket.create/guest.return.request` trên đúng orderId. Operational UI route guards riêng khỏi self-service, vẫn dùng cùng Identity/AuthContext.

AuthSession và restricted proof tách collection/credential resolver như 04. Không full auth middleware nào chấp nhận appeal/guest proof; O guard chỉ kiểm user-owned order hoặc `purpose=guest_order_access, orderId` và scopes hợp lệ. Appeal scope không mua hàng/quản lý địa chỉ; guest order scope không truy cập user/profile/system log. Mutation restricted vẫn cần CSRF. Server không nhận purpose/scopes/userId/orderId tùy ý từ client để phát proof.

## 3. Ma trận endpoint bắt buộc

Request schema tên viết hoa được định nghĩa ở mục 4; `{}` body rỗng. Query common pagination như mục 1.

### Public, auth, cart, địa chỉ

| Method path | Quyền | Request/query | Response data |
| --- | --- | --- | --- |
| GET /products | G | q,line,category,priceMin,priceMax,saleMode,available,sort=name/price_asc/price_desc/newest,page,limit | ProductSummary[] published; `available=true/false` filters buyable stock availability and never exposes reserved counts |
| GET /products/:slug | G | locale=vi/en | ProductDetail published + related stories |
| GET /categories | G | locale | Category[] published |
| GET /products/:id/reviews | G | page,limit | ReviewPublic[] published |
| GET /pages/:slug | G | locale | Page published |
| GET /stories/:slug | G | locale | Story published |
| GET /nfc/:publicId | G | locale | {product?,story}; tag revoked 410 |
| GET /commerce/config | G | — | {currency:'VND',paymentMethods,shippingPolicy,returnPolicy,checkoutEnabled}; không secret |
| POST /contacts | G | ContactCreate | 202 {id,deliveryStatus:'queued'} sau persist+outbox |
| GET /auth/csrf | G | — | {csrfToken}; không-cache |
| POST /auth/register | G | {name,email,password,phone?} | 202 {verificationRequired:true}; không chọn role |
| POST /auth/verify-email | G | {token} | {verified:true} |
| POST /auth/resend-verification | G | {email} | 202 generic {accepted:true} |
| POST /auth/login | G | {email,password} | {user} + session cookie; blocked 403 appeal context |
| POST /auth/logout | G/C | {} | 204 revoke cookie/session idempotent |
| POST /auth/forgot-password | G | {email} | 202 generic {accepted:true} |
| POST /auth/reset-password | G | {token,password} | {reset:true}, revoke all sessions |
| GET /auth/me | C | — | UserSelf |
| POST /auth/appeal-access | G | {email,verificationCode,challengeId} | {expiresAt} + HttpOnly appeal-proof cookie; scoped B, không session nghiệp vụ |
| POST /auth/appeal-challenges | G | {email} | 202 generic {accepted:true,challengeId}; SMTP challenge |
| GET /account/appeals/current | B | appeal-proof cookie | {status,message?,reviewNote?,submittedAt?} |
| POST /account/appeals | B | {message} | 201 AppealSelf; 409 pending tồn tại |
| PATCH /account/profile | C | {name?,phone?,birthDate?,gender?} | UserSelf |
| POST /account/email-change | C | {email,currentPassword} | 202 {challengeId,expiresAt}; email phải chưa có tài khoản khác |
| POST /account/email-change/verify | C + đúng challenge owner | {challengeId,verificationCode} | {changed:true,email}; revoke mọi session |
| POST /account/password | C | {currentPassword,newPassword} | {changed:true}; revoke mọi session |
| GET /account/vouchers | C | — | Voucher[] của user hiện tại, không có thao tác tự nhận voucher |
| GET /cart | G/C | cookie | Cart priced server + availability warnings |
| PUT /cart/items/:productId | G/C | {quantity:1..99,expectedVersion} | Cart |
| DELETE /cart/items/:productId | G/C | expectedVersion query | Cart |
| POST /cart/merge | C + guest cookie | {expectedVersion} | Cart merged server, max99/item; không auto nhân đôi khi retry |
| GET /account/addresses | C | — | Address[] owned |
| POST /account/addresses | C | AddressWrite | 201 Address |
| PATCH /account/addresses/:id | C owner | AddressPatch | Address |
| DELETE /account/addresses/:id | C owner | expectedVersion | 204 |
| POST /account/addresses/:id/default | C owner | {expectedVersion} | Address default |
| POST /locations/reverse | C | {lat,lng}; consent user đã bật UI | {suggestedAddress,provider,accuracy:'approximate'}; không tự lưu |

### Checkout, thanh toán, tài khoản và CSKH

| Method path | Quyền | Request/query | Response data |
| --- | --- | --- | --- |
| POST /checkout/quote | G/C | CheckoutQuote (+ customer voucherId tùy chọn) | {items,subtotalVnd,discountVnd,shippingFeeVnd,totalVnd,quoteExpiresAt,warnings} |
| POST /orders | G/C | CheckoutCreate (+ customer voucherId tùy chọn) + Idempotency-Key header | 201 OrderCreated; voucher kiểm tra/đánh dấu dùng trong cùng transaction; retry cùng key 200 cùng order |
| POST /order-access/challenges | G | {code,email} | 202 generic {accepted:true,challengeId} |
| POST /order-access/verify | G | {challengeId,verificationCode} | {orderId,expiresAt}, đặt order-scoped proof cookie |
| GET /orders/:id | O | guest proof cookie hoặc authenticated owner | OrderDetail đầy đủ người nhận nhưng không internal note |
| POST /orders/:id/cancel | O | {reason,expectedVersion} + Idempotency-Key | OrderDetail; public chỉ pending |
| POST /orders/:id/payment-attempts | O | {} + Idempotency-Key | 201 {attemptId,checkoutUrl,expiresAt,status}; retry hiện trạng |
| GET /orders/:id/payment | O | — | {paymentStatus,paidAmountVnd,refundedAmountVnd,reviewRequired}; polling bounded |
| POST /payments/payos/webhook | provider | signed provider body | ACK chỉ sau event persist; duplicate ACK cùng kết quả |
| GET /account/orders | C | status,page,limit | OrderSummary[] owned |
| POST /account/orders/claim | C + guest order proof | {orderId} + Idempotency-Key | OrderDetail; verified user email matches order email, CAS userId chưa có, revoke guest proof, audit |
| GET /account/reviews | C | page,limit,status? | ReviewSelf[] owned; kèm order-item eligibility theo orders khi chưa review |
| POST /account/reviews | C | {orderId,productId,rating,comment,attachmentIds?,consentToPublishAttachments?} | 201 ReviewSelf; delivered owned order |
| PATCH /account/reviews/:id | C owner | {rating,comment,expectedVersion} | ReviewSelf; re-moderate, theo policy edit window |
| GET /account/tickets | C | status,page,limit | TicketSummary[] owned |
| POST /tickets | C/O | TicketCreate | 201 TicketDetail; guest phải có order proof |
| POST /orders/:id/return-requests | O | {items:[{productId,quantity,reason}],message,expectedVersion} + Idempotency-Key | 201 ReturnRequest + ticketId; tài nguyên riêng, không tự refund |
| GET /orders/:id/return-requests | O | — | ReturnRequest[] owned |
| GET /tickets/:id | owner C hoặc guest order proof match ticket.orderId | — | TicketDetail sans internal |
| GET /tickets/:id/messages | owner C/guest proof hoặc S | cursor,limit | TicketMessage[] với visibility filter |
| POST /tickets/:id/messages | owner C/guest proof hoặc S | {body,attachmentIds?,visibility:'customer'|'internal'} | 201 TicketMessage; internal chỉ S |
| GET /notifications | C | category=order/promotion/system,unreadOnly,page,limit | Notification[] owned; support/account legacy được nhóm vào system |
| GET /notifications/unread-count | C | — | {count} |
| PATCH /notifications/:id/read | C owner | {} | Notification |
| PATCH /notifications/read-all | C | {} | {updatedCount} |
| GET /admin/vouchers | A | — | Voucher[] với customer email |
| POST /admin/vouchers | A | AdminVoucherWrite | 201 voucher cấp riêng cho customer đã active; in-app promotion notification + audit |
| POST /admin/vouchers/:id/revoke | A | {} | Voucher revoked nếu chưa redeemed |
| POST /assistant/messages | G/C | {conversationId?,message,consent:true} | {conversationId,reply,sources,handoffSuggested}; không quyền thao tác order |
| POST /assistant/handoffs | G/C/O | {conversationId,shareTranscript:boolean,contact?:{name,email,phone?},orderId?} | 202 {targetType:'ticket'|'contact',id,reference}; explicit consent và conversation ownership; customer hoặc guest order proof tạo ticket, guest chưa có order tạo contact lead |
| POST /attachments/uploads | C/O/S | {purpose:'ticket'|'refund'|'review',orderId?,ticketId?,reviewId?,mimeType,bytes,visibility?} | 201 {id,uploadUrl,expiresAt}; private storage, JPEG/PNG/WebP <=5MB, tối đa5 file/resource; refund/internal chỉ S |
| POST /attachments/:id/finalize | uploader C/O/S | {} | AttachmentReady sau server verify object/hash/magic bytes/size; failed validation không link |
| GET /attachments/:id/download | resource owner O/C hoặc S theo scope | — | 302 short-lived signed URL hoặc stream; auth kiểm mỗi lần, internal chỉ S; không public URL original |

### Staff và admin

| Method path | Quyền | Request/query | Response data |
| --- | --- | --- | --- |
| GET /staff/dashboard | S | from,to | {orderQueues,ticketQueues,lowStock,operationalCounts}; `lowStock:null` means no owner-approved threshold is configured; money totals come from defined persisted metrics, never fabricated data |
| GET /staff/orders | S | status,paymentStatus,queue,from,to,q,page,limit | OrderSummary[] |
| GET /staff/orders/:id | S | — | OrderOperational gồm operational notes |
| POST /staff/orders/:id/transitions | S | OrderTransition + Idempotency-Key | OrderOperational |
| POST /staff/orders/:id/shipping-events | S | {status,message,occurredAt,trackingNumber?,carrier?,expectedVersion} | OrderOperational; không bypass transition |
| POST /staff/orders/:id/cod-collection | S | {amountVnd,evidenceReference,expectedVersion} + Idempotency-Key | OrderOperational; đúng số tiền và shipped/delivered |
| POST /staff/orders/:id/refund-requests | S | {amountVnd,reason,expectedVersion} + Idempotency-Key | 201 Refund requested |
| GET /staff/tickets | S | status,assignedTo,kind,page,limit | TicketSummary[] |
| PATCH /staff/tickets/:id | S | {status?,assignedTo?,priority?,expectedVersion} | TicketOperational |
| GET /staff/return-requests | S | status,page,limit | ReturnRequest[] |
| POST /staff/return-requests/:id/decision | S | {decision:'approved'|'rejected',reason,expectedVersion} | ReturnRequest; rejected khôi phục previousFulfillmentStatus |
| POST /staff/return-requests/:id/inspection | S | {items:[{productId,receivedQuantity,resellableQuantity}],evidenceReference,expectedVersion} | ReturnRequest received + order returned; stock good quantity qua P05 |
| POST /staff/return-requests/:id/close | S | {reason,expectedVersion} | ReturnRequest closed; case received đã xử lý disposition/refund cần thiết; không tự ghi refunded |
| GET /staff/contacts | S | status,kind,page,limit | Contact[] |
| PATCH /staff/contacts/:id | S | {status?,assignedTo?,note?,expectedVersion} | Contact |
| GET /admin/products | A | q,status,line,page,limit | ProductAdmin[] all statuses |
| GET /admin/products/:id | A | — | ProductAdmin |
| POST /admin/products | A | ProductWrite | 201 ProductAdmin |
| PATCH /admin/products/:id | A | ProductPatch (partial product fields + required expectedVersion) | ProductAdmin |
| DELETE /admin/products/:id | A | expectedVersion | 204 archive khi có liên kết lịch sử |
| POST /admin/products/:id/inventory-adjustments | A | {delta,reason,expectedVersion} + Idempotency-Key | Inventory; không làm onHand<reserved |
| GET/POST /admin/categories | A | query hoặc CategoryWrite | list / 201 Category |
| PATCH/DELETE /admin/categories/:id | A | write+version / version | Category / 204 archive |
| POST /admin/media | A | multipart file JPEG/PNG/WebP<=5MB | 201 {id,url,alt}; storage adapter, magic-byte kiểm tra |
| GET /admin/users | A | q,role,status,page,limit | UserAdmin[] sans credential |
| POST /admin/users | A | {name,email,role}; invitation không plaintext password | 201 {user,inviteStatus:'queued'} |
| GET /admin/users/:id | A | — | UserAdmin |
| PATCH /admin/users/:id | A | {name?,phone?,expectedVersion} | UserAdmin |
| POST /admin/users/:id/status | A | {status:'active'|'blocked',reason,expectedVersion} | UserAdmin + revoke session |
| POST /admin/users/:id/role | A | {role,reason,expectedVersion} | UserAdmin + revoke session |
| POST /admin/users/:id/password-reset | A | {reason}; CSRF; `users.manage` | 202 {accepted:true,queued:true}; sends a one-time link only to the target’s verified email, with a persistent per-target cooldown; raw token is never returned or audited; request does not change password or revoke sessions |
| GET /admin/appeals | A | status,page,limit | Appeal[] |
| POST /admin/appeals/:id/decision | A | {decision:'approved'|'rejected',reviewNote,expectedVersion} | Appeal; approved unlock transaction |
| GET /admin/audit-logs | A | action,actorId,targetType,targetId,from,to,cursor,limit | AuditLog[] redacted |
| GET /admin/statistics | A | from,to (required; inclusive; max 367 Asia/Ho_Chi_Minh calendar dates) | {grossCollectedVnd,refundedVnd,netCollectedVnd,comparison:{from,to,grossCollectedVnd,deltaVnd,changePercent},revenueTrend:{timezone,daily:[{date,grossCollectedVnd}],comparisonDaily:[{date,comparisonDate,grossCollectedVnd}]},orderCounts,topProducts}; gross thu từ PayOS applied + COD recorded, refunds riêng; không đồng nghĩa lợi nhuận; ledger lỗi/mất cân bằng trả lỗi, không giả 0 |
| GET /admin/refunds | A | status,page,limit | Refund[] |
| POST /admin/refunds/:id/decision | A | {decision:'approved'|'rejected',reason,expectedVersion} | Refund approved/rejected (rejected lưu reason, request state terminal) |
| POST /admin/refunds/:id/complete | A | {externalReference,evidenceReference,expectedVersion} | Refund completed; chỉ manual adapter khi chưa có provider refund API xác minh |
| GET /admin/reviews | A | status,productId,page,limit | ReviewAdmin[]; pending queue có nguồn order đã authorized |
| POST /admin/reviews/:id/moderation | A | {status:'published'|'hidden',reason,expectedVersion} | ReviewAdmin; media publish derivative chỉ khi consent+sanitize, không public original |
| GET /admin/settings | A | — | BusinessSettings sans secrets |
| PATCH /admin/settings | A | {values,expectedVersion,reason} schema allowlist | BusinessSettings + audit; shipping/COD/limits/support windows, không keys/provider URLs |
| GET/POST /admin/stories | A | query / StoryWrite | list / 201 Story |
| PATCH/DELETE /admin/stories/:id | A | partial+version / version | Story / 204 archive |
| GET/POST /admin/pages | A | query / PageWrite | list / 201 Page |
| PATCH/DELETE /admin/pages/:id | A | partial+version / version | Page / 204 archive |
| GET/POST /admin/nfc-tags | A | query / {storyId,productId?} | list / 201 tag+publicUrl |
| POST /admin/nfc-tags/:id/revoke | A | {reason,expectedVersion} | NfcTag |

GET/POST hoặc PATCH/DELETE trong bảng là **hai endpoint riêng**, không method ghép. Agent P01 phải chuyển từng endpoint thành operation OpenAPI riêng. Nếu cần thêm endpoints, tạo contract amendment trước làm UI/BE song song.

## 4. Body contract và DTO trọng yếu

Admin capability bổ sung `settings.manage`. Attachment access tái dùng ownership của order/ticket/review,
không coi upload ID là quyền truy cập. Guest phải có order proof và ticket.orderId/orderId match; attachment
orphan bị cleanup worker sau24h đề xuất, delete storage trước metadata, không tự TTL xóa metadata rồi bỏ object.
Link attachment vào resource bằng transaction, validate ready+purpose+owner+visibility; customer không tạo internal.
Review attachments private tới khi published và consent; server tạo bản public đã sanitize/reencode, không expose
signed URL original lâu dài trên public product. P07 cung cấp adapter metadata/ACL; storage integration chung.
AI handoff guest không order cần contact name/email và consent, lưu lead+redacted transcript tham chiếu server,
trả reference chứ không phát ticket proof giả; phản hồi qua email/staff contacts. Customer/order-verified guest
được thread ticket thật. `createHandoff` port trả targetType/id/reference theo cùng rules.

```json
{
  "recipientName":"Nguyễn An","phone":"0900000000","label":"Nhà",
  "line1":"12 Đường Ví Dụ","ward":"Phường Ví Dụ","province":"TP.HCM",
  "countryCode":"VN","formattedAddress":"12 Đường Ví Dụ, Phường Ví Dụ, TP.HCM",
  "isDefault":true,
  "location":{"lat":10.77,"lng":106.69,"accuracyMeters":30,"source":"device","capturedAt":"2026-10-06T02:00:00Z"}
}
```

AddressWrite: recipientName 1..100, phone chuẩn E.164 hoặc VN normalize server, line1 bắt buộc 1..200, formattedAddress bắt buộc 1..500, ward/province optional <=100, lat -90..90/lng -180..180. Không bắt client schema tỉnh/huyện lỗi thời; address taxonomy/geocoder provider phải được xác minh trước triển khai. `location` optional, từ chối permission vẫn nhập tay.

Checkout recipient có cùng AddressWrite required fields cộng email hợp lệ; structured ward/province optional trong DTO. Tuy vậy, báo giá giao hàng yêu cầu `recipient.province` để khớp chính xác với vùng đã cấu hình. Ví dụ có ward/province là dữ liệu gợi ý đã xác nhận, không required schema chung. Chuẩn SKU: ProductWrite có một sku; UI chọn biến thể là chọn productId riêng. Không gửi variantId baseline. PriceVnd buy/both strictly positive, quote-only không checkout.

```json
{
  "items":[{"productId":"507f1f77bcf86cd799439011","quantity":2}],
  "recipient":{"recipientName":"Nguyễn An","email":"demo@example.com","phone":"0900000000","line1":"12 Đường Ví Dụ","formattedAddress":"12 Đường Ví Dụ, Phường Ví Dụ, TP.HCM","ward":"Phường Ví Dụ","province":"TP.HCM","countryCode":"VN"},
  "paymentMethod":"payos","note":"Gói quà", "consent":true
}
```

CheckoutQuote và CheckoutCreate dùng cùng items/recipient; C có thể gửi `addressId` thay recipient nhưng email lấy từ user đã xác minh, server snapshot owner address. Không nhận price/subtotal/stock/userId/status/paymentStatus từ body. `Idempotency-Key` UUID/random128-bit header; CheckoutCreate trả `{order:{id,code,status,paymentStatus,totalVnd},payment:{status,checkoutUrl?,retryable},guestAccess:{expiresAt}?}` và proof cookie; provider unavailable vẫn OrderCreated với `payment.status:'unavailable'` + retryable=true, không làm client tạo đơn thứ hai. UI không coi có checkoutUrl là đã paid.

```json
{"toStatus":"shipped","expectedVersion":3,"reason":"Bàn giao vận chuyển","shipping":{"carrier":"Đơn vị vận chuyển","trackingNumber":"DEMO123"}}
```

OrderTransition theo machine trong 04; `reason` tối đa 1000 ký tự và bắt buộc với hủy hoặc giao thủ công. Khi giao qua hãng, `shipping.carrier` và `shipping.trackingNumber` đều bắt buộc; giao thủ công không gửi shipping pair. Guest/customer cancel chỉ pending; các hủy sau confirmed do staff quyết định qua ticket. OrderDetail: `{id,code,status,paymentStatus,paymentMethod,recipient,items,subtotalVnd,shippingFeeVnd,discountVnd,totalVnd,paidAmountVnd,refundedAmountVnd,shipping,statusHistory,createdAt,version}`. Chỉ Operational mới thêm internalNote/paymentReview; statusHistory không có IP/internal reason nhạy cảm.

ProductWrite: `{name,slug,sku,line,categoryId,description,material,dimensions?,careInstructions?,images:[{url,alt,sortOrder}],saleMode,priceVnd?,storyId?,status,featured}`; slug/sku unique, buy/both priceVnd>0 safe integer, quote price không bị UI coi 0đ. Stock cập nhật endpoint riêng P05, không field stock trên ProductWrite. ProductSummary expose availableForPurchase và stockLabel; không lộ reserved ledger.

`saleMode` enum `buy|quote|both`: quote-only dùng POST /contacts kind quote; staff quản lý GET/PATCH /staff/contacts kind=quote. Không convert báo giá thành đơn tự động trong baseline; nếu cần agent lập contract phase sau với expiry/acceptance/price snapshot.

Full-only baseline: POST return-requests phải gửi toàn item quantity eligible; refund-request amount bằng toàn refundable balance. Partial bị từ chối 422 `PARTIAL_OPERATION_DISABLED` khi flags false. Refund failed trả status failed ở Refund và Order.paymentStatus trở về paid/partially_refunded theo ledger, không ghi refunded hoặc treo refund_pending vô hạn. API schema có items/amountVnd/refundedAmountVnd để phase partial không phá DTO, nhưng UI không hiện chức năng partial lúc baseline. Staff ticket status phải theo transitions ở 04; return case enum requested/approved/rejected/received/closed, inspection lưu fact rồi closed khi hoàn tất xử lý case; refund lifecycle độc lập.

TicketCreate: `{kind:'support'|'complaint'|'return',subject,body,orderId?,attachmentIds?}`; guest required orderId+proof; return required owned order+eligible transition. ContactCreate: `{name,email,phone?,kind:'general'|'corporate'|'quote',productId?,quantity?,company?,message,consent:true}`. Không `to/cc/bcc` trong request. StoryWrite: `{slug,title,locale,origin,artisan?,motifs,sections,media,productIds,status,expectedVersion?}`. PageWrite: `{slug,title,locale,blocks,status,expectedVersion?}`. CategoryWrite: `{slug,name,description?,parentId?,sortOrder,status,expectedVersion?}`.

P08 content item rules: `sections[]` is `{heading?:string≤300,body:ContentBlock[]≤100}`; `PageWrite.blocks` has at most 200 `ContentBlock`s. A `ContentBlock` is exactly one of `{type:'paragraph'|'heading'|'quote',text:string[1..5000]}`, `{type:'list',items:string[1..1000][]}` with 1–50 items, `{type:'image',url,alt:string[1..300],caption?:string≤500}`, or `{type:'link',text:string[1..300],url}`. A media URL is a same-origin path with one leading slash or credential-free HTTPS, at most 2048 characters. Story motifs are 1–300 characters each (maximum 100); media items are `{url,alt,caption?}` with the image limits (maximum 100); `productIds` are unique 24-character hexadecimal IDs (maximum 100). `slug` is lowercase ASCII letters/digits/hyphens (maximum 180), title maximum 300, origin maximum 2000, and artisan maximum 300. Unknown block properties are rejected. These content block variants are a structured-text allowlist, not a new business lifecycle enum. Publishing a story still requires non-empty origin and at least one populated section; publishing a page requires at least one block. HTML is not rendered as markup.

`BusinessSettingsWrite.values` accepts only the documented top-level keys `shippingZones`, `codEnabled`, `checkoutLimits`, and `supportWindows`; their values are respectively an array, boolean, object, and object. Each `shippingZones` item contains exactly `{id,provinceNames,feeVnd}`: a unique lowercase slug `id` (1–80 characters), 1–100 `provinceNames` (each 1–100 characters), and a non-negative safe integer `feeVnd`. Zone IDs and province names cannot overlap; province names are compared after trimming, collapsing whitespace, case-folding, and removing Vietnamese diacritics. An empty zone list disables checkout shipping quotes. The checkout adapter requires a recipient `province` that exactly matches a configured normalized name; missing or unmatched names fail closed. `checkoutLimits` accepts the optional positive integer `maxPendingCodOrders`; COD checkout stays unavailable until the owner configures it. Unknown keys and empty updates are rejected. Nested values are inert business data only; secrets, provider credentials/URLs, and executable content are never stored in `settings`.

### Ví dụ recovery, appeal và webhook

```json
{"code":"TL-DEMO123","email":"demo@example.com"}
```

POST /order-access/challenges luôn 202 cùng message, trả challengeId ngẫu nhiên kể cả identity không khớp; chỉ gửi mail khi khớp. POST /order-access/verify body `{ "challengeId":"opaque-example", "verificationCode":"123456" }`, token/OTP chỉ fixture. Success đặt HttpOnly guest proof cookie, data `{ "orderId":"507f1f77bcf86cd799439011", "expiresAt":"2026-10-06T03:00:00Z" }`. GET /orders/:id sau verify trả đầy đủ recipient/items/totals/shipping/statusHistory như owner customer; loại bỏ internal notes, secret, audit actor metadata. Code đơn một mình hoặc email một mình không cấp quyền.

```json
{"error":{"code":"ACCOUNT_BLOCKED","message":"Tài khoản đang bị khóa","details":[{"field":"account","code":"APPEAL_AVAILABLE","message":"Bạn có thể gửi yêu cầu xem xét"}]},"meta":{"requestId":"f44ef8a6-01aa-4ae9-b738-6e878fb90123"}}
```

Blocked login đặt HttpOnly appeal-only cookie sau password đúng, không trả token thô vào body. Schema `AppealContext` gồm userId, expiresAt, purpose='appeal', không role permission. POST /account/appeals body `{ "message":"Xin kiểm tra lại tình trạng tài khoản của tôi." }`; cookie proof B + CSRF. Response 201 `{data:{id,status:'pending',submittedAt},meta:{requestId}}`; admin decision body `{ "decision":"approved", "reviewNote":"Đã xác minh thông tin", "expectedVersion":0 }`, unlock+revoke cùng transaction. Tài khoản bị khóa không phải guest để bypass checkout bằng session blocked; user muốn mua guest phải logout rõ ràng và theo chính sách chống abuse.

Provider wire body phụ thuộc tài liệu PayOS hiện hành; không dùng fixture dưới đây để tự viết signature canonicalization. P06 chuyển signed webhook đã xác minh sang **internal fact** sau:

```json
{"provider":"payos","providerEventKey":"verified-reference-example","providerOrderCode":123456789,"paymentLinkId":"link-example","amountVnd":900000,"currency":"VND","status":"paid","occurredAt":"2026-10-06T02:00:00Z","payloadDigest":"sha256-example"}
```

Internal fact không có public endpoint nhận từ browser. P06 webhook controller xác minh signature+provider amount/order mapping trước gọi service; invalid signature -> 400/401 theo docs provider và không ghi paid. Valid duplicate -> provider ACK sau persisted event. Response ACK hình dạng phải kiểm chứng tài liệu provider, không bịa `{success:true}` tương thích khi chưa xác minh.

## 5. Integration và kiểm chứng contract

- SMTP theo outbox, no arbitrary recipient, timeout/retry+dead-letter; contact lưu thành công khi email đang lỗi, UI thông báo đã nhận yêu cầu. Reset/verify token không log. Production thiếu SMTP phải hiển thị degraded flow và không giả verify email.
- PayOS secrets chỉ backend; ký request/xác minh response/webhook theo **docs chính thức tại lúc triển khai**; compare amount/currency/orderCode/paymentLink, dedupe verified reference, persist trước ACK. Return/cancel URL là allowlisted server config. Redirect query không sửa payment. Reconciliation worker làm nguồn khôi phục webhook mất.
- Gemini optional, read-only published catalog/story/policy + contextual order chỉ khi owner được chứng minh qua service riêng. Không tool chỉnh role/stock/refund/order. Timeout/budget/rate limit, user-requested handoff tạo ticket thường; AI không tự email/hoàn tiền. Prompt injection từ story/user không nâng quyền.
- Geocoder optional backend proxy allowlisted provider; browser xin consent+HTTPS geolocation, no background tracking; network timeout+fallback nhập tay. Không khẳng định tọa độ xác định địa chỉ chính xác.
- P01 tạo `doc/contracts/openapi.yaml` OpenAPI 3.1 và JSON schema DTO theo file này; freeze commit được ghi ở manifest. P01 contract tests giữ health compatibility+error envelope; mỗi package có positive/negative RBAC và ownership test. UI dùng mock cùng schema, không viết JSON ad-hoc.
- Webhook integration fixture phải có valid signature, invalid signature, duplicate, amount mismatch, unknown order, late paid, concurrent expiry. Payment audit không được in key/signature/raw PII. Mutation tới resource người khác trả 404; staff gọi admin routes và admin gọi staff workspace routes trả 403; blocked cookie cũ trả ACCOUNT_BLOCKED.
