import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth.context.js';
import './http-error-page.css';

const ERROR_COPY = Object.freeze({
  400: { title: 'Yêu cầu chưa hợp lệ', message: 'Thông tin gửi đi chưa đúng định dạng. Hãy kiểm tra lại rồi thử lại.', label: 'Yêu cầu không hợp lệ' },
  401: { title: 'Phiên đăng nhập đã hết hạn', message: 'Hãy đăng nhập lại để tiếp tục thao tác.', label: 'Cần đăng nhập' },
  403: { title: 'Bạn chưa được cấp quyền', message: 'Tài khoản hiện tại không có quyền mở trang này.', label: 'Không có quyền truy cập' },
  404: { title: 'Không tìm thấy trang', message: 'Đường dẫn có thể đã thay đổi hoặc trang không còn tồn tại.', label: 'Trang không tồn tại' },
  405: { title: 'Thao tác không được hỗ trợ', message: 'Trang không hỗ trợ cách gửi yêu cầu này.', label: 'Phương thức không được hỗ trợ' },
  408: { title: 'Yêu cầu đã hết thời gian chờ', message: 'Kết nối mất quá nhiều thời gian. Hãy thử lại.', label: 'Hết thời gian chờ' },
  409: { title: 'Dữ liệu vừa được thay đổi', message: 'Thông tin hiện tại đã khác với dữ liệu bạn đang xem. Hãy tải lại rồi thử lại.', label: 'Xung đột dữ liệu' },
  413: { title: 'Nội dung gửi lên quá lớn', message: 'Hãy giảm kích thước tệp hoặc nội dung rồi thử lại.', label: 'Yêu cầu quá lớn' },
  422: { title: 'Thông tin chưa thể xử lý', message: 'Hãy kiểm tra các thông tin đã nhập rồi thử lại.', label: 'Dữ liệu không hợp lệ' },
  429: { title: 'Bạn thao tác quá nhanh', message: 'Hệ thống đang giới hạn số lần yêu cầu. Hãy chờ một chút rồi thử lại.', label: 'Quá nhiều yêu cầu' },
  500: { title: 'Trang đang gặp sự cố', message: 'Đã có lỗi khi mở trang. Hãy quay lại trang trước hoặc về trang chủ.', label: 'Lỗi máy chủ' },
  502: { title: 'Dịch vụ tạm thời gián đoạn', message: 'Hệ thống chưa nhận được phản hồi hợp lệ. Hãy thử lại sau ít phút.', label: 'Lỗi cổng dịch vụ' },
  503: { title: 'Dịch vụ đang bảo trì', message: 'Chức năng này tạm thời chưa sẵn sàng. Hãy thử lại sau ít phút.', label: 'Dịch vụ chưa sẵn sàng' },
  504: { title: 'Dịch vụ phản hồi chậm', message: 'Hệ thống chưa phản hồi kịp thời. Hãy thử lại sau ít phút.', label: 'Hết thời gian phản hồi' },
});

export default function HttpErrorPage({ status = 500, embedded = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const titleRef = useRef(null);
  const code = Number(status);
  const copy = ERROR_COPY[code] || ERROR_COPY[500];
  const workspaceHome = user?.role === 'admin' ? '/admin' : user?.role === 'staff' ? '/staff' : '/';
  const primaryTarget = code === 401 ? '/dang-nhap' : workspaceHome;
  const primaryLabel = code === 401 ? 'Đăng nhập lại' : workspaceHome === '/' ? 'Về trang chủ' : 'Về không gian làm việc';

  useEffect(() => { titleRef.current?.focus(); }, [code]);

  const PageRegion = embedded ? 'section' : 'main';
  return <PageRegion className="http-error-page" aria-labelledby="http-error-title">
    <section className="http-error-card" aria-describedby="http-error-description">
      <p className="http-error-card__eyebrow">{copy.label}</p>
      <p className="http-error-card__code" aria-label={`Mã lỗi ${code}`}>{code}</p>
      <h1 id="http-error-title" ref={titleRef} tabIndex={-1}>{copy.title}</h1>
      <p id="http-error-description" className="http-error-card__description">{copy.message}</p>
      <div className="http-error-card__actions">
        <Link className="http-error-card__primary" to={primaryTarget}>{primaryLabel}</Link>
        {code === 403 && workspaceHome === '/'
          ? <Link className="http-error-card__secondary" to="/">Về trang chủ</Link>
          : <button className="http-error-card__secondary" type="button" onClick={() => navigate(-1)}>Quay lại</button>}
      </div>
      <Link className="http-error-card__brand" to={workspaceHome} aria-label="TRO & LAM">TRO &amp; LAM</Link>
    </section>
  </PageRegion>;
}
