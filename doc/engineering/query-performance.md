# Hiệu năng truy vấn TRO & LAM

Ngày rà soát: 2026-10-13. Chủ dự án yêu cầu kiểm tra toàn bộ luồng và lưu bài học cho các lần sửa sau.

## Số đo và nguyên nhân

Trên kết nối từ VPS đến Atlas, một lượt đọc trong mẫu giỏ hàng mất khoảng 166–182 ms. Bốn lượt nối tiếp (kiểm tra token khách đã gộp, đọc giỏ, đọc danh mục công khai, đọc sản phẩm) mất 670–688 ms. Đây là số đo từ giỏ kiểm thử riêng, không phải cam kết thời gian với mọi tài khoản/mạng.

Explain ban đầu của lookup giỏ theo token chọn COLLSCAN dù đã có partial unique index. Thêm điều kiện type phù hợp với partialFilterExpression làm query dùng `one_cart_per_guest_token`. Không thêm index trùng và không xóa index/dữ liệu hiện có.

## Các luồng đã rà soát

| Luồng | Kết luận và thay đổi |
| --- | --- |
| Giỏ khách/tài khoản | Dùng điều kiện type đúng với partial index và lean. GET giỏ khách tái sử dụng snapshot đã kiểm tra quyền/token, không đọc lại và không ghi giỏ rỗng. Giá sản phẩm vẫn được đọc mới. |
| Header, giỏ, checkout | Các GET giỏ đồng thời dùng chung request đang chạy, không cache kết quả. Đổi tài khoản hoặc cập nhật giỏ hủy trạng thái chia sẻ. Chỉ gọi POST merge khi server báo có cookie khách cần gộp; checkout trực tiếp cũng xử lý gộp nếu cần. |
| Sản phẩm cho giỏ/checkout | Join danh mục công khai bằng lookup sau match theo ID, thay hai lượt MongoDB bằng một. Sản phẩm hoặc danh mục chưa công khai vẫn bị chặn. |
| Phiên đăng nhập / middleware các vai trò | Lookup phiên và user trong một lệnh, loại passwordHash. Vẫn kiểm tra hết hạn, revokedAt, trạng thái blocked và authVersion trên dữ liệu mới. |
| Checkout / voucher | Tự tính phí sau khi đủ thông tin, debounce thay đổi, bỏ response cũ và cập nhật trước hết hạn. Mã nhập được tra theo tài khoản, trạng thái, hạn dùng. Tạo đơn vẫn tính lại giá, phí, tồn và voucher trong transaction. |
| Dashboard staff | Các số đếm, metrics và cảnh báo tồn độc lập chạy cùng lượt chờ, không chờ từng pha. Cảnh báo tồn khả dụng vẫn tính onHand trừ reserved. |
| Dashboard admin / sổ tiền | Mỗi nguồn PayOS, COD, refund dùng facet để lấy headline và chuỗi ngày từ cùng tập dữ liệu. Giảm từ 6 xuống 3 aggregate mỗi kỳ, giữ đối soát và múi giờ Việt Nam. |
| Đơn hàng / tồn / thanh toán / hoàn tiền | Danh sách có phân trang, count và rows chạy song song. Ghi giữ nguyên transaction, điều kiện version, tồn khả dụng, idempotency và trạng thái xác minh. Không song song hóa các ghi trong cùng session. |
| Thông báo / audit | Đọc giới hạn và index theo chủ sở hữu/thời gian; count và rows độc lập. Không bỏ điều kiện userId. Audit dùng cursor; thông báo vẫn giữ pagination contract. |
| Khách hàng / nhân viên / kháng nghị | Danh sách giới hạn, rows/count song song. Quyền và kiểm tra dữ liệu hiện hành vẫn là điều kiện bắt buộc. |
| Liên hệ / hỗ trợ / đổi trả / đánh giá | Danh sách giới hạn; đọc owner-scoped và phiên bản giữ nguyên. Không gom các thao tác ghi phụ thuộc vào cùng Promise.all. |
| Nội dung / NFC | Tra ID/slug/token và danh sách giới hạn; NFC admin tối đa 500 bản ghi theo contract hiện tại. Không xuất bản nội dung draft để tránh một lookup. |
| Trợ lý tư vấn | Deduplicate story ID; đọc câu chuyện công khai song song, giới hạn bởi số sản phẩm và MAX_STORIES. Không mở rộng context/quota AI. |
| Worker / outbox / media | Giữ claim/lease, retry, hạn mức và quyền đọc attachment. Không tắt audit/outbox hoặc bỏ xác minh để làm request nhanh hơn. |

## Nguyên tắc cho lần sau

- Đo HTTP, thời gian từng command, số round trip và explain trước khi sửa. Query chạy tại MongoDB trong 0 ms vẫn có thể chậm do nhiều lượt mạng nối tiếp.
- Index phải phù hợp query thực tế, nhất là partial index, ownership và sort. Không dùng hint để che một filter thiếu điều kiện.
- Ưu tiên lookup/facet hoặc batch có giới hạn. Chỉ dùng Promise.all cho các đọc độc lập; transaction writes giữ nguyên thứ tự.
- Không cache kết quả nhạy cảm về quyền, phiên, tồn kho, giá hoặc tiền. Single-flight chỉ chia sẻ đọc đang chạy và phải tách theo thay đổi identity.
- Mọi sửa query cần hồi quy về quyền sở hữu, draft/archived, block/revoke/authVersion, tồn cuối cùng, voucher một lần và đối soát tiền.
- Test dữ liệu giả ở database local sinh tên riêng rồi dọn; trên production chỉ đo đọc và giỏ thử riêng, không tạo đơn/payment/mail giả.

## Giới hạn còn lại

Độ trễ VPS–Atlas vẫn tồn tại; cần kiểm tra vùng cluster từ cấu hình nhà cung cấp trước khi quy nguyên nhân cho vùng đặt database. Tìm kiếm contains/regex và offset ở trang rất sâu cần benchmark riêng khi catalogue/dữ liệu tăng; không tự đổi sang text-search hoặc cursor vì có thể đổi kết quả/contract. Cảnh báo tồn dùng phép trừ nên không giả định index productId sẽ hỗ trợ điều kiện available. Chưa thực hiện load test lớn hay giao dịch thanh toán thực trên production.
