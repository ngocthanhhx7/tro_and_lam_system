# Interface refresh — bằng chứng tích hợp

Ngày chạy clean-tree: 2026-10-06 · Node `v24.21.0` · source revision `0fb7d9d` · branch `feature/interface-refresh`.

## Phạm vi revision

Các kết quả dưới đây thuộc source revision `0fb7d9d`, sau ba commit implementation `4529fda`, `28103f3` và `3b35180`. Cây làm việc sạch khi chạy check/E2E. `git diff --check` không báo whitespace lỗi.

## Tự động

| Lệnh | Kết quả | Giới hạn |
| --- | --- | --- |
| `npm run check` | Pass: OpenAPI 102 paths / 121 operations / 60 DTO schemas / 22 enums / 23 fixtures; ESLint sạch; backend **185 pass, 0 fail, 0 skip**; Vite build 128 modules | P02/P05/P06 replica-set suites chạy bằng URI loopback riêng. Database P02/P05 được teardown; database P06 được audit rỗng rồi xóa chính xác. Bundle JavaScript 543.66 kB (149.69 kB gzip), trên ngưỡng cảnh báo 500 kB. |
| `npm run test:e2e` | **6 pass, 0 fail**: 4 acceptance flow và 2 email verification flow | Chạy ở source revision sạch với MongoDB replica set loopback, database `tro_lam_p11_e2e_test_30ab9036fcad`; audit xác nhận đã teardown và không còn database theo prefix P11. Không gửi email thật hoặc gọi PayOS, Gemini, SMTP hay geocoder. |

E2E xác minh catalog ẩn draft, guest đi từ sản phẩm đến giỏ và nhận đúng checkout unavailable theo R06; phân quyền customer/staff/admin; link xác minh thành công và link hết hạn. Checkout không tạo order. Dữ liệu P02/P05/P06/P11 là database loopback biệt lập; hậu kiểm xác nhận không còn database nào theo các prefix kiểm thử.

## UI smoke và ảnh chụp

- Không có tràn ngang ở viewport 360, 390, 768, 1280 và 1440 px.
- Menu đóng bằng Escape trả focus về điều khiển mở menu.
- Hero video dừng khi bật `prefers-reduced-motion`; viewport không tràn ngang ở 360, 390, 768, 1280, 1440 px sau khi chỉnh khung video.
- Chi tiết sản phẩm hiển thị ba ảnh concept cùng thông báo ảnh AI.
- Ảnh chụp: [home](evidence/interface-refresh/home-1440.png), [about](evidence/interface-refresh/about-1440.png), [Lifestyle](evidence/interface-refresh/lifestyle-1440.png), [Diplomacy](evidence/interface-refresh/diplomacy-1440.png), [product detail](evidence/interface-refresh/product-detail-390.png).

Đây là smoke thủ công và E2E theo flow; chưa phải WCAG audit, screen reader test hoặc UAT.

## Rà hình ảnh hero

Poster và khung hình của banner video có phụ đề gắn sẵn trong footage. Đã phóng khung hero và cắt phần dưới video bằng CSS để phụ đề không chồng lên dòng chú thích; ảnh [home mới](evidence/interface-refresh/home-1440.png) được chụp lại sau chỉnh sửa. `home-video-diagnostic.png` giữ ảnh trước khi sửa để đối chiếu. Nguồn và quyền sử dụng do chủ dự án yêu cầu được ghi ở [`../brand/media/video-sources.md`](../brand/media/video-sources.md).

## Trạng thái sau kiểm tra

- `feature/interface-refresh` đã được fast-forward vào `develop` tại `9cc3a51`; source code kiểm tra nằm ở `0fb7d9d`, commit cuối chỉ cập nhật hồ sơ release.
- Cây làm việc sạch. Không push lên remote và không triển khai production.
- Các cổng còn mở là provider staging, WCAG/UAT, Atlas backup/restore, owner policy/catalog/media approval được liệt kê trong [acceptance coverage](acceptance-coverage.md).
- Chạy ba suite replica-set P02/P05/P06 với URI loopback riêng trong CI; bằng chứng local race suite cũ nằm trong [README release](README.md).
- Hoàn tất WCAG/accessibility audit và các UAT/provider/owner gate còn lại trong [acceptance coverage](acceptance-coverage.md).
