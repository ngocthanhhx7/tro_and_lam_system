import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supportApi } from '../../services/support/support.api.js';
import './support.css';

const INITIAL_FORM = { name: '', email: '', phone: '', company: '', quantity: '', message: '', consent: false };

export default function ContactPage({ corporate = false }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const location = useLocation();
  const productId = new URLSearchParams(location.search).get('productId') || undefined;
  const kind = corporate ? 'corporate' : productId ? 'quote' : 'general';
  const title = corporate ? 'Quà tặng dành cho tổ chức' : productId ? 'Trao đổi về sản phẩm' : 'Liên hệ TRO & LAM';

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setReference('');
    const body = {
      name: form.name.trim(), email: form.email.trim(), kind,
      message: form.message.trim(), consent: form.consent,
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...(corporate && form.company.trim() ? { company: form.company.trim() } : {}),
      ...(productId ? { productId } : {}),
      ...(form.quantity ? { quantity: Number(form.quantity) } : {}),
    };
    try {
      const response = await supportApi.createContact(body);
      setReference(response.data.id);
      setForm(INITIAL_FORM);
    } catch (requestError) {
      setError(requestError.message || 'Chưa thể gửi yêu cầu. Vui lòng thử lại sau.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="support-page support-page--contact">
    <nav className="support-breadcrumbs" aria-label="Vị trí hiện tại"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">{title}</span></nav>
    <div className="support-intro support-intro--split">
      <div>
        <p className="support-eyebrow">TRO &amp; LAM · GỐM TRONG ĐỜI SỐNG</p>
        <h1>{title}</h1>
        <p>{corporate
          ? 'Chia sẻ mục đích, số lượng dự kiến và thời gian cần nhận để đội ngũ xem xét yêu cầu quà tặng văn hóa.'
          : productId ? 'Gửi câu hỏi hoặc yêu cầu báo giá cho sản phẩm đang xem. Thông tin được chuyển tới đội ngũ tiếp nhận.'
            : 'Gửi câu hỏi về sản phẩm, câu chuyện hoặc dịch vụ. Đội ngũ sẽ tiếp nhận theo thông tin bạn cung cấp.'}</p>
      </div>
      <aside className="support-note"><span aria-hidden="true">✳</span><p>Nội dung về chất liệu, xuất xứ, giá và khả năng cung cấp sẽ được xác nhận theo thông tin sản phẩm đã công bố.</p></aside>
    </div>

    <form className="support-card support-form" onSubmit={submit}>
      <div className="support-form__grid">
        <label className="support-field">Họ và tên <span aria-hidden="true">*</span>
          <input name="name" autoComplete="name" maxLength="120" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label className="support-field">Email <span aria-hidden="true">*</span>
          <input name="email" type="email" autoComplete="email" maxLength="254" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label className="support-field">Số điện thoại <span className="support-optional">(không bắt buộc)</span>
          <input name="phone" type="tel" autoComplete="tel" maxLength="30" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </label>
        {corporate && <label className="support-field">Tên tổ chức <span className="support-optional">(không bắt buộc)</span>
          <input name="company" autoComplete="organization" maxLength="160" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
        </label>}
        {kind === 'quote' && <label className="support-field">Số lượng dự kiến <span className="support-optional">(không bắt buộc)</span>
          <input name="quantity" type="number" min="1" max="99" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
        </label>}
      </div>
      <label className="support-field">Nội dung <span aria-hidden="true">*</span>
        <textarea name="message" rows="6" maxLength="5000" required value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
      </label>
      <label className="support-consent"><input type="checkbox" required checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} />
        <span>Tôi đồng ý để TRO &amp; LAM sử dụng thông tin liên hệ này nhằm phản hồi yêu cầu.</span>
      </label>
      {error && <p className="support-feedback support-feedback--error" role="alert">{error}</p>}
      {reference && <p className="support-feedback support-feedback--success" role="status">Yêu cầu đã được ghi nhận trong hàng đợi. Mã tham chiếu: <strong>{reference}</strong></p>}
      <button className="support-button" type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu'} <span aria-hidden="true">→</span></button>
      <p className="support-privacy">Chỉ gửi thông tin cần thiết để đội ngũ có thể phản hồi. Không gửi dữ liệu thanh toán hoặc giấy tờ tùy thân.</p>
    </form>
  </section>;
}
