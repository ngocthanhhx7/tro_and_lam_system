# Quyết định, mặc định phát triển và điều kiện mở bán

## Đã xác nhận trực tiếp bởi chủ dự án
- ReactJS, NodeJS/Express, MongoDB Atlas; ba thư mục fondend/backend/doc và folder src theo ảnh.
- Customer/staff/admin; theo yêu cầu mới nhất ngày 08/10/2026, admin và staff có workspace/quyền server riêng, customer không được vào hai workspace; guest mua và có giỏ/tra cứu/liên hệ.
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

The frozen OpenAPI omitted two requirements already present in PUB-02 and the admin product workflow: public filtering by `saleMode`/inventory availability, and `expectedVersion` on product updates. The frozen `ProductPatch` schema already exists, so the PATCH operation uses it; POST remains `ProductWrite`.

`GET /products` accepts the existing `saleMode` enum and optional boolean `available`. `available=true` selects products purchasable from current available inventory; `available=false` selects buyable products with no available inventory. Quote-only products are excluded when `available` is supplied. The response continues to expose only `availableForPurchase`/`stockLabel`, never reserved quantities. Availability reads use the P05 inventory port; without that port the service fails closed rather than infer stock from Product.

Consumer impact: P04 implements query validation/filtering and PATCH version checks; P05 provides authoritative availability reads. This is additive and requires no data migration or new enum, route, role, or permission. Contract baseline commit remains the P01 baseline; the amendment is recorded in `doc/contracts/manifest.json`.

## DEC-18 — Media storage unavailable response

The admin media upload route reports an unconfigured or unavailable storage provider truthfully. `MEDIA_UNAVAILABLE` is in the documented 503 provider-unavailable set and shared error middleware. P04 returns this code until a storage provider is configured; it does not fabricate an uploaded asset or URL. Consumer impact is P04 and clients of `POST /admin/media`. The existing error envelope is unchanged; no data migration, new enum, route, role or permission is required.

## DEC-19 — Audit-log date range filters

The frozen OpenAPI omitted `from` and `to` from `GET /admin/audit-logs`, although planning 03 ADM-07 and 05 already require time filtering. `GET /admin/audit-logs` has optional ISO `date-time` query parameters with the existing names. The service filters by `createdAt`, validates timestamps and rejects an inverted range. No route, response, role, permission, or business enum changes; this is additive and needs no migration. Consumer: P09.

## DEC-20 — Business settings key allowlist

`PATCH /admin/settings` uses a schema allowlist; 04/05/10 limit the collection to shipping zones/fees, COD, checkout limits, and support windows. The top-level `values` keys are `shippingZones` (array), `codEnabled` (boolean), `checkoutLimits` (object), and `supportWindows` (object); empty patches and unknown top-level keys are rejected. Values remain inert business data: secrets, provider URLs/credentials and executable content are forbidden. No route, role, permission or enum change. P09 owns the validator/UI; P05 consumes configured checkout values. Actual fees, zones and policies remain owner-supplied input R06.

## DEC-21 — Bounded story and page content blocks

The frozen StoryWrite/PageWrite DTOs declared content arrays without item schemas, while planning 03/04/08 require safe rich text and an allowlist. The P08 text-only block variants and bounds are specified in 05 and `dtos.schema.json`: paragraph/heading/quote, list, image, and link; URLs are restricted to same-origin paths or credential-free HTTPS; unknown properties are rejected. Existing top-level DTO fields, status values, routes and permissions remain unchanged. The schema describes structured text; HTML is not passed to a browser parser. P08 implements these rules; P10 reads only published content. Draft/publish eligibility and product references remain as described in 04/05. No data migration is needed; pre-existing records must be validated before publication.

## DEC-22 — Unconfigured low-stock threshold

The staff dashboard contract includes `lowStock`, but the inventory model does not define a reorder threshold and no owner-approved value is available. Return `lowStock: null` and label it unconfigured until a later decision supplies that value; never report zero as if it were measured. This adds no setting, threshold field, route, enum, or permission. Consumer: P09; future threshold configuration requires a new coordinator amendment and owner input.

## DEC-23 — Published story lookup by product reference

Products store an optional `storyId`, while the public product detail may include the linked story. The internal P08 service port `getPublishedStoryById(storyId, { session })` returns the existing safe story DTO only when that record is published and otherwise returns not found. The lookup preserves the locale of the referenced record; it does not invent a translation or fallback. This is an internal service port only: no public route, API DTO, enum, role, permission, or migration changes. Consumers: P08 implements the resolver and P04 uses it from the product detail service.

## DEC-24 — Guest order restricted-proof identity port

P05 owns order-access OTP challenges because issuing a challenge requires matching an order code and its email without revealing whether either exists. After successful OTP verification, P05 uses P02's internal `createGuestOrderProof({ orderId, identityVerifiedAt, session })` port; it does not mint or persist identity credentials itself. P02 exposes `authenticateGuestOrderProof(token)` to validate the stored token hash, purpose, order scope, expiry and revocation, `requireGuestOrderProof(scopes)` middleware for guest-order routes, and `revokeGuestOrderProofs(orderId, { session })` for atomic guest-order claim. P05 sets the proof only in an HttpOnly cookie with a dedicated configured cookie name separate from the appeal credential. These internal ports add no public route, DTO, role, permission, or enum; the existing `/order-access/challenges` and `/order-access/verify` contract operations remain P05-owned.

## DEC-25 — Immutable COD collection evidence

The existing `CodCollectionCreate` requires an evidence reference, but Order has no field for immutable collection records. P05 stores one immutable successful full-balance collection in a P05-owned `cod_collections` collection (`orderId`, `amountVnd`, `evidenceReference`, `idempotencyKey`, `recordedBy`, `recordedAt`) with a unique `orderId` index. In the same Mongo transaction, the service validates COD eligibility and exact outstanding balance, writes the collection, and compare-and-sets Order `paymentStatus`/`paidAmountVnd`; partial COD capture remains disabled. Same-key retries replay the committed result and a different key cannot collect twice. Public request/response fields, enums and permissions do not change. Migration adds the collection index; existing Orders are unaffected. Consumer: P05.

## DEC-26 — Address update uses the partial DTO

The account workflow and existing `AddressPatch` schema require `expectedVersion` and permit updating only supplied fields, but `PATCH /account/addresses/{id}` referenced the create-only `AddressWrite` DTO in OpenAPI. The operation references `AddressPatch`, which is exposed as an OpenAPI component. No route, field, permission, enum or storage change. Consumer: P03.

## DEC-27 — Configured pending COD limit

Planning requires a configurable cap on pending COD orders to limit held-stock abuse, but DEC-20 left the nested `checkoutLimits` object unbounded. Freeze `checkoutLimits.maxPendingCodOrders` as an optional positive integer with no default; an absent value disables COD checkout until the owner configures it. P09 validates and edits only this allowlisted key; P05 reads the configured value when enforcing the per-principal/guest limit. This adds no top-level settings field, route, enum or permission. R06 owner policy and value still gates live COD.

## DEC-28 — Configured shipping-zone quote adapter

`shippingZones` was reserved for owner-supplied fees, but its item structure was unspecified and checkout had no configured-zone quote adapter. Each item is exactly `{id, provinceNames, feeVnd}`; `id` is a unique lowercase slug, `provinceNames` is a non-empty list of exact names unique across zones after case, Vietnamese diacritic and whitespace normalization, and `feeVnd` is a non-negative safe integer. P09's existing settings validator and editor enforce that shape; P05 quotes only an exact normalized match against the recipient's structured `province`. Missing, malformed, ambiguous or unmatched configuration fails closed. Empty zones remain valid to disable quotes. No route, top-level field, enum, role, permission or migration changes. Actual zones and fees remain owner-supplied R06 inputs.

## DEC-29 — Customer account details, notification groups, and admin-issued vouchers

The owner requested complete customer self-service and selected admin-issued vouchers that customers use during checkout. Add optional `birthDate` (`YYYY-MM-DD`) and `gender` (`female`, `male`, `other`, `prefer_not_to_say`) to self-profile updates. Email changes require the current password, a one-time code sent to the new email, an unused email address, and verification from the same authenticated account that requested the challenge; success revokes every session. Password changes verify the current password and revoke every session.

Customer notifications expose three groups: `order`, `promotion`, and `system`. Stored legacy `support`/`account` categories remain readable and are presented under `system`; the new stored `promotion` category is used for voucher issuance.

Admins issue one-use vouchers to an active customer email and may revoke an available voucher. Voucher data is limited to a code, title, fixed VND or percentage discount (1–100), optional percentage cap, optional minimum item subtotal, and expiry. Checkout computes the discount against item subtotal before shipping. Checkout quotes and redeems the voucher using server data, and redemption shares the order transaction. A canceled order before shipment restores its voucher while it remains valid. The order stores a voucher snapshot. No automatic issuance, sample voucher, stacking, or guest redemption is added. No default discount value or campaign is created.

Consumers: P02, P05, P09 and customer/admin frontend. Migration adds the `vouchers` collection and indexes; existing orders and users need no rewrite. The OpenAPI amendment is recorded in the contract manifest.

## DEC-30 — Admin revenue trend from settled ledger events

The admin dashboard's date-scoped revenue visualization is built from persisted payment receipts, not order totals or fixture/reference-image values. `GET /admin/statistics` accepts required inclusive `from`/`to` instants spanning at most 367 Asia/Ho_Chi_Minh calendar dates. Results add gross collected totals grouped by Asia/Ho_Chi_Minh calendar day for the selected period and an equal-duration immediately preceding period. The response contract is described by `AdminStatistics` in `doc/contracts/openapi.yaml` and the `adminStatistics` schema in `doc/contracts/schemas/dtos.schema.json`; validation has passed with two statistics DTO fixtures. PayOS amounts count only when the payment event is `applied` at `verifiedAt`; COD counts only immutable recorded collections at `recordedAt`. Refunds remain separate and are not included in the gross-collection trend. Zero-activity dates are represented as zero; an unavailable/inconsistent ledger remains an API error and is never presented as a fabricated zero. The frontend presents comparison dates explicitly, accessible keyboard/touch selection and a table alternative. No new data collection, migration, or visualization dependency is introduced. Consumers: P09 and admin dashboard API clients. Acceptance: A-FIN-01 in planning 08 and the release acceptance matrix.

## DEC-31 — Role-specific workspace landing and shared admin navigation

Successful login and invitation acceptance route customers to `/tai-khoan`, staff to `/staff`, and admins to `/admin`. Existing admin destinations share a responsive navigation shell; each route retains its current role/capability guard, and the shell does not introduce routes or substitute sample business data. This is a frontend routing/layout change only and requires no migration.

## DEC-32 — Admin-requested password reset link

`POST /admin/users/:id/password-reset` is restricted to an active admin with `users.manage` and CSRF validation. Its strict body accepts only a required reason. A single-use opaque reset token is stored only as a hash and placed in the existing encrypted mail outbox for the target account's verified email; the raw token is not returned or audited. A persistent per-target cooldown applies. The request consumes prior pending reset challenges but does not change password, status, auth version, or sessions. The existing reset completion flow remains the only operation that changes the password and revokes sessions. The request, outbox enqueue and redacted audit record are transactional. The cooldown timestamp uses the existing identity guard collection; no collection migration is required.

Consumers: P02 and the admin identity frontend. OpenAPI and the contract manifest record the endpoint and strict DTO; contract validation fixtures cover accepted reason-only and rejected credential-bearing requests.

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
| R07 | Hotline/Zalo `0966051231` và Facebook `gomchudautrovalam` đã được chủ dự án cung cấp trong hồ sơ kênh liên hệ; địa chỉ cửa hàng, email và giờ làm việc vẫn cần xác nhận | Liên kết Hotline/Zalo/Messenger public dùng đúng nguồn hiện có; không tự điền các chi tiết còn thiếu | Contact form + private queue và các liên kết nhanh đã tích hợp; cần chủ dự án xác nhận các chi tiết liên hệ còn thiếu trước production |
| R08 | Nội dung nghề/nghệ nhân/hoa văn/nguồn story và mapping NFC | Story public và print/tag | CMS/versioning/public published gate |
| R09 | Geocoding provider/key/quota/billing, dataset hành chính | Location-to-address live | Browser permission/manual fallback/provider stub |
| R10 | Gemini key/model thực khả dụng và ngân sách | AI live | Redaction/grounded retrieval/adapter/human fallback |
| R11 | Media storage/provider, backup/retention/RPO/RTO | Upload bền vững/operations | Signed upload contract/storage stub |
| R12 | First-admin bootstrap and recovery | The one-time script, runbook, and local replica-set concurrency test exist; owner verification and break-glass rehearsal remain required |

Tự chọn provider có phí, gửi email khách thật, tạo thanh toán/hoàn tiền thật, seed/migrate/xóa DB
production hoặc deploy live cần scope/credential phù hợp; không suy ra từ quyền lập tài liệu.
Không hỏi chủ dự án gửi secret vào chat: hướng dẫn điền environment trực tiếp.

## Kiểm soát thay đổi cho phát triển song song
Phân biệt business defaults với provider capability. Đổi enums/payloads/indexes/route names cần
integrator ghi Decision ID, cập nhật 01/02/04/05/07 và contract fixtures cùng lúc trước merge.
Chủ dự án có thể thay mặc định bất kỳ lúc nào; các agent không tự tạo những phiên bản đặc tả khác nhau.
Khi chưa chắc nguồn: ghi unknown, dùng nguồn chính thức/subagent xác minh; không viết “research xong”
nếu công cụ bị quyền/quota/timeout. Open questions không phải lý do bỏ dở nền tảng đã rõ.
