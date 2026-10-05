# Cài đặt và deployment

## MongoDB Atlas
1. Tạo project và cluster Atlas theo nhu cầu thực tế.
2. Tạo **database user** riêng, cấp `readWrite` trên database `tro_lam`.
3. Thêm IP máy phát triển và dải IP outbound của dịch vụ backend vào IP access list.
4. Trong Connect → Drivers, lấy connection string. Thay username/password/cluster,
   thêm database `tro_lam`; URL-encode ký tự đặc biệt trong password.
5. Đặt URI vào `backend/.env` hoặc environment settings của Render. Không gửi vào Git.
6. Chạy `npm run dev:api`, kiểm tra `/api/v1/health/ready` trả 200 với database `connected`.

Backend từ chối URI mẫu. Lỗi kết nối không in password hoặc URI ra log.
Nếu mất DB sau khi chạy, readiness trả 503. Backend retry ban đầu thông qua timeout
của Mongoose; khi khởi động thất bại cần khắc phục cấu hình và khởi động lại.

## Env
| Biến | Nơi | Ý nghĩa |
| --- | --- | --- |
| NODE_ENV | Backend | development/test/production |
| PORT | Backend | 5000 local; Render tự cung cấp |
| MONGODB_URI | Backend | URI database thật |
| CORS_ORIGIN | Backend | Origin frontend, không có path hoặc dấu / cuối |
| TRUST_PROXY | Backend | 0 local, 1 khi đứng sau một reverse proxy tin cậy trên Render |
| VITE_API_BASE_URL | Frontend | /api/v1 local; https://API-HOST/api/v1 production |

Các biến `VITE_*` xuất hiện trong bundle công khai; tuyệt đối không chứa secrets.
Local Vite proxy `/api` tới localhost:5000; đổi proxy nếu đổi PORT backend.
Scripts gọi trực tiếp entry JS của các công cụ để chạy được trên Windows khi
đường dẫn workspace chứa ký tự `&` như `tro&lam_system`.

## Vercel (frontend)
- Root Directory: `fondend`. Bật quyền đọc file ngoài root nếu Vercel yêu cầu cho workspaces.
- Framework: Vite. Install: `npm ci` dùng root lockfile; Build: `npm run build`;
  Output: `dist`.
- Đặt `VITE_API_BASE_URL` tới API Render trước build.
- `fondend/vercel.json` chứa rewrite cho React Router; thử refresh URL sâu sau deploy.
- Chỉ deploy production từ main sau review; develop/feature dùng preview nếu cần.

## Render (backend)
- Root Directory: repository root; Build: `npm ci`; Start: `npm start -w backend`.
- Node version: 24, `NODE_ENV=production`, `TRUST_PROXY=1`.
- Đặt URI Atlas và CORS_ORIGIN chính xác theo domain frontend.
- Health Check Path: `/api/v1/health/ready` để kiểm tra cả kết nối DB.
- Cho phép IP outbound Render trong Atlas, thử health trước khi đưa vào sử dụng.
- Chỉ dùng main cho production. Chưa có deploy tự động trong scaffold này.

## Nguồn chính thức
- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [Atlas database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/)
- [Atlas IP access list](https://www.mongodb.com/docs/atlas/security/ip-access-list/)
- [Vercel Vite](https://vercel.com/docs/frameworks/vite)
- [Render health checks](https://render.com/docs/health-checks)

Agy được gọi với `/teamwork-preview`, model `gemini-3.8-flash-high`, effort high và plan mode.
Agy trả tổng hợp cùng nguồn; thông tin Node đã được đối chiếu lại từ tài liệu chính thức:
chọn Node 24 LTS thay vì ví dụ Node 20/22 của Agy. Không xem các gợi ý research là
bằng chứng đã kết nối Atlas hoặc đã deploy.
