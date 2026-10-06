# Bằng chứng nghiên cứu và giới hạn

Ngày: 06/10/2026 (Asia/Saigon). Bộ tài liệu phân biệt **đã quan sát** / **đề xuất TRO** / **cần kiểm chứng live**.

## Nguồn trực tiếp
1. Yêu cầu chủ dự án trong chat và ảnh brief thương hiệu: actor, nghiệp vụ, stack, Gitflow và logo.
2. `D:\WW\ha_thanh_vi_system`: đọc local docs và source/routes/models/services/E2E.
   File cụ thể và khác biệt được liệt kê trong 01/02/04/05. Chỉ tham khảo read-only,
   không copy database, env, secrets, user data hay logic thành lời hứa TRO đã có.
   E2E có mocks chỉ chứng minh ý định/hành vi được mô phỏng, không chứng minh integration live.
3. [Thành Nam Hương Ký](https://thanhnamhuongky.io.vn/) và [Sắc Cố Đô](https://saccodo.com/):
   web đọc public homepage và subagent xem browser desktop/mobile; chi tiết quan sát ở 03.
   Screenshot quan sát trong tool, không lưu file trong repo. Chưa kiểm thử checkout/admin của các site.
   Không lấy nguyên văn marketing, địa chỉ, dữ liệu sản phẩm hoặc assets của hai thương hiệu.
4. Logo `fondend/public/assets/logo/logo.PNG` đã được mở ảnh thực: chữ/vòng tròn/sen kim trên nền lam texture.

## Agy
Đã kiểm tra `agy --help` và `agy models`; model khả dụng `gemini-3.8-flash-high`.
Lời gọi research dùng `--model gemini-3.8-flash-high --effort high --mode plan --print-timeout 90s`
với prompt bắt đầu `/teamwork-preview`, read-only. Kết quả: **không có output nghiên cứu**,
vì tool `read_url` cần permission mà headless không prompt được nên auto-denied.
Không sửa permission settings và không dùng dangerously-skip-permissions.
Không dùng Claude CLI nên không có tuyên bố đã tìm/đổi custom profile.

Fallback là web trực tiếp nguồn chính thức và subagents đọc source/quan sát browser.
Không coi việc model có trong Agy là bằng chứng model tương ứng có trên Gemini merchant API.

## Nguồn provider thực tế đã đọc
- [PayOS API](https://payos.vn/docs/api/): payment links, webhook, confirmation và payout;
  không tìm được API “refund” trực tiếp trong trang API đã đọc. Không kết luận PayOS vĩnh viễn không có refund;
  thiết kế refund manual/evidence cho tới khi xác minh khả năng của merchant/API thực tế.
- [Google GenAI libraries](https://ai.google.dev/gemini-api/docs/libraries),
  [Models API](https://ai.google.dev/api/models): SDK và model discovery.
- [MDN Geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API):
  secure context, permission, coordinates, không phải postal address.
- [Nodemailer SMTP](https://nodemailer.com/smtp): transport/TLS/verify, không bảo đảm inbox.
- [Google reverse geocoding](https://developers.google.com/maps/documentation/geocoding/requests-reverse-geocoding):
  ứng viên provider; phải xác minh key, quota, billing và terms lúc chọn provider.

Không gọi live PayOS, SMTP, Gemini hoặc geocoding bằng key chủ dự án. Chưa có credentials Atlas thật,
chưa deploy hoặc xác minh domain/cookie/provider readiness. Các plan/test/security defaults là thiết kế
TRO & LAM, không quảng bá là chức năng đã hoạt động trong source tham khảo hay scaffold.

### Tra cứu catalog Gốm Chu Đậu

Đã đối chiếu các tên trong concept manifest với catalog hãng ngày 06/10/2026. Kết quả, URL sản phẩm,
nhãn biến thể và giới hạn diễn giải nằm trong [bảng nghiên cứu catalog](chudau-catalog-2026-10-06.md).
Ba truy vấn Lifestyle không tìm thấy tên khớp; các mẫu Diplomacy có nhiều trang/biến thể riêng.
Giá và nhãn F/H là nội dung website hãng tại thời điểm truy cập, không xác nhận SKU, quyền bán, đơn vị,
giá hay tồn kho của TRO & LAM. Không tải hoặc tái sử dụng ảnh hãng.
