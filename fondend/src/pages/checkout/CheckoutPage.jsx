import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import {
  clearRetryableCheckoutKey,
  commerceApi,
  retryableCheckoutKey,
} from '../../services/commerce/commerce.api.js';
import PaymentPanel from '../../components/payment/PaymentPanel.jsx';
import { formatMoney } from '../commerce/commerce.format.js';
import '../commerce/commerce.css';

const recordId = (value) => String(value?.id ?? value?._id ?? '');
const cartProductId = (item) => String(item?.productId ?? item?.product?.id ?? item?.product?._id ?? '');

const blankRecipient = (user) => ({
  recipientName: user?.name || '', email: user?.email || '', phone: user?.phone || '',
  line1: '', line2: '', ward: '', province: '', countryCode: 'VN', formattedAddress: '',
});

function messageFor(error, fallback) {
  return error?.message || fallback;
}

export default function CheckoutPage() {
  const { user, loading: authLoading, errorCode: authErrorCode } = useAuth();
  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [addressChoice, setAddressChoice] = useState('manual');
  const [recipient, setRecipient] = useState(() => blankRecipient(user));
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [addressError, setAddressError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cartResponse = await commerceApi.getCart();
      setCart(cartResponse);
      setQuote(null);
      if (user) {
        try {
          const saved = await commerceApi.listAddresses();
          const list = Array.isArray(saved) ? saved : [];
          setAddresses(list);
          const defaultAddress = list.find((address) => address.isDefault);
          if (defaultAddress) setAddressChoice(recordId(defaultAddress));
          else setAddressChoice('manual');
          setAddressError(null);
        } catch (requestError) {
          setAddresses([]);
          setAddressChoice('manual');
          setAddressError(requestError);
        }
        setRecipient((current) => ({ ...current, ...blankRecipient(user) }));
      } else {
        setAddresses([]);
        setAddressChoice('manual');
        setRecipient(blankRecipient(null));
      }
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading || authErrorCode === 'ACCOUNT_BLOCKED') return;
    void Promise.resolve().then(load);
  }, [authLoading, authErrorCode, load]);

  const items = useMemo(() => Array.isArray(cart?.items) ? cart.items : [], [cart]);
  const selectedAddressId = addressChoice === 'manual' ? '' : addressChoice;
  const requestBody = useMemo(() => ({
    items: items.map((item) => ({ productId: cartProductId(item), quantity: item.quantity })),
    ...(selectedAddressId ? { addressId: selectedAddressId } : {
      recipient: {
        ...recipient,
        email: user?.email || recipient.email,
        ...(recipient.line2.trim() ? {} : { line2: undefined }),
        ...(recipient.ward.trim() ? {} : { ward: undefined }),
        ...(recipient.province.trim() ? {} : { province: undefined }),
      },
    }),
    paymentMethod,
  }), [items, selectedAddressId, recipient, user?.email, paymentMethod]);

  function updateRecipient(event) {
    const { name, value } = event.target;
    setRecipient((current) => ({ ...current, [name]: value }));
    setQuote(null);
  }

  async function requestQuote(event) {
    event.preventDefault();
    setBusy('quote');
    setError(null);
    try {
      if (requestBody.items.some((item) => !item.productId)) throw new Error('Giỏ hàng chưa có mã sản phẩm hợp lệ. Hãy mở giỏ hàng và thử tải lại.');
      const response = await commerceApi.quoteCheckout(requestBody);
      setQuote(response);
    } catch (requestError) {
      setQuote(null);
      setError(requestError);
    } finally {
      setBusy('');
    }
  }

  async function submitOrder(event) {
    event.preventDefault();
    setError(null);
    if (!consent) {
      setError(new Error('Xác nhận thông tin nhận hàng trước khi đặt hàng.'));
      return;
    }
    if (!quote || Date.parse(quote.quoteExpiresAt) <= Date.now()) {
      setError(new Error('Báo giá đã hết hạn. Hãy tính lại phí và kiểm tra tồn kho trước khi đặt.'));
      return;
    }
    setBusy('create');
    try {
      const body = { ...requestBody, ...(note.trim() ? { note: note.trim() } : {}), consent };
      const key = await retryableCheckoutKey(body);
      const result = await commerceApi.createOrder(body, key);
      clearRetryableCheckoutKey();
      setConfirmation(result);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setBusy('');
    }
  }

  if (authErrorCode === 'ACCOUNT_BLOCKED') return <section className="commerce-page commerce-narrow">
    <p className="commerce-eyebrow">TÀI KHOẢN</p><h1>Tài khoản đang bị khóa</h1>
    <p>Quyền checkout bị tạm dừng. Bạn có thể gửi yêu cầu xem xét sau khi xác minh quyền truy cập.</p>
    <Link className="commerce-secondary" to="/tai-khoan/bi-khoa">Mở hướng dẫn kháng nghị</Link>
  </section>;
  if (authLoading || loading) return <section className="commerce-page" role="status"><p>Đang tải giỏ hàng và địa chỉ…</p></section>;

  if (confirmation) {
    const order = confirmation.order;
    return <section className="commerce-page commerce-confirmation">
      <p className="commerce-eyebrow">ĐƠN HÀNG ĐÃ ĐƯỢC TIẾP NHẬN</p>
      <h1>Cảm ơn bạn đã đặt hàng</h1>
      <p>Mã đơn <strong>{order.code}</strong>. Trạng thái hiện tại: <strong>{order.status}</strong>.</p>
      <p>Tổng tiền do hệ thống xác nhận: <strong>{formatMoney(order.totalVnd)}</strong>.</p>
      <PaymentPanel
        orderId={order.id}
        paymentMethod={order.paymentMethod}
        paymentStatus={order.paymentStatus}
        orderStatus={order.status}
        autoCreate
      />
      {error && <p className="commerce-error" role="alert">{messageFor(error, 'Không thể hoàn tất đơn hàng.')}</p>}
      <div className="commerce-actions">
        <Link className="commerce-primary" to={`/don-hang/${encodeURIComponent(order.id)}`}>Xem chi tiết đơn</Link>
        <Link className="commerce-secondary" to="/tra-cuu-don-hang">Tra cứu đơn hàng</Link>
      </div>
    </section>;
  }

  if (error && !cart) return <section className="commerce-page">
    <p className="commerce-eyebrow">CHECKOUT</p><h1>Chưa thể mở giỏ hàng</h1>
    <p className="commerce-error" role="alert">{messageFor(error, 'Giỏ hàng chưa sẵn sàng.')}</p>
    <button className="commerce-secondary" type="button" onClick={() => void load()}>Thử lại</button>
  </section>;

  if (items.length === 0) return <section className="commerce-page">
    <p className="commerce-eyebrow">CHECKOUT</p><h1>Giỏ hàng đang trống</h1>
    <p>Thêm sản phẩm vào giỏ để nhận báo giá giao hàng từ hệ thống.</p>
    <Link className="commerce-primary" to="/san-pham">Xem sản phẩm</Link>
  </section>;

  const selectedAddress = addresses.find((address) => recordId(address) === selectedAddressId);
  const quoteExpired = quote && Date.parse(quote.quoteExpiresAt) <= currentTime;

  return <section className="commerce-page">
    <p className="commerce-eyebrow">CHECKOUT</p>
    <h1>Thông tin nhận hàng</h1>
    <p className="commerce-lede">Giá sản phẩm, phí giao hàng và tình trạng tồn kho được máy chủ tính lại trước khi tạo đơn.</p>
    <div className="commerce-checkout-layout">
      <form className="commerce-panel commerce-form" onSubmit={submitOrder}>
        {user && addresses.length > 0 && <label className="commerce-field" htmlFor="checkout-address">
          <span>Địa chỉ nhận hàng</span>
          <select id="checkout-address" value={addressChoice} onChange={(event) => { setAddressChoice(event.target.value); setQuote(null); }}>
            <option value="manual">Nhập địa chỉ khác</option>
            {addresses.map((address) => <option key={recordId(address)} value={recordId(address)}>
              {address.label || address.recipientName} · {address.formattedAddress}
            </option>)}
          </select>
        </label>}
        {addressError && <p className="commerce-note">Chưa tải được sổ địa chỉ. Bạn vẫn có thể nhập địa chỉ nhận hàng thủ công.</p>}
        {selectedAddress ? <div className="commerce-address-card">
          <strong>{selectedAddress.recipientName}</strong><span>{selectedAddress.phone}</span>
          <span>{selectedAddress.formattedAddress}</span><span>Email liên hệ: {user.email}</span>
        </div> : <div className="commerce-field-grid">
          <label className="commerce-field" htmlFor="recipient-name"><span>Người nhận</span><input id="recipient-name" name="recipientName" value={recipient.recipientName} onChange={updateRecipient} required maxLength={100} autoComplete="name" /></label>
          {!user && <label className="commerce-field" htmlFor="recipient-email"><span>Email nhận xác nhận</span><input id="recipient-email" name="email" type="email" value={recipient.email} onChange={updateRecipient} required maxLength={254} autoComplete="email" /></label>}
          {user && <p className="commerce-note">Email xác nhận: <strong>{user.email}</strong></p>}
          <label className="commerce-field" htmlFor="recipient-phone"><span>Số điện thoại</span><input id="recipient-phone" name="phone" type="tel" value={recipient.phone} onChange={updateRecipient} required maxLength={30} autoComplete="tel" /></label>
          <label className="commerce-field" htmlFor="recipient-line1"><span>Địa chỉ</span><input id="recipient-line1" name="line1" value={recipient.line1} onChange={updateRecipient} required maxLength={200} autoComplete="address-line1" /></label>
          <label className="commerce-field" htmlFor="recipient-line2"><span>Địa chỉ bổ sung <small>(không bắt buộc)</small></span><input id="recipient-line2" name="line2" value={recipient.line2} onChange={updateRecipient} maxLength={200} autoComplete="address-line2" /></label>
          <label className="commerce-field" htmlFor="recipient-ward"><span>Phường / xã <small>(không bắt buộc)</small></span><input id="recipient-ward" name="ward" value={recipient.ward} onChange={updateRecipient} maxLength={100} /></label>
          <label className="commerce-field" htmlFor="recipient-province"><span>Tỉnh / thành phố <small>(không bắt buộc)</small></span><input id="recipient-province" name="province" value={recipient.province} onChange={updateRecipient} maxLength={100} autoComplete="address-level1" /></label>
          <label className="commerce-field" htmlFor="recipient-formatted"><span>Địa chỉ đầy đủ</span><textarea id="recipient-formatted" name="formattedAddress" value={recipient.formattedAddress} onChange={updateRecipient} required maxLength={500} rows={3} /></label>
        </div>}

        <label className="commerce-field" htmlFor="checkout-payment"><span>Phương thức thanh toán</span>
          <select id="checkout-payment" value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setQuote(null); }}>
            <option value="cod">Thanh toán khi nhận hàng (nếu đang được cấu hình)</option>
            <option value="payos">Thanh toán trực tuyến qua PayOS (nếu đang được cấu hình)</option>
          </select>
        </label>
        <label className="commerce-field" htmlFor="checkout-note"><span>Ghi chú <small>(không bắt buộc)</small></span><textarea id="checkout-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} /></label>
        <label className="commerce-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Tôi xác nhận thông tin nhận hàng và yêu cầu xử lý đơn hàng này.</span></label>
        {error && <p className="commerce-error" role="alert">{messageFor(error, 'Không thể hoàn tất thao tác.')}{error.requestId && <small>Mã yêu cầu: {error.requestId}</small>}</p>}
        <div className="commerce-actions">
          <button className="commerce-secondary" type="button" disabled={busy !== ''} onClick={requestQuote}>
            {busy === 'quote' ? 'Đang tính…' : 'Tính phí và kiểm tra tồn'}
          </button>
          <button className="commerce-primary" type="submit" disabled={busy !== '' || !consent || !quote || quoteExpired || quote.warnings?.length > 0}>
            {busy === 'create' ? 'Đang tạo đơn…' : 'Xác nhận đặt hàng'}
          </button>
        </div>
      </form>

      <aside className="commerce-panel commerce-summary" aria-labelledby="checkout-summary-heading">
        <h2 id="checkout-summary-heading">Đơn hàng của bạn</h2>
        <ul className="commerce-line-items">{items.map((item, index) => {
          const id = cartProductId(item) || String(index);
          const quoted = quote?.items?.find((entry) => entry.productId === id);
          return <li key={id}>
            <span><strong>{quoted?.name || item.name || item.product?.name || 'Sản phẩm gốm'}</strong><small>SKU {quoted?.sku || item.sku || item.product?.sku || '—'} · SL {item.quantity}</small></span>
            <span>{quoted ? formatMoney(quoted.unitPriceVnd * quoted.quantity) : 'Chờ báo giá'}</span>
          </li>;
        })}</ul>
        {quote?.warnings?.length > 0 && <div className="commerce-error" role="alert"><strong>Chưa đủ tồn kho</strong><p>Giỏ hàng cần được cập nhật trước khi đặt.</p></div>}
        <dl className="commerce-totals">
          <div><dt>Tạm tính</dt><dd>{quote ? formatMoney(quote.subtotalVnd) : '—'}</dd></div>
          <div><dt>Phí giao hàng</dt><dd>{quote ? formatMoney(quote.shippingFeeVnd) : 'Chưa xác định'}</dd></div>
          <div className="commerce-total"><dt>Tổng cộng</dt><dd>{quote ? formatMoney(quote.totalVnd) : '—'}</dd></div>
        </dl>
        {quote?.quoteExpiresAt && <p className="commerce-note">Báo giá đến {new Date(quote.quoteExpiresAt).toLocaleTimeString('vi-VN')}.</p>}
        {quoteExpired && <p className="commerce-error" role="status">Báo giá hết hạn. Hãy tính lại để kiểm tra phí và tồn kho.</p>}
        <p className="commerce-note">Phí được lấy từ cấu hình cửa hàng. Nếu phương thức thanh toán, vùng giao hàng hoặc phí chưa được cấu hình, hệ thống sẽ báo lỗi và không tạo đơn.</p>
      </aside>
    </div>
  </section>;
}
