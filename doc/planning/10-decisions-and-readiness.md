# Quyết định, mặc định phát triển và điều kiện mở bán

## Đã xác nhận trực tiếp bởi chủ dự án
- ReactJS, NodeJS/Express, MongoDB Atlas; ba thư mục fondend/backend/doc và folder src theo ảnh.
- Customer/staff/admin, admin làm được mọi nghiệp vụ staff; guest mua và có giỏ/tra cứu/liên hệ.
- Địa chỉ có collection và trang riêng, gồm người nhận/phone và chọn vị trí hiện tại.
- Customer đơn/review/khiếu nại/hỗ trợ; staff xử lý đơn/chăm sóc/dashboard; admin product/user/status/role/log.
- User bị khóa có màn yêu cầu xem xét kháng nghị; hệ thống thông báo.
- Nghiệp vụ tham khảo Ha Thành Vị; phong cách tham khảo Thành Nam Hương Ký và Sắc Cố Đô.
- Logo thực trong workspace; NFC Storytelling và hai dòng gốm theo brief.
- Một người được tự review/merge; sau thêm người mới cần duyệt độc lập. Commit giữ Conventional Commits.
- Agy ưu tiên /teamwork-preview + Gemini 3.8 Flash High khi khả dụng; Claude CLI chỉ custom model/max
  do người dùng cấu hình, không tự chuyển profile/model.

## Mặc định thiết kế để agent triển khai không phải chờ câu hỏi nhỏ
| Quyết định | Mặc định | Cách điều chỉnh |
| --- | --- | --- |
| Ngôn ngữ | vi trước, cấu trúc sẵn i18n; EN không giả dịch nội dung chưa có | Owner cung cấp/duyệt bản dịch |
| Sale mode | buy/quote/both theo SKU/product; giá chưa chốt thì quote/draft | Admin cấu hình, không dựa duy nhất vào line |
| Checkout guest | Không login; email, tên, phone, địa chỉ nhận hợp lệ | Không SMS provider mặc định; OTP email để phục hồi truy cập |
| Guest lookup | Human order code + token/OTP; sau verify xem đầy đủ dữ liệu customer-facing | Không lấy code+phone làm secret đủ mạnh |
| Claim guest order | Login email verified trùng contact + challenge chứng minh đơn | Không auto-attach đơn chỉ theo phone/email chưa verify |
| Auth | Cookie opaque server sessions, CSRF và ownership | Không JWT localStorage làm mặc định thay thế |
| Payment | PayOS khi configured; COD theo settings shop | Thiếu credentials disable online payment rõ ràng |
| Shipping | Staff/manual carrier tracking, phí do shop cấu hình | Carrier adapter ở giai đoạn sau |
| Stock | Theo SKU, reserve khi checkout, expire unpaid theo config | paid stock allocation không bị job unpaid-release nhả |
| Quotes | Lead doanh nghiệp quản lý riêng, chưa tạo đơn/giữ tồn từ form | Conversion quote cần acceptance/expiry/price theo contract |
| Refund | Staff đề xuất, admin duyệt; settlement có evidence, không auto-payout | Provider refund/payout mở sau xác minh API/quyền |
| Review | Customer đã nhận order item; moderation có lý do, không review giả | Chính sách thời gian do owner cấu hình |
| Support | Ticket persistent + thread/assignment, AI optional và human handoff | Polling baseline, realtime nâng cấp |
| Notifications | In-app + transactional email outbox | Browser push/SMS ngoài baseline |
| Location | User opt-in, backend reverse-geocode adapter, manual fallback | Provider/key/billing chốt trước live |
| Staff/admin mua cá nhân | Có self-service qua capability như customer; ownership như bình thường | Không staff shortcut refund/approve đơn mình |
| User lock | Full sessions revoke; restricted appeal. Guest public còn được | Không hứa chống cùng người guest ẩn danh tuyệt đối |
| Last admin | Chặn khóa/demote/archive admin active cuối trong transaction | Break-glass recovery do owner vận hành |
| Delete sản phẩm/user | Archive/soft-delete khi đã có tham chiếu đơn/log | Không cascade xóa lịch sử mua/tài chính |
| NFC | URL story published + tag opaque, QR fallback | Không tuyên bố chống giả chỉ bằng URL |

## DEC-17 — Catalog filters and versioned product updates

The frozen OpenAPI omitted two requirements already present in PUB-02 and the admin product workflow: public filtering by `saleMode`/inventory availability, and `expectedVersion` on product updates. The admin `ProductPatch` schema already exists, so the PATCH operation now uses it; product creation remains `ProductWrite`.

`GET /products` accepts the existing `saleMode` enum and an optional boolean `available`. `available=true` selects products purchasable from current available inventory; `available=false` selects buyable products with no available inventory. Quote-only products are excluded when `available` is supplied. The response continues to expose only `availableForPurchase`/`stockLabel`, never reserved quantities. Availability reads use the P05 inventory port; without that port the service must fail closed rather than infer stock from Product.

Consumer impact: P04 implements query validation/filtering and PATCH version checks; P05 provides authoritative availability reads. This is additive and requires no data migration or new enum, route, role, or permission. Contract baseline commit remains the P01 baseline; the amendment is recorded in `doc/contracts/manifest.json`.

## DEC-18 — Media storage unavailable response

The admin media upload route must report an unconfigured or unavailable storage provider truthfully. Add the `MEDIA_UNAVAILABLE` error code to the documented 503 provider-unavailable set and shared error middleware. P04 returns this code until a storage provider is configured; it does not fabricate an uploaded asset or URL. Consumer impact is P04 and clients of `POST /admin/media`. The existing error envelope is unchanged; no data migration, new enum, route, role or permission is required.

## Đầu vào owner cần cung cấp trước production
Không bắt agent dừng mọi việc vì thiếu các mục này; triển khai adapter/test/fallback và content draft trước,
nhưng không tuyên bố đã mở bán hoàn chỉnh khi chưa có:

| ID | Đầu vào | Ảnh hưởng | Agent có thể hoàn tất trước |
| --- | --- | --- | --- |
| R01 | Domain frontend/API, account Vercel/Render và quyền deploy | Live session/CORS/deploy | Local/staging contracts/runbook |
| R02 | Atlas URI/DB user/access list từ owner cấu hình env | DB live | Replica-set test DB, Mongoose/index migration |
| R03 | Danh mục SKU, giá, tồn thật, saleMode, ảnh/quyền dùng, kích thước/trọng lượng | Checkout/catalog live | CMS/admin/fixtures gắn nhãn/draft |
| R04 | Mailbox SMTP/from/shop recipient | Email/OTP/deliverability | Outbox/template/stub tests |
| R05 | PayOS merchant verified/key/checksum/webhook | Thanh toán online live | Adapter/webhook/tests/reconciliation |
| R06 | Phí/vùng ship, COD, xử lý hư vỡ/đổi trả/hoàn tiền, retention, chính sách công khai | Checkout cam kết thật | Settings/UI gates/policy versioning |
| R07 | Contact shop, địa chỉ/hotline/social thật | Liên hệ public | Contact form + private queue |
| R08 | Nội dung nghề/nghệ nhân/hoa văn/nguồn story và mapping NFC | Story public và print/tag | CMS/versioning/public published gate |
| R09 | Geocoding provider/key/quota/billing, dataset hành chính | Location-to-address live | Browser permission/manual fallback/provider stub |
| R10 | Gemini key/model thực khả dụng và ngân sách | AI live | Redaction/grounded retrieval/adapter/human fallback |
| R11 | Media storage/provider, backup/retention/RPO/RTO | Upload bền vững/operations | Signed upload contract/storage stub |
| R12 | Bootstrap admin owner + quy trình phục hồi | Vận hành an toàn | Script hướng dẫn, tests last-admin/lock |

Tự chọn provider có phí, gửi email khách thật, tạo thanh toán/hoàn tiền thật, seed/migrate/xóa DB
production hoặc deploy live cần scope/credential phù hợp; không suy ra từ quyền lập tài liệu.
Không hỏi chủ dự án gửi secret vào chat: hướng dẫn điền environment trực tiếp.

## Kiểm soát thay đổi cho phát triển song song
Phân biệt business defaults với provider capability. Đổi enums/payloads/indexes/route names cần
integrator ghi Decision ID, cập nhật 01/02/04/05/07 và contract fixtures cùng lúc trước merge.
Chủ dự án có thể thay mặc định bất kỳ lúc nào; các agent không tự tạo những phiên bản đặc tả khác nhau.
Khi chưa chắc nguồn: ghi unknown, dùng nguồn chính thức/subagent xác minh; không viết “research xong”
nếu công cụ bị quyền/quota/timeout. Open questions không phải lý do bỏ dở nền tảng đã rõ.
