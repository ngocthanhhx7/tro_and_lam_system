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
Bootstrap main/develop ban đầu chỉ chứa tài liệu thiết kế; scaffold được push lên
`feature/project-scaffold`. Không coi bootstrap tài liệu là bản có thể deploy.

## Conventional Commits
Dùng **một dấu hai chấm** theo format `[type]: [short description]`:
`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
Ví dụ: `feat: add product detail page`. Các ví dụ `feat::` trong brief được hiểu là
nhãn prefix, chuẩn commit thực tế tuân thủ format một dấu `:` đã nêu.

## Review bắt buộc
1. Tác giả chạy `npm run check`, mô tả thay đổi và bằng chứng kiểm tra trong PR.
2. Ít nhất một thành viên **khác tác giả** review và approve.
3. Review naming, code style, commit, unit/integration tests và rủi ro hiệu năng/bảo mật.
4. Xử lý các vấn đề trước merge. Project Leader thực hiện final merge.

Subagent review không thay thế yêu cầu phê duyệt của thành viên đội dự án.
Repository admin cần bật branch protection/rulesets cho main và develop:
require PR, ít nhất 1 approval, dismiss stale approvals, require CI `quality`,
resolve conversations, chặn force push/deletion và giới hạn merge cho Project Leader.
PR template/CI trong repository hỗ trợ quy trình; chưa tự bật rulesets phía GitHub.

## Quy ước code
- Folder lowercase. React component PascalCase, hook `useX`, JS variable/function camelCase.
- Backend dùng `*.controller.js`, `*.service.js`, `*.routes.js`, `*.validator.js`.
- Model không xử lý HTTP; controller không truy vấn DB trực tiếp; service chứa nghiệp vụ.
- Không commit `.env`, password, API keys, node_modules hay dist.
- Tên `fondend` được giữ theo yêu cầu; đổi tên cần sửa workspaces và cấu hình deployment.
