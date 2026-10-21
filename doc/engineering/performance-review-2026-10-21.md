# Rà soát và kế hoạch hiệu năng — 2026-10-21

## Kết luận ban đầu

Dự án đã có tối ưu nhưng chưa tối ưu hết. Độ trễ mỗi lượt mạng VPS–Atlas khoảng 180 ms vẫn chi phối các chuỗi đọc; MongoDB thực thi pipeline trong 1 ms không có nghĩa HTTP cũng 1 ms. Ảnh upload sản phẩm đã có thumbnail, nhưng ảnh editorial/motif tĩnh vẫn tải quá lớn cho kích thước hiển thị. Màn hình startup mới chờ cả request nền, font và ảnh, có thể giữ giao diện inert tới 12 giây.

## Phạm vi rà soát

| Luồng | Đánh giá và hướng xử lý |
| --- | --- |
| Identity / phiên | Session-user lookup đã có; giữ kiểm tra revoke/authVersion trên dữ liệu mới. Không cache quyền. |
| Catalog / chi tiết / liên quan | List đã facet + batch stock. Detail còn product→category→related→stock với 5 command/4 pha; gộp public category gate và batch tồn chính/liên quan. |
| Giỏ / checkout / voucher | Snapshot, partial index, GET single-flight, batch sản phẩm và tính lại trong transaction giữ nguyên. Xóa giỏ còn đọc trước rồi đọc transaction; lưu candidate CAS, chưa đổi khi chưa có hồi quy merge/version chuyên biệt. |
| Đơn / thanh toán / refund | Owner list facet/projection; giữ idempotency, đối soát, reservation và thứ tự ghi transaction. Không tạo giao dịch thử production. |
| Dashboard / finance | Các đọc độc lập đã song song, finance facet. Không hứa giảm latency bằng việc thay mọi count/list thành facet. |
| Thông báo / audit / hỗ trợ | Có owner/permission, pagination và batch attachment. Cần explain thêm sort updatedAt của ticket/queue trên dữ liệu đủ lớn trước khi thêm index. |
| Reviews | Đang tải full public product + stock chỉ để xác nhận công khai. Thay bằng existence lookup có gate product/category, giữ DTO/pagination/attachment consent. |
| Content / NFC | Slug/locale index, public gate còn nguyên. NFC nhiều đọc nối tiếp; backlog lookup có cùng ngữ nghĩa locale/permission. |
| Assistant | History/context có giới hạn, story dedupe, quota atomic. Không bỏ owner/quota write vì mục tiêu tốc độ. |
| Outbox / workers / media | Lease/claim, retry và attachment permissions giữ nguyên; ảnh động có giới hạn CPU/queue. |
| Frontend / ảnh | Static editorial WebP lớn, sizes motif dùng phần trăm không hợp lệ, slide clone eager dưới fold. Tạo variants theo source hash và responsive đúng; giữ originals và fallback. |
| Startup / video | Chỉ đợi route mount, để section tự loading/error; deadline ngắn có kiểm thử. Video dùng poster trước, tôn trọng giảm chuyển động/tiết kiệm dữ liệu, pause ngoài màn hình/tab ẩn. |

## Kế hoạch thực hiện

1. **Ưu tiên 1 — đo và sửa truy vấn công khai:** baseline VPS read-only, gộp detail/category, batch stock, bỏ category đọc lặp; existence gate cho reviews. Hồi quy local riêng về draft/archived, freshness, DTO, session tuần tự.
2. **Ưu tiên 1 — ảnh đúng kích thước:** derivative WebP q82 có URL source hash; srcset/sizes cho slideshow, thumbnail và motif, giữ ảnh gốc. Xem trực quan nét vẽ/men và kiểm tra alpha; không nén đè originals.
3. **Ưu tiên 1 — bỏ chờ toàn trang:** startup không phụ thuộc font, video hoặc API nền; kiểm thử deadline và route loading. Video không tải khi reduced-motion/saveData và ngừng phát ngoài viewport.
4. **Kiểm chứng:** lint/contracts/dev tests/backend local/build, trình duyệt desktop/mobile, đếm command và explain đúng filter trên VPS. Triển khai release có rollback, giữ .env/media và không migrate dữ liệu kinh doanh.
5. **Backlog cần số liệu lớn hơn:** regex contains/deep offsets, ticket/story/staff sort indexes, NFC lookup, cart delete CAS. Không tự thêm Redis, đổi vùng Atlas hay nâng gói dịch vụ có phí.

## Baseline trước sửa

- List sản phẩm: 366–367 ms warm, 2 command (aggregate products ~183 ms + inventory ~181 ms), 8 SKU. Lần helper kết nối mới 2.961 ms được tách khỏi warm latency.
- Detail `binh-phu-quy`: 729–739 ms, 5 command: product find, category find, main inventory, related aggregate, related inventory. Bốn pha chờ nối tiếp.
- Explain list: status_1 + _id_, EQ_LOOKUP/SORT/FETCH/IXSCAN, execution 1 ms, 16 docs/keys examined. Giữ index hiện có.
- 9 ảnh slideshow gốc tổng 16.645.250 bytes. Các motif gốc lotus 2.202.244 bytes, lakeside-pavilion 1.763.348 bytes, dong-son-drum 2.116.840 bytes xuất hiện trong phiên đo browser dù là họa tiết nền. Dung lượng không đồng nghĩa chính xác thời gian tải do cache/mạng.
- Video nền 3.782.985 bytes; giữ chất lượng và thay cách ưu tiên/tạm dừng, không tuyên bố đã giảm dung lượng video.

## Giới hạn kiểm chứng

Chưa load test production hay benchmark catalog hàng trăm nghìn SKU. Không suy luận vùng đặt Atlas chỉ từ latency, không cam kết mọi API dưới một ngưỡng cố định. Kết quả sau sửa và điểm còn lại sẽ được bổ sung sau đo/triển khai.

## Kết quả triển khai trong lượt rà soát

Đã thực hiện các bước 1–3: detail public category lookup + stock batch, existence gate reviews, 50 static derivatives với 20 nguồn, startup chỉ đợi route, video visibility/reduced-motion/save-data và thumbnail admin dùng cùng productImageProps. Ảnh gốc không bị ghi đè; derivative có hash nguồn và quality config để tránh immutable cache cũ. Chạy lại script bằng `node scripts/prepare-editorial-images.mjs` khi nguồn thay đổi.

Ảnh slideshow: 16.645.250 bytes → 1.000.444 bytes ở 640px (giảm 94%) hoặc 1.709.546 bytes ở 960px (giảm 89,7%). Chín motif: 15.654.764 bytes → 967.972 bytes ở 512px, giữ alpha. 50 file biến thể tổng 4.997.510 bytes là tổng các kích thước, không phải mỗi phiên tải toàn bộ. Đã xem trực quan nguồn/bản 960px Bình Thiên Nga, hoa văn và màu men còn rõ ở kích thước hiển thị; q82 là nén có mất dữ liệu. AboutProductMarquee 13 ảnh tổng 4.006.830 bytes được giữ backlog, chưa có variants trong lượt này.

Review API trước sửa trên VPS: 725–727 ms, 5 command (product aggregate, category distinct, inventory find, reviews find và count aggregate). Hai lệnh reviews chạy song song; giảm pha gate công khai mới là nguồn lợi ích, không phải chỉ đổi count thành facet.

Hồi quy local bao gồm public/draft/archived category và sản phẩm, related ordering, stock freshness, DTO không lộ dữ liệu nội bộ, session không chồng query; public review fail closed và compatibility ports; static variants dimensions/alpha/budget/fallback; startup không chờ font/background request và có deadline. Chưa tạo đơn/payment/mail giả trên production.

Kiểm tra trình duyệt local desktop trước khi công cụ bị tắt cho thấy ảnh responsive hiển thị đúng, không có ảnh lỗi trong viewport. Kiểm tra mobile/visibility video đầy đủ sau sửa chưa hoàn tất vì Browser Use bị tắt trong Work settings; không coi việc có implementation là bằng chứng mọi trình duyệt đều đã kiểm chứng.
