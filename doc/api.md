# API scaffold

Prefix: `/api/v1`. JSON. Các endpoint health là public, không trả thông tin nhạy cảm.

| Method | Path | Kết quả |
| --- | --- | --- |
| GET | /api/v1/health | 200 `{"status":"ok"}` — tiến trình HTTP đang chạy |
| GET | /api/v1/health/ready | 200 `{"status":"ready","database":"connected"}` hoặc 503 `{"status":"unavailable","database":"disconnected"}` |
| Bất kỳ | Route chưa tồn tại | 404 JSON với code `NOT_FOUND` |

Liveness không chứng minh Atlas đang kết nối. Readiness phụ thuộc trạng thái connection
thật khi chạy server; integration tests inject trạng thái DB, không dùng cluster thật.
CORS chỉ cấp quyền browser cho origin đã cấu hình; CORS không thay thế authentication.
Các route nghiệp vụ tương lai chịu giới hạn 100 request/15 phút/IP; health bỏ qua giới hạn
để probes ổn định. Body JSON giới hạn 100 KB. Chưa có endpoint catalog/lead/NFC.
JSON sai định dạng trả 400 `BAD_REQUEST`; JSON vượt giới hạn trả 413 `PAYLOAD_TOO_LARGE`.
