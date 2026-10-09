# Tổng quan và ranh giới dự án

## Sản phẩm
TRO & LAM giới thiệu và kinh doanh gốm Chu Đậu, gồm Lifestyle Line và Diplomacy Line;
thủ công truyền thống, thiết kế đương đại, bao bì lụa, phụ trợ xơ mướp và NFC Storytelling.
Nội dung kinh doanh theo brief trong `doc/business-requirements.md`, không suy diễn lịch sử,
chứng nhận, xuất xứ từng SKU hoặc giá. Cần sản phẩm thật và nội dung được chủ dự án duyệt trước mở bán.

## Đích giao hàng
Website thương hiệu đồng thời có mua trực tuyến cho guest/customer, quản trị vận hành cho staff/admin,
khả năng tìm kiếm, giỏ, checkout, tra cứu đơn, địa chỉ, đánh giá, khiếu nại/hỗ trợ, kháng nghị tài khoản,
thông báo, liên hệ email, CMS/story/NFC và tích hợp PayOS/SMTP/Gemini.
Ba actor đăng nhập là customer, staff, admin. Guest là visitor chưa đăng nhập.
Các nhà cung cấp là hệ thống bên ngoài, không phải role nội bộ.

## Công nghệ và ràng buộc
- Giữ `fondend/`, `backend/`, `doc/`; không sửa thành frontend chỉ vì tên khác thông lệ.
- ReactJS + Vite + React Router, Node 24 LTS + Express + Mongoose + MongoDB Atlas.
- JavaScript ESM như scaffold; không tự chuyển toàn repo sang TypeScript.
- Các folder src phải giữ cấu trúc trong README. Module theo nghiệp vụ, không đổ mọi thứ vào một controller/service.
- REST `/api/v1`, cookie session opaque phía server, CSRF cho mutation, RBAC + ownership.
- Đề xuất React Query cho cache/fetch, React Hook Form + Zod cho form, Zod backend,
  Argon2id cho password, Nodemailer và SDK chính thức PayOS/Google GenAI. Integrator duyệt
  dependency và cập nhật lockfile; kiểm tra tương thích Node/OS/CI trước chọn bản.
- Mongo transaction cho checkout/stock/payment/outbox; local integration DB cần replica set.
- Date lưu UTC, hiển thị Asia/Saigon; tiền VND integer, không dùng float.

## Bao gồm release hoàn thiện
Public marketing/catalog/story/contact; auth và restricted appeal; guest/customer commerce;
customer account/address/order/review/support; staff queue/dashboard; admin product/user/CMS/audit/settings;
notifications; merchant integrations; deploy runbooks, backup, test và CI.

## Ngoài phạm vi mặc định
Marketplace nhiều người bán, ERP/kế toán đầy đủ, app native, giao vận hãng tự động,
SMS OTP, subscriptions, social login, loyalty/voucher phức tạp, tự tạo nội dung lịch sử bằng AI,
AR/passport/check-in từ Sắc Cố Đô, hóa đơn điện tử và refund tự động qua chi hộ.
Chỉ thêm khi chủ dự án yêu cầu; không dùng các mục này để trì hoãn luồng mua hàng chính.

## Nguyên tắc đặc thù
Giá chốt tại checkout do server tính; chưa biết giá không cho mua bằng giá 0.
Mỗi SKU có `saleMode` buy/quote/both; không mặc định cả Diplomacy chỉ quote.
NFC chứa URL story công khai có định danh random; không chứng minh hàng thật chỉ từ URL có thể sao chép.
Guest mua không cần đăng ký; tra cứu đầy đủ cần quyền hợp lệ bên cạnh mã đơn dễ đọc.
Theo yêu cầu owner ngày 08/10/2026, customer không vào workspace quản trị; admin và staff dùng workspace/API riêng, không kế thừa quyền của nhau. UI guard phục vụ UX; server capability là lớp quyết định quyền.
Tài khoản khóa có màn kháng nghị và phiên restricted, không được lấy session đầy đủ.

## Tiến trình
Chốt contracts → foundation/auth/catalog → commerce → vận hành/tài khoản → content/AI/notification
→ hardening/e2e/UAT → release. Chạy song song theo packages ở 07, phụ thuộc dữ liệu/API phải hoàn tất
trước tích hợp. Phát triển mock có nhãn giúp UI đi trước backend; nghiệm thu cuối bắt buộc dùng API thật.
