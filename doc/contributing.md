# Source Code Management

## Gitflow
- `main`: bản ổn định, chỉ dùng cho production Vercel/Render.
- `develop`: tích hợp các feature hoàn thành sau Sprint.
- `feature/<feature-name>`: tạo từ develop, mở PR vào develop.
- `hotfix/<fix-name>`: tạo từ main, review và đưa vào main; đồng bộ lại develop.
- Khi release, Project Leader mở PR develop → main và merge sau kiểm tra/review.

```powershell
git switch develop
git pull --ff-only
git switch -c feature/product-catalog
```
Scaffold ban đầu được phát triển trên `feature/project-scaffold`, tích hợp qua PR vào
`develop`, sau đó phát hành baseline qua PR `develop` → `main`.

## Conventional Commits
Dùng **một dấu hai chấm** theo format `[type]: [short description]`:
`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
Ví dụ: `feat: add product detail page`. Các ví dụ `feat::` trong brief được hiểu là
nhãn prefix, chuẩn commit thực tế tuân thủ format một dấu `:` đã nêu.

## Review theo quy mô đội dự án
Trong giai đoạn chỉ có chủ dự án, chủ dự án được tự review và merge hoặc ủy quyền
cho trợ lý thực hiện. Không cần approval từ người khác. Vẫn dùng PR và chạy CI trước merge.
Người dùng đã xác nhận ngoại lệ này ngày 06/10/2026.

Khi có thêm thành viên, áp dụng quy trình reviewer độc lập:
1. Tác giả chạy `npm run check`, mô tả thay đổi và bằng chứng kiểm tra trong PR.
2. Ít nhất một thành viên **khác tác giả** review và approve.
3. Review naming, code style, commit, unit/integration tests và rủi ro hiệu năng/bảo mật.
4. Xử lý các vấn đề trước merge. Project Leader thực hiện final merge.

Subagent review không thay thế yêu cầu phê duyệt của thành viên đội dự án.
Repository admin nên bật branch protection/rulesets cho main và develop:
require PR, require CI `quality`, resolve conversations, chặn force push/deletion.
Giai đoạn một người không yêu cầu approval. Khi thêm thành viên, bật ít nhất 1 approval,
dismiss stale approvals,
và giới hạn merge cho Project Leader.
Workflow [`.github/workflows/quality.yml`](../.github/workflows/quality.yml) chạy contract validation,
lint, backend replica-set tests, production build và integrated Playwright acceptance trên pull request
vào `develop`/`main`, push vào hai nhánh này và khi chạy thủ công. Workflow dùng MongoDB replica set
dùng một lần, không có provider credentials. GitHub rulesets/branch protection vẫn cần repository owner
cấu hình; workflow chưa được coi là CI evidence cho đến khi có run xanh trên GitHub.

## Quy ước code
- Folder lowercase. React component PascalCase, hook `useX`, JS variable/function camelCase.
- Backend dùng `*.controller.js`, `*.service.js`, `*.routes.js`, `*.validator.js`.
- Model không xử lý HTTP; controller không truy vấn DB trực tiếp; service chứa nghiệp vụ.
- Không commit `.env`, password, API keys, node_modules hay dist.
- Tên `fondend` được giữ theo yêu cầu; đổi tên cần sửa workspaces và cấu hình deployment.
