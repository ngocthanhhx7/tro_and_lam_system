# Đối chiếu báo cáo truy vấn ngày 2026-10-13

Báo cáo độc lập đối chiếu commit `4e6ec0e` bằng phân tích tĩnh. Nhận định về index, scan lớn và tốc độ chưa phải số đo Atlas. Đợt cải thiện đầu tiên giữ nguyên API công khai, dữ liệu kinh doanh và các điều kiện quyền/thanh toán.

| Phát hiện | Đánh giá và xử lý |
| --- | --- |
| P1-01 Catalog | Xác nhận lấy toàn bộ ID danh mục dù lọc một danh mục. Thu hẹp distinct theo ID và vẫn kiểm tra published tại repository để tránh lộ hàng khi danh mục đổi trạng thái. Chưa bỏ lần kiểm tra mới này. Regex/offset/index cần explain theo bộ lọc và dữ liệu thực. |
| P1-02 Detail | Đã bỏ HTTP tìm related bị lặp ở frontend. Backend dùng một aggregate related, bỏ count không cần thiết, loại chính sản phẩm, lọc category published trước limit 4. Đọc tồn, story và related chạy độc lập sau public gate; khi có session vẫn tuần tự. |
| P1-03 Reviews | Xác nhận UI đọc từng đơn để xác định sản phẩm được đánh giá. Cần endpoint batch owner-scoped với delivered và chống review trùng; còn ở đợt sau vì cần bổ sung contract và kiểm thử quyền. |
| P1-04 Expiry worker | Đã đọc đơn cho tối đa 500 reservation bằng một query `$in`, chỉ lấy trạng thái cần thiết. Vẫn xác minh provider tuần tự và đọc lại đơn/reservation trong transaction, version, release, outbox giữ nguyên. |
| P1-05 Dashboard | Rủi ro scan có cơ sở nhưng chưa đo trên Atlas. Chưa thêm index/materialized inventory chỉ từ suy đoán. Cần explain theo kỳ và số lượng hàng. |
| P1-06 Lists | Regex contains và offset sâu có giới hạn mở rộng. Giữ semantics hiện tại; đã thu gọn projection của danh sách đơn. Cursor/prefix cần thiết kế contract và benchmark. |
| P1-07 Reconciliation | Cần explain query status/active/lastCheckedAt/sort trên index thực. Chưa thay concurrency PayOS khi chưa có căn cứ về hạn mức. |
| P1-08 Identity race | Đã invalidation single-flight cart ở bootstrap auth thành công và thất bại. Checkout dùng revision cho kết quả, lỗi, loading và voucher resolve; cleanup/new load chặn response cũ. |
| P2-09 Notifications | Đọc unread ở nhiều thành phần có thể lặp; cần chia sẻ theo identity và invalidation sau mark-read. Còn ở đợt sau, không cache count nhạy cảm lâu dài. |
| P2-10 NFC | Chuỗi đọc có kiểm tra trạng thái/tag/locale; chưa gộp khi chưa có regression cho revoked/410 và locale. |
| P2-11 Session projection | Đã loại passwordHash từ đợt trước. Inclusion projection cần inventory mọi consumer actor.user trước khi thu gọn; chưa cắt trường tùy tiện. |
| P2-12 Vouchers | Giới hạn wallet/admin hiện tại có thể che phần đuôi khi dữ liệu tăng. Cần pagination contract và frontend tương ứng; chưa đổi ngầm shape/limit hiện tại. |
| P2-13 Order list | Đã inclusion projection và lean cho danh sách owner/staff. Chỉ đọc quantity/summary và name/image/recipientName/phone cần cho staff; không đọc email/địa chỉ/lịch sử giao hàng/ghi chú/token từ list. Detail và mutation vẫn đọc đầy đủ theo quyền. |

## Kiểm chứng

- Kiểm thử MongoDB replica set local, database tên ngẫu nhiên và tự dọn: category draft bị chặn, related giới hạn/lọc public, owner filter và summary DTO giữ nguyên, projection không lấy dữ liệu riêng không cần thiết, batch prefetch chỉ lấy trạng thái.
- Kiểm thử worker: 4 reservation dùng 1 batch đọc, chỉ PayOS pending chưa trả tiền được đưa tới provider; đơn đủ điều kiện được đọc lại trong transaction trước nhả tồn.
- Kiểm thử revision frontend: response cũ và voucher cũ bị bỏ sau đổi scope, unmount cũng invalidation.
- Không tạo đơn/payment giả hay gọi thanh toán trên production. Không xóa hoặc thêm index khi chưa có explain.

Đây là đợt đầu; bảng trên nêu rõ các hạng mục còn lại. Không coi việc pass test local là chứng minh tất cả query đã tối ưu hoặc chịu được tải lớn.
