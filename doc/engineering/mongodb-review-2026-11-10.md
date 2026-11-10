# MongoDB phase 2 — đánh giá trước sửa, 10/11/2026

## Nguồn và phạm vi

Đã cài đúng hai skill project-local tại `.agents/skills/mongodb-schema-design` và `.agents/skills/mongodb-query-optimizer`, từ [MongoDB Agent Skills](https://github.com/mongodb/agent-skills), commit `59c4a4ebed23666834c8c698a76afa91cd689365`, license Apache-2.0. Không cài global, không stage thư mục `.agents` vốn là thay đổi riêng của chủ dự án. Codex tự nhận diện các skill ở lượt tiếp theo; nội dung và các reference cần thiết đã được đọc trực tiếp trong lượt này.

Đọc AGENTS.md, query-performance.md, các nguyên tắc index, aggregation, anti-pattern, document size và embed/reference. Kết hợp access pattern từ code với đo/explain đúng truy vấn. Không áp dụng các ví dụ denormalization hoặc cache giá/tồn/quyền như khuyến nghị mặc định.

Source dựa trên develop `ca53cc39db6760dd574696a61a88c3cb8a15d0bc`, thêm thay ảnh editorial ở `0967e77`. Chưa có kết nối MongoDB/Atlas MCP trong tools hiện tại; chưa có Atlas Performance Advisor hoặc quyền API để xác nhận tier, query frequency hay slow logs. Đã kết nối lại SSH sau khi ổ E xuất hiện lại, dùng kết nối ứng dụng hiện hữu cho các phép đọc có giới hạn dưới đây. Không lưu URI, secret hoặc document cá nhân trong báo cáo. Các số đo tháng 10 chỉ là lịch sử.

## Access pattern và phát hiện từ source

| Luồng | Hiện trạng | Hướng đo/tối ưu ưu tiên |
| --- | --- | --- |
| Home / danh sách catalogue | Một aggregate product/category/facet rồi một lần inventory; home yêu cầu tối đa 100 sản phẩm để chọn 4 featured | Đo command/time/response bytes. Thử join inventory sau skip/limit trong nhánh items để còn một round trip, giữ category public gate, demo purchase approval, giá/tồn mới và DTO. Không sửa nếu explain/latency thực tế không chứng minh lợi ích. |
| Lọc availability | Stream toàn bộ matching products, inventory theo batch 100 để có exact total | Đo cardinality, batch count và exact filter/sort plans. Có thể gom inventory lookup + facet để giảm các lượt mạng; vẫn phải giữ missing inventory, quote/demo gating và total chính xác. Không cắt ngầm kết quả. |
| Chi tiết sản phẩm | Category gate qua lookup, batch inventory chính/related đã tối ưu | Kiểm tra foreign productId index thực tế; không khôi phục N+1 hoặc cache availability. |
| Auth/cart | Session/user lookup; cart partial unique index có filter type và single-flight GET | Giữ revoke/authVersion/ownership. Không denormalize auth trạng thái hoặc đổi partial index chỉ theo lý thuyết. |
| Dashboard staff | Nhiều count độc lập chạy song song, range có thể rộng; inventory alerts dùng onHand-reserved | Đo số command và thời gian từng nhóm; explain đúng status/assignedTo/date. Cân nhắc facet theo collection và deadline. Không tự đổi all-time API contract hoặc thêm index trùng khi sample quá nhỏ. |
| Đơn hàng / tiền | Snapshot line items/recipient, version/idempotency và transaction | Snapshot là lịch sử đúng nghiệp vụ, không phải dữ liệu dư thừa cần cập nhật theo sản phẩm. Không đổi thứ tự ghi transaction hoặc cache kết quả tiền. |
| Audit/outbox/messages | Các collection riêng với owner/queue indexes, lease/retry | Không gộp log hoặc message không giới hạn vào user/order để giảm lookup. Kiểm tra kích thước BSON, array growth và index thực tế trước khi migration. |

Đã đối chiếu metadata index thực tế của 39 collection với model: inventory.productId unique; products.slug/sku unique; products.status và compound status/line/categoryId/priceVnd; cart owner partial unique + expires TTL; notifications owner/event + owner/read/time; payment attempt uniqueness và active partial; COD quota guards. Không drop/thêm index. Chỉ các catalogue pipeline nêu dưới đây được explain lần này; không suy ra mọi index đều được planner dùng. Các collection chưa có database validator; validation Mongoose vẫn áp dụng tại ứng dụng. Không tự thêm validator lên dữ liệu hiện hữu khi chưa có migration và mẫu đầy đủ.

## Kế hoạch đối chiếu database chỉ đọc

1. Xác nhận release/current và vùng/tier qua thông tin được phép. Không in URI hoặc giá trị .env.
2. Lấy collection names, estimated counts, indexes và validator metadata; chỉ aggregate thống kê kiểu/kích thước BSON/mảng, không dump PII hay secrets. Giới hạn số collection, maxTimeMS và sample nhỏ.
3. QueryPlanner trước, executionStats khi có index hoặc collection nhỏ. Thu command count + thời gian từng command và HTTP cho các truy vấn catalogue/home/availability và metrics đại diện, không tạo đơn/payment/mail trên production.
4. Trình bày baseline và thay đổi cụ thể, kiểm thử local replica set riêng về quyền, trạng thái công khai, totals/pagination, missing inventory, cạnh tranh và rollback.
5. Chỉ thêm index/migration đã có bằng chứng và phạm vi được duyệt; không drop index/data tự động. Đo lại cùng điều kiện sau rollout và ghi rõ giới hạn mẫu.

## Baseline VPS–Atlas đã xác minh lại

Ổ E đã xuất hiện lại; SSH dùng đúng khóa cũ, không sao chép khóa hoặc URI vào Git. Đo trên release ca53cc3 ngày 10/11 qua script chỉ đọc, autoIndex/autoCreate tắt, không chạy worker. Kiểm tra 39 collection hiện có thuộc model ứng dụng. Catalog có 11 sản phẩm, inventory có 8 bản ghi, category có 2; đây là database nhỏ. Mẫu 50 document/collection: product tối đa 4.399 bytes, images tối đa 3; cart tối đa 288 bytes/2 item; order tối đa 1.149 bytes/2 history entry. Không có bằng chứng document phình lớn trong mẫu; không cần thiết kế lại schema hoặc chia collection theo lý thuyết.

| Truy vấn warmed, 3 mẫu | Số command/request | Thời gian service |
| --- | --- | --- |
| Home (limit 100) | 2 | 193–195 ms |
| Catalogue thường (limit 12) | 2 | 193–201 ms |
| available=true | 3 | 289–297 ms |
| available=false | 3 | 288 ms |

Mỗi command khoảng 94–103 ms. Explain aggregate product/category dùng status_1 và _id_, 22 docs/keys examined, 1 ms; SORT còn trong RAM trên 11 sản phẩm. Inventory dùng productId_1, 8 docs/keys examined, 0 ms. Không tạo index mới để loại SORT rất nhỏ hoặc suy ra query chậm từ render. Chưa có Atlas API/Performance Advisor nên không khẳng định độ phổ biến của query từ traffic thật, tier hoặc vùng cluster.

Chọn thay đổi đọc trước tiên: gom public category gate, inventory hiện hành và facet vào một aggregate cho danh sách; với danh sách thường chỉ lookup inventory sau skip/limit trong nhánh items, với lọc availability cần lookup/match trước facet để giữ exact total. Purchase approval, quote-only, missing inventory, category công khai, sort/pagination và DTO phải giống đường cũ. Giữ fallback repository/port cũ khi không opt-in; không đổi schema, index, tiền/tồn hay quyền. Tạo ca replica set so sánh DTO cũ/mới cho nhiều tổ hợp và đo lại đúng pipeline trên VPS trước/ sau rollout. Đây là tối ưu round trip, không phải cache hoặc bỏ xác minh.

## Xác minh thay đổi trước rollout

Local replica set sinh database riêng, chỉ loopback và dọn sau test: 396 so sánh DTO cũ/mới trên 115 fixture, qua ngưỡng batch 100, đủ các sort/filter/category slug/ID/hidden, quote-only, demo chưa/đã duyệt, thiếu inventory, tồn không hữu hạn, trang rỗng và exact total. Ba biến thể danh sách không lọc category đều đúng một aggregate; quan sát được thay đổi tồn ngay và rollback transaction. Không lộ metadata lookup hoặc số tồn nội bộ. Toàn bộ `npm run check` đạt: 21 dev và 281 backend, không skip; lint/contracts/build đạt.

Đo xen kẽ cũ/mới trên VPS trong bản sao review tách khỏi current, không khởi động server/worker và không ghi database; mỗi loại 3 mẫu warmed. Hash DTO công khai khớp cả 21 cặp:

| Service | Cũ | Mới | Command cũ → mới |
| --- | --- | --- | --- |
| Home | 193–194 ms | 99 ms | 2 → 1 |
| Catalogue | 192–200 ms | 98–99 ms | 2 → 1 |
| available=true | 287–292 ms | 99 ms | 3 → 1 |
| available=false | 286–294 ms | 97–98 ms | 3 → 1 |
| Category slug | 287–291 ms | 193 ms | 3 → 2 |
| Giá + sort | 192–193 ms | 98–99 ms | 2 → 1 |
| Trang 2 + sort name | 191–192 ms | 97 ms | 2 → 1 |

Category slug vẫn cần resolve danh mục công khai trước aggregate. Explain đúng cả bảy pipeline mới: server execution 2 ms, inventory lookup dùng `productId_1`, collectionScans=0; danh mục dùng `_id_`. Ở trang 2 chỉ lookup inventory cho ba items sau phân trang. Không hint hoặc thêm index từ mẫu nhỏ. Artifact chỉ đọc/đo local: `.codex-tools/mongodb-baseline-20261110.json`, `mongodb-compare-20261110.json`.

## Giới hạn và bước tiếp

Không có slow logs/Performance Advisor nên chưa đánh giá phân bố p95 theo traffic thật hoặc đưa kết luận toàn bộ database đã tối ưu. Chưa benchmark catalogue lớn/deep offset/contains regex; khi dữ liệu tăng cần đo cardinality và sort/spill/facet limits trước khi đổi contract. Bounded schema sample không chứng minh mọi document đều cùng kiểu hoặc không có array growth trong tương lai. Giữ order snapshot và các collection log/message tách riêng; không embed dữ liệu tăng không giới hạn vào user/order. Tồn/giá/auth/payment không cache; luồng ghi và transaction không thay đổi. Giảm latency service không đồng nghĩa toàn trang nhanh cùng tỷ lệ. Chưa đổi vùng Atlas do chưa xác nhận cấu hình nhà cung cấp.

## Kiểm thử trình duyệt và điều chỉnh thao tác

Quality của pha ảnh `0967e77` đạt 75/75 browser. Run đầu của pha query `22cc6b1` đạt 281 backend nhưng 74/75 browser; ca còn lại là chart doanh thu dùng `page.mouse.move` với tọa độ tuyệt đối sau khi focus slider, không bảo đảm plot vẫn trong viewport. Assertion ngày đầu nhận nguyên ngày thứ hai từ thao tác bàn phím trước đó. Không có bằng chứng ca này phụ thuộc catalogue; không coi lần chạy lỗi là đạt hoặc bật retry.

Sửa test để scroll plot vào vùng nhìn, thêm assertion viewport và dùng locator.hover có actionability ở vị trí rõ ràng phía ngày đầu. Giữ mọi assertion ngày, bàn phím, số tiền, bảng, date range và race/error; không sửa chart hoặc giảm coverage. Ca riêng local đã đạt (7,9 giây); chờ bộ đầy đủ trên GitHub cho revision sau sửa trước rollout. Artifact kiểm tra toàn vẹn dữ liệu chỉ đọc bổ sung: `.codex-tools/mongodb-integrity-20261110.json`, không phát hiện orphan category/product hoặc kiểu stock sai trong tối đa 250 document/collection (database hiện nhỏ hơn giới hạn này).
