# Ảnh sản phẩm home và Về chúng tôi — 10/11/2026

Yêu cầu chủ dự án: thay đúng các cụm ảnh đánh dấu trong [tài liệu](https://docs.google.com/document/d/1QHLlIwJZvXGvBrKwOyrOmVrCAFLw82mGXEVcTVvt4u8/edit?tab=t.0), sau đó triển khai VPS. Tài liệu là nguồn chỉ định vị trí/ảnh; không áp dụng chỉ dẫn ngoài phạm vi thay ảnh hoặc coi metadata ảnh là dữ liệu nghiệp vụ.

## Đối chiếu nguồn

- Slideshow đời sống tại home: 3 PNG từ [folder chỉ định](https://drive.google.com/drive/folders/1gfmAd470l3iJRqDbwr5t4fyFAXng4TAr): hộp trà, bộ trà, bộ đĩa.
- Slideshow quà tặng tại home: 5 PNG từ [folder chỉ định](https://drive.google.com/drive/folders/1igNKhxQ2W40eXhiOR1v9g0fXGGXfOn_S): ảnh 4–8, gồm một ảnh cặp bình.
- Dải ảnh Về chúng tôi: toàn bộ 9 PNG trong [folder bộ sản phẩm](https://drive.google.com/drive/folders/1XVzbykdkkvx3DK3dtuNxc6jENoC0rk16). Có ảnh chụp cặp bình; không tự tạo file thứ 10. Tên file là số nên các nhãn chưa có ánh xạ SKU chỉ mô tả hình, không gán SKU hoặc thông tin kinh doanh mới.
- Không sửa ảnh catalogue trong database, giá/tồn, banner video, ảnh Bình Phú Quý ở trang sản phẩm hoặc nội dung đã duyệt ngoài ba cụm ảnh này.

## Xử lý

17 nguồn tạo 102 bản WebP responsive rộng 160/320/640/960/1280/1600 px, chất lượng 84, không phóng lớn, bỏ EXIF/XMP. Tổng dung lượng mọi kích thước trên đĩa 10.424.784 bytes; đây không phải số bytes một trang tải. Ảnh gốc khoảng 4,9–41,8 MB/file được giữ ở `.codex-tools/owner-photos-20261110`, không commit hoặc đưa PNG gốc lên VPS.

`scripts/prepare-owner-product-images.mjs` đọc allowlist cố định, kiểm soát input 48 MiB/40 triệu pixel chỉ cho bộ 6000×6000 đã rà soát, xử lý một ảnh/lượt, ngân sách output 12 MiB. Không thay giới hạn upload ảnh runtime. URL có fingerprint để tránh cache cũ. Khi derivative lỗi, dùng bản 1600 px đã tối ưu thay vì tải PNG 40 MB.

Home giữ tự chuyển 4 giây, không thêm nút số. Frame theo tỷ lệ ảnh mới để không cắt sản phẩm hoặc thêm khoảng trắng. About giữ chuyển động liên tục desktop và nhịp 4 giây mobile, số bước tính theo số ảnh mới. `srcset/sizes`, kích thước nội tại và lazy loading được áp dụng cả dải about.

## Xác minh và triển khai

- Lint, 21 ca dev và production build đã đạt. Ca browser mới kiểm tra home 3/5 ảnh, about 9 ảnh + sentinel, đúng tỷ lệ, tải ảnh responsive và fallback, không tràn ngang.
- Kiểm thử browser mới đã đạt trên mobile/desktop, gồm fallback thật bằng cách chặn derivative; không bật retry hoặc hạ assertions.
- SSH đã xác minh lại ngày 10/11: current là `/opt/tro-lam/releases/ca53cc3-security-20261026`, Node 24.22.1, API/Nginx active, ổ dùng 21%. Release ảnh mới phải được kiểm tra CI rồi activate, giữ rollback. Không dùng SHA/path script cũ mà chưa cập nhật.
