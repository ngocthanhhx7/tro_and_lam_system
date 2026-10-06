# Interface refresh — bằng chứng tích hợp

Ngày chạy: 2026-10-06 · Node `v24.21.0` · branch `feature/interface-refresh`.

## Phạm vi revision

Các kết quả dưới đây thuộc working tree trên base `4230130`; khi ghi lần đầu, các thay đổi giao diện và backend chưa commit. Đây chưa phải clean-checkout evidence. `git diff --check` không báo lỗi whitespace.

## Tự động

| Lệnh | Kết quả | Giới hạn |
| --- | --- | --- |
| `npm run check` | Pass: OpenAPI 102 paths / 121 operations / 60 DTO schemas / 22 enums / 23 fixtures; ESLint sạch; backend 182 pass, 0 fail, 3 skip; Vite build 128 modules | Ba test P02/P05/P06 replica-set bị skip trong lần chạy này vì không có URI test riêng trong environment. JavaScript minified 543.66 kB (149.69 kB gzip), vượt ngưỡng cảnh báo 500 kB. |
| `npm run test:e2e` | 6 pass, 0 fail: 4 acceptance flow và 2 email verification flow | Chạy trong integrated workspace với MongoDB replica set loopback và database `tro_lam_p11_e2e_test_9cfe620d20d0`; audit sau teardown xác nhận database không còn. Không gửi email thật hoặc gọi PayOS, Gemini, SMTP hay geocoder. Đây chưa phải clean-commit run. |

E2E xác minh catalog ẩn draft, guest đi từ sản phẩm đến giỏ và nhận đúng checkout unavailable theo R06; phân quyền customer/staff/admin; link xác minh thành công và link hết hạn. Checkout không tạo order. Database P11 được teardown và audit hậu kiểm không còn database mang prefix test.

## UI smoke và ảnh chụp

- Không có tràn ngang ở viewport 360, 390, 768, 1280 và 1440 px.
- Menu đóng bằng Escape trả focus về điều khiển mở menu.
- Hero video dừng khi bật `prefers-reduced-motion`; viewport không tràn ngang ở 360, 390, 768, 1280, 1440 px sau khi chỉnh khung video.
- Chi tiết sản phẩm hiển thị ba ảnh concept cùng thông báo ảnh AI.
- Ảnh chụp: [home](evidence/interface-refresh/home-1440.png), [about](evidence/interface-refresh/about-1440.png), [Lifestyle](evidence/interface-refresh/lifestyle-1440.png), [Diplomacy](evidence/interface-refresh/diplomacy-1440.png), [product detail](evidence/interface-refresh/product-detail-390.png).

Đây là smoke thủ công và E2E theo flow; chưa phải WCAG audit, screen reader test hoặc UAT.

## Rà hình ảnh hero

Poster và khung hình của banner video có phụ đề gắn sẵn trong footage. Đã phóng khung hero và cắt phần dưới video bằng CSS để phụ đề không chồng lên dòng chú thích; ảnh [home mới](evidence/interface-refresh/home-1440.png) được chụp lại sau chỉnh sửa. `home-video-diagnostic.png` giữ ảnh trước khi sửa để đối chiếu. Nguồn và quyền sử dụng do chủ dự án yêu cầu được ghi ở [`../brand/media/video-sources.md`](../brand/media/video-sources.md).

## Cổng còn mở

- Chạy `npm run check` và `npm run test:e2e` từ clean checkout sau khi tích hợp/commit working tree. E2E 6/6 hiện có được chạy trước thay đổi framing; sau đó đã chạy lại `npm run check` và UI smoke viewport/reduced-motion.
- Chạy ba suite replica-set P02/P05/P06 với URI loopback riêng trong CI; bằng chứng local race suite cũ nằm trong [README release](README.md).
- Hoàn tất WCAG/accessibility audit và các UAT/provider/owner gate còn lại trong [acceptance coverage](acceptance-coverage.md).
