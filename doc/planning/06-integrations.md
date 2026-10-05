# Tích hợp dịch vụ — hợp đồng và giới hạn

Các quy tắc xử lý trong tài liệu là thiết kế TRO & LAM; liên kết chính thức là nguồn kiểm tra
khả năng provider, không chứng minh hệ thống đã được cấu hình hay gọi API thành công.

## 1. SMTP / email
Đề xuất Nodemailer transport backend; SMTP do chủ dự án cung cấp. [Tài liệu SMTP](https://nodemailer.com/smtp)
mô tả TLS, auth và `verify()`; verify thành công không bảo đảm mọi thư được gửi tới inbox.

Thiết kế adapter `MailProvider.send({eventId,to,templateKey,variables})`; server định nghĩa templates.
Form liên hệ guest/customer: tên, email, subject từ danh sách cho phép, nội dung, consent cần thiết;
lưu ContactRequest rồi OutboxEvent trong transaction, trả 202 kèm reference. Không gửi email tùy ý
tới địa chỉ người dùng truyền trong trường `to`; hộp thư cửa hàng từ config, Reply-To là email đã validate.
Escape mọi trường trong HTML, chặn newline/header injection, rate limit, honeypot/challenge khi cần.

Templates: verify email, reset password, mã xác minh tra cứu guest, xác nhận đơn, cập nhật đơn,
phản hồi ticket, tiếp nhận/kết quả appeal, thông báo lead. Không gửi password/token session.
Token/link email chỉ dùng cho đúng purpose, có expiry, hash trong DB, consume một lần.

Outbox worker có lease, event dedupe, backoff và dead-letter; mặc định 5 lần retry với jitter,
delay 1m/5m/15m/1h/6h. SMTP retry có thể gây gửi lặp khi provider nhận thư rồi timeout;
hệ thống đảm bảo dedupe ý định gửi, không tuyên bố exactly-once delivery. Giữ Message-ID ổn định
cho cùng event. UI hiển thị `queued/sent/failed` như trạng thái gửi, không nói đã đọc.
SMTP lỗi không rollback đơn đã ghi; staff nhìn thấy lỗi và retry có audit. OTP không echo vào log.

## 2. PayOS
[API chính thức](https://payos.vn/docs/api/) có tạo/lấy/hủy payment link, webhook,
xác nhận webhook URL và APIs chi hộ. Tạo link nhận orderCode/amount dạng integer,
returnUrl/cancelUrl, chữ ký; webhook có signature và acknowledgement 2xx.
Mô tả chuyển khoản có giới hạn phụ thuộc ngân hàng; adapter phải kiểm tra tài liệu/version thực tế.

Adapter `PaymentProvider`: createLink, getLink, cancelLink, verifyWebhook.
Agent kiểm tra SDK chính thức hiện hành từ tài liệu/registry; không copy tên method cũ từ Ha Thành Vị
mà không xác minh. Credentials backend only: PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY.
Merchant credentials chỉ dùng lúc cấu hình môi trường do chủ dự án quản lý; tests inject provider giả.

Luồng TRO:
1. Server tạo Order/PaymentAttempt và reserve stock bằng transaction; `Idempotency-Key` cho checkout.
2. Worker/service tạo link bên ngoài transaction; request timeout để attempt ở unknown/pending và
   đối soát theo orderCode trước retry. Không tạo mã mới chỉ vì retry mạng.
3. Link trả về phải HTTPS/provider allowlist; browser redirect thanh toán, không nhận keys.
4. Return/cancel page chỉ là UI dẫn hướng. Query `status=PAID` của browser không cập nhật paid.
5. Webhook xác minh checksum/signature bằng SDK đã xác minh, schema, merchant association,
   orderCode/paymentLinkId, amount chính xác và VND. Chỉ ghi paid một lần cùng event và bảo vệ
   reservation held khỏi expiry; không giảm onHand ở paid. Xuất kho shipped mới giảm onHand/reserved một lần.
6. Dedupe provider + transaction reference; cùng event retry trả 2xx sau durable commit, không trừ stock lần hai.
   Sự kiện mismatch có chữ ký hợp lệ được lưu quarantine để xử lý, không xác nhận trả tiền cho order.
7. Unknown/probe không gắn đơn phải xử lý theo hướng dẫn confirmation thực tế: không tạo đơn/hạch toán;
   acknowledge an toàn hoặc từ chối theo adapter, ghi marker không nhạy cảm. DB lỗi trả 5xx để retry.
8. Job reconciliation kiểm tra attempt pending/unknown bằng getLink, dùng cùng hàm applyPayment
   như webhook. Sự kiện muộn không hồi sinh đơn đã hủy hoặc đã nhả reservation: chuyển ngoại lệ
   cần staff/admin xử lý hoàn tiền/chốt hàng, không oversell hay bỏ mất tiền nhận.

Không dùng TTL deletion như stock-release worker. Callback và expiry worker phải conditional-update
reservation cùng transaction để có một bên thắng; thời gian hết hạn link và reservation phải thống nhất.
Payment amount chưa đủ/thừa chuyển exception queue, không tự sửa totals; chưa cho partial installment mặc định.

**Hoàn tiền:** hủy link không phải hoàn tiền đã nhận. APIs chi hộ không tự đồng nghĩa refund cho
giao dịch cũ. Mặc định admin duyệt yêu cầu refund; thực hiện ngoài hệ thống hoặc qua adapter đã xác minh
và được cấp quyền riêng; ghi amount/reference/evidence (đã che dữ liệu) rồi cập nhật refund state có audit.
Không tạo API refund giả hay tự dùng chi hộ merchant để gửi tiền. Staff đề xuất/kiểm tra, admin quyết định.

## 3. Gemini hỗ trợ tư vấn
[Google GenAI libraries](https://ai.google.dev/gemini-api/docs/libraries) xác nhận SDK JS
`@google/genai`; [Models API](https://ai.google.dev/api/models) hỗ trợ khám phá model.
Model dùng trong Agy không bảo đảm có cùng ID trên Gemini API merchant.

Adapter `AiProvider.reply({message,approvedContext,history})`, GEMINI_MODEL từ config,
chọn model được key thực tế hỗ trợ khi triển khai; không hardcode model 3.8 chỉ vì CLI có.
Backend kiểm soát timeout 15s, bounded history/input/output, rate/cost limit, validate JSON output.
Context chỉ catalog public/published story và chính sách đã duyệt; không gửi password/OTP/address/payment
hoặc toàn bộ orders/audit đến provider. Thông tin đơn cần API deterministic có ownership rồi trả riêng.
Provider không được trực tiếp đổi trạng thái đơn, hoàn tiền, role, giá, tồn kho hoặc đọc collection tùy ý.

Trả lời tiếng Việt mặc định; không bịa giá/nguồn gốc/chính sách; thiếu dữ liệu trả “chưa có thông tin”
và đề xuất staff. Product IDs từ AI phải được resolve trong catalog published; URL do server tạo.
Render text/sanitized Markdown, không render HTML thô. Prompt trong user/CMS là dữ liệu không phải chỉ thị hệ thống.
Guest/customer gửi consent trước khi chuyển transcript cho staff; redact dữ liệu nhạy cảm trong AI context.
AI timeout/quota/permission → thông báo lịch sự + mở ticket/live handoff, commerce vẫn hoạt động.
Tests dùng adapter stub; kết quả stub không được báo đã gọi Gemini thật.

## 4. Định vị / reverse geocoding
[MDN Geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API): truy cập vị trí
cần secure context và permission. Browser lấy coordinates, không tự trả địa chỉ bưu chính.

Nút “Dùng vị trí hiện tại” trên Address form gọi getCurrentPosition theo thao tác người dùng;
không request khi tải trang. Timeout 10s, enableHighAccuracy=false mặc định, hiển thị sai số.
POST `/api/v1/locations/reverse` nhận lat/lng đã validate và session; backend adapter provider trả candidate.
Google Geocoding là ứng viên có [reverse geocoding docs](https://developers.google.com/maps/documentation/geocoding/requests-reverse-geocoding);
chi phí/quota/key và quyền cache phải chốt trước production. Không mặc định dùng public Nominatim làm production endpoint.

Người dùng xác nhận/sửa tên người nhận, điện thoại, số nhà/căn hộ và địa chỉ trước lưu.
Denied/timeout/unavailable/provider503 → nhập thủ công đầy đủ; không chặn checkout.
Lưu lat/lng chỉ khi người dùng chọn lưu để hỗ trợ giao; không gửi tọa độ tới Gemini/analytics.
Không ép tỉnh/huyện cũ theo danh sách lỗi thời: Address có structured levels optional, formattedAddress bắt buộc,
provider/placeId/version tùy chọn. Dữ liệu hành chính phải lấy dataset được xác minh và có ngày/version.

## 5. Notifications và hỗ trợ người thật
Event domain → Outbox → Notification (in-app) + email theo preferences. Customer chỉ thấy của mình;
staff thấy scope/assignee; admin giám sát. Baseline polling unread 30s, thread đang mở 10s,
dừng khi tab hidden/offline, retry backoff; SSE/WebSocket là nâng cấp, không điều kiện bắt buộc release.
Notification eventId+recipientId+channel unique; mark-read sở hữu, idempotent; bulk read có cutoff.
Guest không có inbox toàn tài khoản; dùng order/support scoped credential và email đã xác minh.
Browser push cần opt-in riêng và service worker/provider; ngoài baseline, không gọi alert browser là push đã có.

## 6. Media, NFC và vận chuyển
MediaProvider storage riêng (S3-compatible/Cloudinary do owner chọn), file type/size validate,
không lưu uploads vào filesystem ephemeral Render. Signed upload + server finalize;
virus scan nếu cho attachment; allowlist MIME, strip metadata ảnh, không SVG/HTML tùy ý.
NFC là tag mở HTTPS URL story published; fallback QR/manual URL, không yêu cầu browser Web NFC.
Mapping random serial/slug tới version story, draft không public, revoked/unpublished có trang phù hợp.
Mất/clone tag không được dẫn tới rò rỉ danh tính người mua.
Vận chuyển baseline staff nhập carrier/tracking và sự kiện thủ công; chưa claim live carrier integration.
Đơn ceramics cần trọng lượng/kích thước/đóng gói, hướng dẫn hư vỡ và return policy do owner duyệt.
