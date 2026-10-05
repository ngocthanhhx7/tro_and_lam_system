# TRO & LAM — Định hướng nghiệp vụ

Nguồn: brief người dùng cung cấp ngày 06/10/2026; không bổ sung các tuyên bố lịch sử
hoặc thông tin sản phẩm chưa được xác minh.

Đặc tả mở rộng đầy đủ customer/staff/admin, guest checkout, address, appeal, notification,
PayOS/SMTP/Gemini và plan song song nằm tại [doc/planning](planning/README.md).
Danh sách giai đoạn dưới đây là định hướng ban đầu; dùng hồ sơ planning làm đích triển khai mới nhất.

## Thương hiệu
Sản xuất, kinh doanh và phát triển gốm Chu Đậu mang tính ứng dụng, nghệ thuật và quà tặng
văn hóa. Kết hợp nghề thủ công truyền thống, thiết kế đương đại và NFC Storytelling.

## Hai dòng sản phẩm
- Lifestyle Line: lư xông trầm mini, hũ trà, bộ chén độc ẩm; dùng cá nhân, trang trí và quà tặng.
  Bao bì bọc lụa và sản phẩm phụ trợ từ xơ mướp tự nhiên.
- Diplomacy Line: Bình Thiên Nga, Phú Quý, Giọt Ngọc, Hoa Lam, Tỳ Bà;
  quà tặng ngoại giao, doanh nghiệp và các dịp trang trọng.
- NFC Storytelling: khám phá nguồn gốc, hoa văn và câu chuyện văn hóa của sản phẩm.

## Mục tiêu website
Nhận diện thương hiệu; trưng bày sản phẩm; thu thập yêu cầu tư vấn; kể câu chuyện thương hiệu,
làng nghề, nghệ nhân; hỗ trợ tìm hiểu và đặt hàng trực tuyến.

## Khách hàng
Nam và nữ 25–55 tuổi, thu nhập trung bình khá đến cao tại Hà Nội, TP.HCM, Đà Nẵng;
có tiềm năng quốc tế. Nhân viên văn phòng, quản lý, doanh nhân, người hoạt động trong
ngoại giao, văn hóa và du lịch. Khách doanh nghiệp, cơ quan, đại lý và khách sỉ.

## Các giai đoạn sau scaffold
1. Danh mục hai dòng sản phẩm, trang chi tiết và nội dung thương hiệu có dữ liệu đã duyệt.
2. Form tư vấn/đặt quà tặng, xác nhận tiếp nhận và quy trình xử lý lead; chốt chính sách dữ liệu cá nhân.
3. Trang storytelling theo sản phẩm cho NFC; chốt định danh tag, nội dung, vòng đời và quyền quản trị.
4. Quản trị nội dung, sản phẩm, lead với xác thực và phân quyền.
5. Quốc tế hóa và đặt hàng trực tuyến sau khi chốt ngôn ngữ, giá, vận chuyển và thanh toán.

Các mục này là backlog, chưa được triển khai trong scaffold. Không dùng giá, chứng nhận,
hình ảnh, email hay số điện thoại giả làm dữ liệu kinh doanh.
