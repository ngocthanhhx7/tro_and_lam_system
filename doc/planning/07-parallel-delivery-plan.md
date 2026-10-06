# TRO & LAM — kế hoạch phát triển song song

> **For agentic workers:** dùng skill `subagent-driven-development` hoặc `executing-plans` phù hợp môi trường để triển khai từng package. Chủ dự án đã cho phép nhiều agent và tự merge giai đoạn một người. Bảng dưới là kế hoạch gốc; trạng thái source/evidence hiện hành được cập nhật ở cuối tài liệu.

**Goal:** hoàn thiện website public, guest checkout, customer portal, staff dashboard và admin portal theo hợp đồng đã chốt, có kiểm thử và hướng dẫn production.

## Trạng thái tích hợp (2026-10-06)

Các package P01–P11 đã có implementation trong source tích hợp. Điều đó không đánh dấu package hoặc release là hoàn tất: acceptance, owner input, clean-checkout và provider gates bên dưới vẫn có thể còn mở. Chi tiết test nằm trong [`doc/release/README.md`](../release/README.md) và [`doc/release/acceptance-coverage.md`](../release/acceptance-coverage.md).

| Package | Trạng thái source | Cổng còn mở |
| --- | --- | --- |
| P01 | Contract, composition, lỗi chuẩn hóa và test harness tích hợp | Clean-checkout đã qua tại `61e6bd4`; CI/release configuration |
| P02 | Identity, email verification, RBAC, appeal và admin bootstrap có tests | Chạy replica-set suite trong CI; SMTP thật, owner xác nhận mailbox/bootstrap/recovery |
| P03 | Address, guest/customer cart, ownership, merge và manual geolocation fallback có tests | Browser geolocation và geocoder staging |
| P04 | Catalog public/admin, demo seed và storefront hai dòng sản phẩm tích hợp | SKU/giá/tồn kho/ảnh sản phẩm thật và quyền media cần chủ dự án duyệt |
| P05 | Order, checkout, reservation, guest proof, fulfillment/COD và race suite có; shipping-zone quote đã nối composition, có E2E guest COD và idempotent retry trên test DB riêng | Chủ dự án nhập/duyệt vùng phí và COD thật theo R06; mail staging/UAT; đưa replica-set suites vào CI |
| P06 | PayOS adapter, payment/refund ledger và webhook handling có tests | PayOS sandbox/merchant/webhook và CI replica-set |
| P07 | Contact, ticket, review, return và moderation logic có tests | Browser UAT, storage staging và SMTP |
| P08 | CMS/story locale, NFC routing and safe-content handling have tests; P11 browser acceptance now covers draft/published locale visibility and active/revoked NFC behavior | Owner approval of cultural sources, content and media rights; broader UAT |
| P09 | Notifications, audit, metrics và encrypted SMTP outbox/worker có tests | SMTP staging/deliverability, worker supervision và audit persistence UAT |
| P10 | Assistant grounding, redaction, injection guards, truthful fallback and Gemini adapter have tests; P11 browser acceptance verifies guest fallback and handoff option with provider disabled | Gemini credentials/quota/staging and owner UAT |
| P11 | E2E harness, acceptance matrix and release evidence; browser flows cover guest/customer commerce, identity/logout/appeal, staff/admin boundaries, support/reviews, published story/NFC, assistant fallback, and axe checks on public routes/mobile navigation | Manual screen-reader/WCAG, owner UAT, provider staging and restore gates |

`feature/interface-refresh` có các commit implementation `4529fda` (Mongoose/index), `28103f3` (catalog seed), `3b35180` (storefront/media) và release evidence; đã fast-forward vào `develop` tại `9cc3a51`. Source code revision `0fb7d9d` qua `npm run check` với 185/185 tests và `npm run test:e2e` 6/6; commit cuối cập nhật riêng trạng thái merge. Xem [`doc/release/interface-refresh-evidence.md`](../release/interface-refresh-evidence.md). Không push hoặc deploy production.

Rà soát các worktree `feature/p01-contracts` đến `feature/p11-release`: cả 11 worktree hiện sạch. P01–P06, P08–P09 đã nằm trong lịch sử `develop`; thay đổi P07, P10 và P11 có patch tương đương trong `develop` dù commit graph dùng cherry-pick. Không còn patch package nào đang chờ tích hợp trong các worktree đó.

**P05 shipping quote follow-up:** commits `078e555` and `12c68ea` were fast-forwarded to `develop` at `12c68ea`. DEC-28 freezes the existing `shippingZones` business-setting field item shape and fail-closed province matching. Local `npm run check` passed 195 backend tests with 0 skipped; `npm run test:e2e` passed 11/11, including unconfigured 503, test-database-only COD quote/order, and guest proof-cookie access to the created order detail. All dedicated P02/P05/P06/P11 databases were removed after verification. Actual shipping/COD policy values remain owner input R06; no production deployment occurred. See [release evidence](../release/README.md#shipping-zone-quote-and-guest-cod-checkout-follow-up-2026-10-06).

**P11 guest order OTP follow-up:** `feature/p11-guest-order-otp-acceptance` adds browser evidence for generic order lookup and OTP verification through the real application and encrypted synthetic outbox. `npm run test:e2e` passed 12/12; `npm run check` passed 195 backend tests with 0 skips. The test reads the synthetic code from the test database; it does not claim SMTP delivery. Dedicated local P02/P05/P06/P11 test databases were removed after verification. See [release evidence](../release/README.md#guest-order-lookup-otp-browser-follow-up-2026-10-06).

**P05 checkout idempotency follow-up:** P11 E2E retries the successful guest checkout with the exact original key and body (HTTP 200, same order ID/code), then reuses the key with a changed body (HTTP 409 `IDEMPOTENCY_CONFLICT`). The browser helper sends JSON bodies and OTP wrong/missing-credential assertions require actual HTTP 403 `FORBIDDEN`. `npm run test:e2e` passed 12/12; `npm run check` passed 195 backend tests with 0 skips. CI replica-set and owner network-interruption UAT remain open; no production deploy occurred. See [release evidence](../release/README.md#p05-guest-checkout-idempotency-browser-follow-up-2026-10-06).

**P11 notification follow-up:** the isolated browser suite verifies customer notification ownership, foreign-owner 404, mark-one and mark-all persistence. `npm run test:e2e` passed 13/13 and `npm run check` passed 195 backend tests with 0 skips. Fixtures are synthetic in a disposable loopback database; notification projection and owner UAT remain open. See [release evidence](../release/README.md#p11-notification-ownership-browser-follow-up-2026-10-06).

**P11 support-ticket follow-up:** browser acceptance covers customer order-linked ticket creation, staff assignment, customer-visible reply, internal note privacy, customer response and persisted thread state. Customers cannot write internal notes (403) and never receive internal staff messages in their thread. Attachment storage/provider staging and owner workflow UAT remain open. See [release evidence](../release/README.md#p11-support-ticket-browser-follow-up-2026-10-06).

**P11 review moderation follow-up:** the integrated browser test submits a review for a delivered order, verifies it remains private while pending, publishes it as admin, and confirms the public and customer views plus moderation audit after persistence. The expanded suite passes 15/15; `npm run check` passes 195/195 backend tests with 0 skips. Moderation UAT and the broader provider/accessibility/restore release gates remain open. See [release evidence](../release/README.md#p11-review-moderation-browser-follow-up-2026-10-06).

**P11 registration verification follow-up:** the integrated browser test registers a synthetic customer, opens the verification link from the encrypted test outbox, verifies the account, confirms the redirect to login, and signs in. `npm run test:e2e` passes 16/16 and `npm run check` passes 195/195 backend tests with 0 skips. It does not verify Gmail/SMTP delivery. See [release evidence](../release/README.md#p11-registration-and-email-verification-browser-follow-up-2026-10-06).

**P11 blocked-account appeal follow-up:** the browser suite covers admin block, blocked customer login denial and appeal, admin approval with persisted audit, auth-version invalidation and fresh customer login. The full browser suite passes 17/17 and `npm run check` passes 195/195 backend tests with 0 skips. Rejection/resubmission UAT and owner release gates remain open. See [release evidence](../release/README.md#p11-blocked-account-appeal-and-admin-decision-browser-follow-up-2026-10-06).

**P11 password reset follow-up:** the browser suite uses the encrypted test outbox link, confirms the one-time challenge and all old sessions are revoked, and proves the old password fails while the new password works. The expanded E2E suite passes 18/18; Gmail/SMTP delivery remains a staging gate. See [release evidence](../release/README.md#p11-password-reset-browser-follow-up-2026-10-06).

**P11 logout follow-up:** customer desktop/mobile navigation and staff/admin workspaces now expose shared logout controls. The mobile browser acceptance clicks the customer control, verifies HTTP 204, login redirect, HttpOnly cookie removal, `401 AUTH_REQUIRED`, and persisted server-session revocation. Integrated `npm run check` passes 195 backend tests with 0 skips; E2E passes 21/21. See [release evidence](../release/README.md#customer-and-workspace-logout-controls-2026-10-06).

**P08/P10/accessibility browser follow-up:** the P11 suite publishes a synthetic story through the real admin API, checks locale visibility and active/revoked NFC rendering, and verifies the guest assistant fallback with Gemini disabled. Axe 4.13.0 scans nine public routes at 390px and 1280px plus the open mobile menu with no selected WCAG violations; Escape restores focus. Clean-worktree `npm ci`, `npm run check` (195/195, 0 skips), and E2E (24/24) pass. No live provider was called. Manual screen-reader/full WCAG review and owner approval remain open. See [release evidence](../release/README.md#p08p10-and-storefront-accessibility-browser-acceptance-2026-10-06).

**Architecture:** React+Vite ở `fondend`, Express+Mongoose theo lớp `backend/src`, Atlas lưu transactional commerce. Các domain có folder riêng dưới từng lớp, route fragments+service ports giúp agent triển khai độc lập; chỉ integrator sửa composition root.

**Tech Stack:** JavaScript ESM, React, Node 24.x theo scaffold, Express, Mongoose, MongoDB Atlas; SMTP/PayOS/Gemini/geocoder dùng adapter. Không tự chuyển TypeScript hay rename `fondend`.

## 1. Điều phối và quy tắc chống xung đột

- **Integrator I** sở hữu `package.json`, `package-lock.json`, workspace package manifests, eslint/CI, `backend/src/app.js`, `server.js`, config/env, `fondend/src/main.jsx`, `app/App.jsx`, `routes/AppRoutes.jsx`, `services/httpClient.js`, `styles/global.css`, layouts dùng chung, `doc/planning` và contract schema. Agent chỉ đề xuất dependency qua handoff; I cài/gộp lock một lần theo wave.
- Mỗi agent dùng checkout/worktree riêng và `feature/<package-name>` từ cùng contract baseline develop. Không nhiều agent cùng sửa shared working tree, không push trực tiếp main/develop, không force push. Kiểm tra AGENTS.md trong checkout trước làm. Dùng PR vào develop, commit `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` một dấu `:`.
- Trong giai đoạn chỉ chủ dự án: I được tự review+merge theo ủy quyền đã có; không chặn chờ reviewer thứ hai. Khi có thành viên mới, reviewer độc lập+leader final merge trở lại. Agent review kỹ thuật hỗ trợ chất lượng, không giả approval con người.
- Đóng băng [04-data-model.md](04-data-model.md), [05-api-contracts.md](05-api-contracts.md), OpenAPI/schema và design tokens ở P01. Ghi **contract baseline commit thật** trong `doc/contracts/manifest.json`; không điền hash giả. Amendment ghi lý do+consumer bị ảnh hưởng+migration, I chốt rồi agent rebase; không tự đổi enums/DTO/cookie trong module.
- Module routes backend export `create<Domain>Router({ports,config})`; UI export named route fragment array trong `fondend/src/routes/modules/<domain>.routes.jsx`. **Không agent nào sửa AppRoutes/app.js ngoài I.** Route guard dùng AuthContext P02; module chỉ import API client/tokens đã freeze, không tạo auth riêng.
- File allocation dưới đây là ranh giới quyền sửa. Public shell/catalog P04; forms checkout P05; account addresses/cart P03; order payment widgets P06; admin module pages thuộc domain của package. I ráp shell Staff/Admin; tránh một admin agent đồng thời sửa trang product/user của agent khác.
- Không tự dùng model override cho subagent trừ cho phép cụ thể. Nếu research nghiệp vụ/web: kiểm tra Agy help/model khả dụng, `/teamwork-preview`, ưu tiên Gemini 3.8 Flash High theo yêu cầu; lỗi quyền/quota/no result ghi rõ và fallback nguồn chính thống/subagent. Claude CLI chỉ đúng custom model/profile mức max đã cấu hình; thiếu cấu hình báo chủ dự án, không đổi model. Không coi tên model yêu cầu là bằng chứng model có trên máy.

## 2. Task board có thể giao ngay

Mỗi path relative workspace; `<layer>/<domain>/` là folder thật dưới cấu trúc hiện có. BE layer = models/controllers/services/routes/validators (thêm middleware domain khi ghi rõ). Tests tách `backend/tests/<domain>/`, UI `fondend/src/<domain files>.test.jsx` hoặc `fondend/tests/<domain>/` sau I chốt runner. Độ lớn package là planning unit; agent tách task 2–5 phút khi bắt đầu theo acceptance bên dưới.

| ID / owner | Deliverable và ranh giới file | Phụ thuộc | Chứng minh cần bàn giao |
| --- | --- | --- | --- |
| P01 / I | `doc/contracts/{openapi.yaml,manifest.json,schemas/*}`, `backend/src/utils/{apiResponse,serviceError}.js`, shared middleware/error, config, router composition, UI API client/router/layout/design token; dependency/test runner | none | schema validation, health legacy, standardized error/requestId, frozen baseline |
| P02 / Auth agent | BE `<layer>/identity/`, `middlewares/identity/`; UI `contexts/AuthContext.jsx`, `hooks/identity/`, `pages/identity/`, `pages/account/ProfilePage.jsx`, `pages/admin/users/`, `pages/admin/appeals/`, `routes/modules/identity.routes.jsx`, `services/identity/` | P01 | register/verify/login/reset/logout, role/status revocation, blocked screen+appeal+last-admin race; RBAC/CSRF suite |
| P03 / Account-cart agent | BE `<layer>/account/` (Address, Cart, cart merge, geo proxy); UI `pages/account/addresses/`, `pages/cart/`, `components/address/`, `services/account/`, `routes/modules/account.routes.jsx` | P01; P02 port for auth; P04 pricing port | CRUD/default address, geolocation deny/manual, guest cookie isolation, idempotent merge and owner checks |
| P04 / Catalog-public agent | BE `<layer>/catalog/`; UI `pages/public/`, `pages/catalog/`, `pages/admin/catalog/`, `components/catalog/`, `services/catalog/`, `routes/modules/catalog.routes.jsx` | P01; P05 inventory read port; P08 story DTO | published filters/search/pagination, quote-only CTA, admin CRUD/archive/media, responsive public catalog; no stock writes |
| P05 / Order-inventory agent | BE `<layer>/commerce/`, `jobs/commerce/` excluding provider jobs; UI `pages/checkout/`, `pages/account/orders/`, `pages/guest/`, `pages/staff/orders/`, `components/orders/`, `services/commerce/`, `routes/modules/commerce.routes.jsx` | P01; P02/P03 owner+address+cart ports; P04 product port; P06 payment port; P09 outbox port | quote/create/lookup/cancel/transitions, reservations/concurrency, totals snapshots, COD proof, traceable staff queue |
| P06 / Payment agent | BE `<layer>/payments/`, `jobs/payments/`, `services/integrations/payos/`; UI `pages/payment/`, `pages/admin/refunds/`, `components/payment/`, `services/payments/`, `routes/modules/payments.routes.jsx` | P01; P05 order transaction port; P09 outbox port | sandbox link/webhook/signature/dedupe/reconciliation/late paid/refund ledger tests; no fake production successful pay |
| P07 / Support-review agent | BE `<layer>/support/`, `<layer>/reviews/`; UI `pages/support/`, `pages/account/reviews/`, `pages/staff/support/`, `pages/admin/reviews/`, `components/reviews/`, `services/support/`, `routes/modules/support.routes.jsx` | P01; P02 auth; P05 order eligibility; P09 mail port | contact persist+SMTP queue, guest proof tickets, customer/internal messages, complaints/return linkage, verified review moderation |
| P08 / Content-NFC agent | BE `<layer>/content/`; UI `pages/stories/`, `pages/admin/content/`, `components/story/`, `services/content/`, `routes/modules/content.routes.jsx` | P01; P04 product links | story/page drafts/publish/archive, locale, NFC active/revoked public routing, safe rich text; no invented heritage claims |
| P09 / Operations agent | BE `<layer>/operations/`, `jobs/operations/`, `services/integrations/smtp/`; UI `components/notifications/`, `pages/notifications/`, `pages/staff/dashboard/`, `pages/admin/overview/`, `pages/admin/audit/`, `services/operations/`, `routes/modules/operations.routes.jsx` | P01; receives events/schema ports from P02/P05/P07 | outbox lease/retry/dedupe, inbox/read counts, audit redact/admin only, meaningful dashboard metrics |
| P10 / Assistant agent | BE `<layer>/assistant/`, `services/integrations/gemini/`; UI `components/assistant/`, `services/assistant/`; route fragment only if dedicated page | P01; P04/P08 published retrieval ports; P07 handoff | no PII leak/tool writes, citations from published data, unavailable mode, rate/budget limits, injection tests |
| P11 / QA-release integrator | `tests/e2e/`, CI/deploy configs, `.env.example` additions, `doc/release/`, accessibility/integration correction via owner | P02–P10 merged | npm checks+browser flows+replica-set races, release notes, config/sandbox evidence, no claims live without deployment |

Nếu số agent ít, chia theo wave; một agent có thể nhận nhiều package **tuần tự**. Không cần mở 10 agent đồng thời. Sản phẩm có thể phát triển khi PayOS/Gemini chưa cấu hình nhưng production thiếu các tích hợp bắt buộc phải hiển thị trạng thái thật và được đánh dấu chưa qua release gate.

## 3. Service ports để mock và tích hợp

P07 sở hữu attachments metadata/ACL, review lists và human handoff target ticket/contact;
P04 sở hữu media_assets public catalog/CMS. P09 sở hữu business settings allowlist+audit.
Không dùng `/admin/media` cho evidence customer/private support. Guest order proof kiểm match ticket.orderId,
không tạo credential guest-ticket chưa có trong schema. Agent phải bổ sung các endpoint này vào OpenAPI P01.

Baseline contract invariants cần mọi agent giữ: một Product/một SKU, UI variant chọn productId khác; saleMode buy/both chỉ priceVnd>0; recipientName/phone/line1/formattedAddress required, ward/province optional; full session và appeal/order restricted proof resolver tách; reservation held/committed/released (expiry metadata), COD không autoexpire và có quota pending+staff cancel, online 15 phút align provider; partial return/refund flags false; outbox 5 retry+jitter; public NFC web route `/nfc/:publicId`. Không mở extra enum/lifecycle từ narrative nghiên cứu.

P01 định nghĩa JS JSDoc/JSON schema cho các port sau; mỗi owner cung cấp real adapter, test cung cấp fake deterministic. Các fake **không** tham gia production container.

| Port / owner | Chữ ký nghiệp vụ cần freeze | Caller |
| --- | --- | --- |
| Identity / P02 | `requireActor(sessionToken) -> {id,role,status}`; `requireOwner(actor,resource)`; `createGuestOrderProof({orderId,identityVerifiedAt,session})`; `authenticateGuestOrderProof(token)`; `requireGuestOrderProof(scopes)`; `revokeGuestOrderProofs(orderId,{session})` | tất cả module; P05 order access/claim |
| Catalog / P04 | `getCheckoutProducts(ids,{session}) -> ProductForCheckout[]`; `searchPublished(query)` | P03/P05/P10 |
| Address / P03 | `getOwnedAddress(userId,addressId,{session}) -> AddressSnapshot`; `getCart(actor)` | P05 |
| Inventory / P05 | `reserve(items,orderId,{session,expiresAt})`; `release(orderId,{session,reason})`; `commitShipment(orderId,{session})`; `getAvailability(ids)` | P04/P06/order |
| Order / P05 | `getOwnedOrder(actor,id)`; `applyVerifiedPayment(paymentFact,{session})`; `requestReturn(actor,id,reason,{session})` | P06/P07 |
| PayOS / P06 | `createLink(attempt)`; `verifyWebhook(body) -> VerifiedPaymentFact`; `getProviderStatus(attempt)`; `requestRefund` **chỉ khi docs provider hỗ trợ đã xác minh**, nếu không dùng manual refund adapter | P05/reconcile |
| Operations / P09 | `appendOutbox(event,{session})`; `appendAudit(redactedEvent,{session})`; `enqueueMail(template,recipient,data,{session})` | P02/P05/P06/P07/P08 |
| Content / P08 | `getPublishedStory(slug,locale)`; `getPublishedStoryById(storyId,{session})`; `resolveNfc(publicId,locale)` | P04/P10 |
| Support / P07 | `createHandoff(actor,input)` | P10 |

`session` luôn Mongo ClientSession khi write đa collection; owner của transaction là service nghiệp vụ gốc, port không mở nested transaction. Provider HTTP gửi sau commit/qua outbox. P05/P06 phải tích hợp race bằng real transaction, không chỉ test fake port.

## 4. Wave và merge order

1. **Wave 0 — P01**: kiểm kê repo, đóng băng schema/design/route paths/test harness; install dependencies được chọn; CI chạy green. Nếu dùng library phiên bản mới phải kiểm tra official docs và compatibility; không research giả. I push contract baseline develop rồi mọi agent tạo feature branch.
2. **Wave 1 — P02/P04/P08/P09**: auth/catalog/content/operations dùng agreed ports. P03 có thể song song với mock product pricing+auth schema. Merge P02 -> P09 -> P08 -> P04 -> P03, I gắn router fragments sau từng merge. Chưa release checkout.
3. **Wave 2 — P05/P06/P07**: triển khai theo port, P05 reservation+order tạo nền; P06 provider network song song mock order port; P07 ticket/review mock order eligibility. Merge P05 core -> P06 -> P05 integration checkout UI -> P07. Không hai branch cùng sửa P05 files; handoff P05 commit rõ trước integration.
4. **Wave 3 — P10/P11**: assistant optional+end-to-end+security/accessibility, docs deployed configs. Merge P10 -> P11; critical order/payment failures chặn release dù AI pass.
5. **Release**: I rebase/merge develop, chạy required CI, PR develop->main theo Gitflow, production chỉ khi có cấu hình thật và đã sandbox/integration đủ. Đồng bộ hotfix về develop. Không coi đẩy main là deploy thành công.

Cho phép parallel implementation trước dependency merge nhờ mock/frozen schemas; **không cho phép merge consumer khi contract implementation hoặc contract tests còn lệch**. Consumer PR ghi dependency commit và những giả định còn mock.

## 5. Acceptance và bước thực thi từng package

Mỗi package nhận bảng board+contract, agent lập task nhỏ theo trình tự sau, commit từng phần có ý nghĩa. Không viết tất cả trong một commit không kiểm chứng.

- [ ] Đọc `README.md`, `doc/contributing.md`, các file planning, manifest schema, file domain đã có; kiểm tra `git status`, không ghi đè thay đổi người khác.
- [ ] Tạo route/service/model/validator file list chính xác trong ranh giới package, gửi I danh sách dependencies+composition changes cần I thực hiện.
- [ ] Viết test hành vi đầu tiên theo ma trận bên dưới; chạy đúng file và xác nhận fail do thiếu behavior (không do cú pháp/setup sai).
- [ ] Triển khai smallest slice từ validator -> service/model -> controller/router, UI dùng DTO schema. Không controller gọi DB trực tiếp; không client quyết định role/payment/price.
- [ ] Chạy test slice, kiểm tra RBAC/ownership và failure paths. Nếu cần DB, chạy replica-set fixture do I cung cấp; nếu không có thì ghi rõ concurrency chưa xác minh.
- [ ] Tạo UI loading/empty/error/403/blocked/disabled state theo actor, keyboard+mobile; render long Vietnamese text và monetary/date conventions thống nhất.
- [ ] Commit Conventional Commit; cập nhật domain README/handoff với API route list, schema, migration, env names không values, command+result và limitations.
- [ ] Chạy `npm run check` trong checkout tích hợp mới nhất; nếu bổ sung UI/E2E scripts, I cập nhật root check và mọi agent dùng script đã freeze. Không báo test passed nếu chưa chạy.
- [ ] PR vào develop, self-review diff/secret scan, I gắn module vào composition root, chạy integrated suite trước merge.

| Package | Cases tối thiểu, kỳ vọng cụ thể |
| --- | --- |
| P01 | live 200 shape cũ; ready disconnected 503 shape cũ; 404 error code; JSON quá lớn 413; validation error field; CORS origin ngoài allowlist bị từ chối |
| P02 | register chọn admin bị từ chối; password sai generic; reset single-use; stale session sau block/role change 403/401; appeal pending duplicate 409; restricted proof không được middleware full auth nhận; blocked token không gọi customer API; hai admin hạ role nhau không làm mất admin cuối |
| P03 | user A không đọc/update địa chỉ B (404); hai default concurrent vẫn đúng 1; xóa default giữ fallback; guest A/B cart độc lập; login merge retry không double quantity; geolocation denied vẫn lưu địa chỉ thủ công thiếu ward/province nhưng có line1/formattedAddress |
| P04 | draft/archived không public; q/page/sort trả stable; duplicate sku 409; quote-only không add cart checkout; product archive không phá order snapshot; staff write product 403 |
| P05 | hai checkout tranh 1 item chỉ 1 thành công; multi-item out-of-stock rollback toàn bộ; cùng key/same payload 1 order; changed payload 409; update address không thay order; guest code-only không xem PII; verified claim CAS/revoke guest; expiry không release paid/COD pending/confirmed; COD pending quota chặn hold abuse; ship retry stock giảm đúng 1 |
| P06 | signature invalid không đổi order; replay event không double ledger; mismatch amount mở review; unknown event không tạo order; late paid expired không auto ship; simultaneous expiry/webhook không stock âm; redirect paid=true không có hiệu lực; timeout giữ order/retry same attempt; concurrent refund không vượt paidAmount; partial refund disabled 422; refund fail phục hồi paid ledger |
| P07 | review pending order 422; order người khác 404; duplicate review 409; guest ticket phải proof; customer/internal note không xuất response khách; contact SMTP down lưu+queued retry; return trigger kiểm machine |
| P08 | draft NFC story không public; revoked 410; rich text script bị loại; locale vi/en deterministic; linked product archive không xóa story lịch sử; assistant chỉ lấy published |
| P09 | duplicate event tạo 1 notification/user; worker crash lease retry; SMTP error dead-letter có audit/alert; read notification người khác 404; staff audit API 403; log không password/token/signature; paid/refund metrics đối chiếu ledger |
| P10 | model timeout có fallback thật; malicious user/content không lấy secret/đổi order; order retrieval ownership enforced; reply sources chỉ published; disabled Gemini không fake reply hoặc fake provider success |
| P11 | guest browse->cart->checkout->PayOS sandbox->OTP lookup; customer address->order->review->complaint; staff fulfillment/support; admin product/user/block->appeal->unlock/audit; mobile/accessibility; db/provider unavailable UX |

## 6. Handoff bắt buộc từ mỗi agent

```text
Package: Pxx; branch: feature/<name>; baseline: <real commit>
Changed files: <exact paths>; APIs: <method/path + OpenAPI operationId>
Migration/indexes: <script + rollback/recovery plan, no destructive auto migration>
Integration requests to I: <app/router/env/manifest/dependencies only, no shared-file edits>
Tests executed: <command, timestamp, result counts>; not executed: <reason>
Provider evidence: <official doc URL + checked date + sandbox result, secret redacted>
Remaining risks/policy assumptions: <specific limitation>
PR/commits: <real links/hashes>; contract amendment: <ID or none>
```

## 7. Definition of Done và production gate

Package done khi chức năng thật theo contract, validator+RBAC+ownership+negative tests pass, UI đầy đủ states, không secret/data khách trong diff, docs/migrations/ports/handoff đủ và CI green trên checkout integrated. Chỉ mocks/unit pass là **chưa done integration**.

Release done khi tất cả actor routes hoạt động, guest proof không lộ đơn, Atlas transactions/indexes verified, PayOS sandbox webhook/reconcile verified theo docs chính thức, mail templates deliver được, account block revokes session, review/appeal/audit permissions đúng, build+E2E pass, HTTPS+SPA deep-link/CORS/cookie/SameSite hoạt động trên environment đích, health/readiness đúng, log redact+backup/recovery và worker schedule được xác minh. Price/stock/shipping/return/privacy policies được chủ dự án xác nhận, demo content không phát hành như thật. Không tự bật PayOS/Gemini khi thiếu key, không cài cron workaround không được quản lý.

Chủ dự án chỉ cần xác nhận các input production còn thiếu (credential qua env an toàn, domain, giá/stock, chính sách giao/trả, media và nội dung văn hóa thật); agent tiếp tục build/test phần độc lập, không dừng toàn bộ chỉ vì một input chưa có.
