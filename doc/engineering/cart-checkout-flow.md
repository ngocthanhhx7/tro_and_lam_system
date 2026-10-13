# Giỏ hàng, checkout khách và tra cứu mã đơn

Thay đổi theo yêu cầu chủ dự án ngày 2026-10-13.

## Giỏ hàng

- Giỏ có checkbox từng dòng và chọn tất cả các dòng đủ điều kiện mua. Tổng tiền, số lượng và checkout chỉ dùng các dòng được chọn; không chọn thì nút mua bị khóa. Cột Xóa tách khỏi tên sản phẩm. Các thao tác thay đổi số lượng/xóa được khóa trong lúc một ghi đang chạy để tránh xung đột phiên bản giữa các dòng.
- Bỏ breadcrumb Trang chủ / Giỏ hàng và bỏ padding lồng của layout, giảm khoảng trống đầu trang.
- Header dùng snapshot cart đã tải để xem trước khi hover/focus, không GET mỗi lần hover. Event sau mutation mang cart DTO mới cùng số đếm. Menu customer cũng mở bằng hover chuột; touch và keyboard giữ thao tác bấm/Escape/blur.
- Backend PUT trước thay đổi: middleware find, product aggregate, cart find, transaction cart find, findAndModify, commitTransaction, product aggregate. Trên VPS ba mẫu lần lượt 1200/1184/1183 ms, chưa tính GET giỏ phía frontend và đường truyền của người mua.
- PUT tái sử dụng snapshot guest có kiểm tra ownership/tombstone, đọc các sản phẩm cần một lần và ghi một document bằng điều kiện `_id + version`. Không cần transaction riêng cho một atomic compare-and-set. Transaction checkout/merge nhiều document giữ nguyên. Frontend dùng single-flight GET giỏ đang chạy; không cache quyền/giá/tồn hay báo thành công trước khi API ghi thành công.
- Sau triển khai, cùng phép đo trên VPS còn find + aggregate + findAndModify: 560/550/549 ms. Đây là thời gian middleware + PUT của giỏ kiểm thử riêng, chưa gồm GET giỏ phía frontend, CSRF lần đầu và đường truyền của người mua. Giỏ kiểm thử được dọn sau đo; không có order/payment/email mới.

## Đặt đơn và trừ giỏ

Hàm removeCommittedItems trước đây chưa được nối vào composition/createOrder. Nay trừ đúng quantity của các dòng đã mua trong transaction tạo đơn, trước khi hoàn tất idempotency. Các dòng khác và số lượng chưa mua giữ lại. Transaction thất bại rollback giỏ; replay đã thành công không chạy trừ lần hai. Trình duyệt đọc lại giỏ và cập nhật header sau tạo đơn mà không chặn màn xác nhận nếu lần refresh bị lỗi.

## Voucher khách không đăng nhập

- Voucher cũ vẫn gắn userId, chỉ đúng customer được sử dụng. Wallet vẫn chỉ dành cho customer đăng nhập.
- Admin có thêm scope public: mã dùng chung, hạn dùng, điều kiện tiền hàng, mức giảm và maxRedemptions do admin nhập. Không tự tạo mã, giá trị ưu đãi hoặc seed dữ liệu lên production.
- POST /vouchers/resolve chỉ tra mã public còn lượt/hạn; không tìm hoặc lộ voucher riêng. Customer nhập mã có thể dùng mã riêng của mình hoặc mã public.
- Checkout kiểm tra lại eligibility, thời hạn và discount trong transaction. Public redeemedCount cập nhật có điều kiện còn lượt; voucher_redemptions lưu một redemption duy nhất mỗi order. Hủy đơn trả lượt trong transaction và chỉ một lần. Mã public giới hạn tổng lượt, không cam kết giới hạn mỗi người không có tài khoản.

## Tra cứu

/tra-cuu-don-hang có form mã đơn công khai. GET /orders/tracking/{code} dùng index code duy nhất, giới hạn 30 lần/phút/IP và no-store. Chỉ trả code/status/timestamps/status timeline; không trả người nhận, email, điện thoại, địa chỉ, line items, tiền, ID đơn, actor/reason hoặc vận đơn. Xem đầy đủ vẫn dùng owner/proof hoặc xác minh email bằng OTP.

Tham khảo nguồn sơ cấp: [Shopify order status](https://help.shopify.com/en/manual/fulfillment/setup/order-status-page/understanding-order-status-pages) và [discount eligibility](https://help.shopify.com/en/manual/discounts/managing-discounts). Đây là căn cứ thiết kế luồng; chính sách/mức giảm của TRO & LAM vẫn do admin cấu hình.

## PayOS

Phản hồi tạo đơn trước đây thiếu order.paymentMethod nên PaymentPanel không chạy autoCreate. Nay phản hồi có paymentMethod và frontend giữ fallback cho replay cũ. Sau khi đơn commit, PaymentPanel tự gọi createPaymentAttempt với khóa idempotency theo order, rồi chuyển cùng tab đến checkoutUrl HTTPS thuộc pay.payos.vn. Lỗi provider giữ nguyên đơn và cho thử lại thanh toán, không tạo thêm đơn. Chi tiết đơn cũng mở PayOS sau khi người dùng bấm thanh toán. Return/cancel UI vẫn đọc trạng thái từ server; không dùng query string để đánh dấu paid. Chỉ webhook/reconciliation xác minh được mới cập nhật tiền.

Nguồn: [Luồng PayOS](https://payos.vn/docs/) và [Hosted checkout](https://payos.vn/docs/checkout/quick-start-payos-hosted-page.md), đối chiếu ngày 2026-10-13.

## Kiểm thử

Replica set local với database tên ngẫu nhiên tự dọn: CAS đồng thời chỉ một ghi cùng version thành công; snapshot sai owner bị chặn; checkout partial/replay/rollback; cart guest không ảnh hưởng cart user; guest không dùng voucher riêng; hai checkout tranh lượt public cuối chỉ một thành công; hủy/replay trả lượt đúng một lần; public progress không chứa dữ liệu riêng. Route tests kiểm tra CSRF/strict-body của resolve, progress không cần actor và bị rate limit. Không tạo đơn/payment/mail giả trên production.
