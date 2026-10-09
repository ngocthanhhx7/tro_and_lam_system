import { useCallback, useEffect, useState } from 'react';
import { voucherApi } from '../../services/commerce/voucher.api.js';
import { formatMoney } from '../commerce/commerce.format.js';
import '../identity/identity.css';
import './voucher-wallet.css';

function formatDate(value) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

function discountLabel(voucher) {
  return voucher.discountType === 'percent'
    ? `Giảm ${voucher.discountValue}%${voucher.maxDiscountVnd ? `, tối đa ${formatMoney(voucher.maxDiscountVnd)}` : ''}`
    : `Giảm ${formatMoney(voucher.discountValue)}`;
}

export default function VoucherWalletPage() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await voucherApi.listMine();
      setVouchers(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(requestError.message || 'Không thể tải kho voucher.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  async function copyCode(voucher) {
    try {
      await navigator.clipboard.writeText(voucher.code);
      setCopied(voucher.id);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setError('Trình duyệt không cho phép sao chép. Bạn có thể chọn và sao chép mã voucher.');
    }
  }

  return <section className="identity-page identity-page--wide"><div className="identity-card">
    <p className="identity-eyebrow">ƯU ĐÃI CỦA BẠN</p><h1>Kho voucher</h1>
    <p className="identity-description">Voucher được cấp bởi TRO & LAM. Chọn voucher còn hạn tại bước thanh toán để áp dụng.</p>
    {loading && <p role="status">Đang tải voucher…</p>}
    {error && <p className="identity-feedback identity-feedback--error" role="alert">{error} <button type="button" onClick={() => void load()}>Thử lại</button></p>}
    {!loading && !error && vouchers.length === 0 && <p className="identity-description">Bạn chưa có voucher được cấp.</p>}
    <div className="voucher-wallet-list">
      {vouchers.map((voucher) => <article className={`voucher-wallet-card voucher-wallet-card--${voucher.status}`} key={voucher.id}>
        <div><span className="identity-eyebrow">{voucher.status === 'available' ? 'CÒN HIỆU LỰC' : voucher.status === 'redeemed' ? 'ĐÃ SỬ DỤNG' : voucher.status === 'expired' ? 'ĐÃ HẾT HẠN' : 'ĐÃ THU HỒI'}</span>
          <h2>{voucher.title}</h2><p>{discountLabel(voucher)}</p>
          {voucher.minSubtotalVnd > 0 && <p>Đơn tối thiểu {formatMoney(voucher.minSubtotalVnd)}</p>}
          <p>Hạn dùng đến {formatDate(voucher.expiresAt)}</p>
        </div>
        <div className="voucher-wallet-card__code"><code>{voucher.code}</code>
          {voucher.status === 'available' && <button type="button" className="identity-secondary" onClick={() => void copyCode(voucher)}>{copied === voucher.id ? 'Đã sao chép' : 'Sao chép mã'}</button>}
        </div>
      </article>)}
    </div>
  </div></section>;
}
