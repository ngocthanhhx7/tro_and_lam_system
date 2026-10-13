import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import {
  clearRetryableCheckoutKey,
  commerceApi,
  retryableCheckoutKey,
} from '../../services/commerce/commerce.api.js';
import PaymentPanel from '../../components/payment/PaymentPanel.jsx';
import { voucherApi } from '../../services/commerce/voucher.api.js';
import { formatMoney } from '../commerce/commerce.format.js';
import '../commerce/commerce.css';
import useAutomaticQuote from './useAutomaticQuote.js';
import { createRequestScope } from '../../services/requestScope.js';

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
  const location = useLocation();
  const [cart, setCart] = useState(null);
  const [checkoutOptions, setCheckoutOptions] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [voucherLoadError, setVoucherLoadError] = useState('');
  const [voucherId, setVoucherId] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherError, setVoucherError] = useState('');
  const [applyingVoucher, setApplyingVoucher] = useState(false);
  const [addressChoice, setAddressChoice] = useState('manual');
  const [recipient, setRecipient] = useState(() => blankRecipient(user));
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [addressError, setAddressError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const loadScope = useRef(createRequestScope());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    const isCurrent = loadScope.current.begin();
    setLoading(true);
    setError(null);
    setApplyingVoucher(false);
    setVoucherCode('');
    setVoucherError('');
    setConsent(false);
    setConfirmation(null);
    try {
      const [cartResult, optionsResult, addressesResult, vouchersResult] = await Promise.allSettled([
        commerceApi.getCart(), commerceApi.getCheckoutOptions(),
        user ? commerceApi.listAddresses() : Promise.resolve([]),
        user?.role === 'customer' ? voucherApi.listMine() : Promise.resolve({ data: [] }),
      ]);
      if (!isCurrent()) return;
      if (cartResult.status === 'rejected') throw cartResult.reason;
      if (optionsResult.status === 'rejected') throw optionsResult.reason;
      const cartResponse = cartResult.value;
      const options = optionsResult.value;
      setCart(cartResponse);
      setCheckoutOptions(options);
      setPaymentMethod(current => options.paymentMethods.includes(current) ? current : (options.paymentMethods[0] || ''));
      if (user) {
        try {
          if (addressesResult.status === 'rejected') throw addressesResult.reason;
          const saved = addressesResult.value;
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
        if (user.role === 'customer') {
          setVoucherId('');
          try {
            if (vouchersResult.status === 'rejected') throw vouchersResult.reason;
            const savedVouchers = vouchersResult.value;
            setVouchers(Array.isArray(savedVouchers.data) ? savedVouchers.data : []);
            setVoucherLoadError('');
          } catch (requestError) {
            setVouchers([]);
            setVoucherLoadError(requestError.message || 'Chưa thể tải voucher của bạn.');
          }
        } else {
          setVouchers([]);
          setVoucherId('');
          setVoucherLoadError('');
        }
      } else {
        setAddresses([]);
        setAddressChoice('manual');
        setRecipient(blankRecipient(null));
        setVouchers([]);
        setVoucherId('');
        setVoucherLoadError('');
      }
    } catch (requestError) {
      if (isCurrent()) setError(requestError);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const scope = loadScope.current;
    if (authLoading || authErrorCode === 'ACCOUNT_BLOCKED') return;
    let live = true;
    void Promise.resolve().then(() => { if (live) return load(); });
    return () => { live = false; scope.invalidate(); };
  }, [authLoading, authErrorCode, load]);

  const items = useMemo(() => {
    const rows = Array.isArray(cart?.items) ? cart.items : [];
    const selected = location.state?.selectedProductIds;
    if (!Array.isArray(selected)) return rows;
    if (location.state.cartOwner !== (user?.id || 'guest')) return [];
    return rows.filter(item => selected.includes(cartProductId(item)));
  }, [cart, location.state, user?.id]);
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
    ...(voucherId ? { voucherId } : {}),
    paymentMethod,
  }), [items, selectedAddressId, recipient, user?.email, paymentMethod, voucherId]);

  const recipientReady = selectedAddressId ? addresses.some(address => recordId(address) === selectedAddressId)
    : ['recipientName', 'phone', 'line1', 'province', 'formattedAddress'].every(field => recipient[field].trim())
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test((user?.email || recipient.email).trim());
  const autoQuote = useAutomaticQuote(requestBody, !loading && !authLoading && !confirmation && busy !== 'create'
    && !applyingVoucher && checkoutOptions?.checkoutConfigured === true && recipientReady
    && items.length > 0 && items.every(item => cartProductId(item)));
  const quote = autoQuote.quote;

  function updateRecipient(event) {
    const { name, value } = event.target;
    setRecipient((current) => ({ ...current, [name]: value }));
  }

  async function applyVoucher() {
    const isCurrent = loadScope.current.capture();
    setVoucherError('');
    if (user && user.role !== 'customer') { setVoucherError('Vai trò này không được sử dụng voucher.'); return; }
    setApplyingVoucher(true);
    try {
      const response = await (user ? voucherApi.resolveCode(voucherCode) : voucherApi.resolvePublicCode(voucherCode));
      if (!isCurrent()) return;
      setVoucherId(response.data.id);
      setVoucherCode(response.data.code);
    } catch (requestError) {
      if (isCurrent()) setVoucherError(messageFor(requestError, 'Mã voucher chưa khả dụng.'));
    } finally { if (isCurrent()) setApplyingVoucher(false); }
  }

  async function submitOrder(event) {
    event.preventDefault();
    setError(null);
    if (!consent) {
      setError(new Error('Xác nhận thông tin nhận hàng trước khi đặt hàng.'));
      return;
    }
    if (!quote || Date.parse(quote.quoteExpiresAt) <= Date.now()) {
      autoQuote.retry();
      setError(new Error('Hệ thống đang cập nhật tổng tiền. Vui lòng chờ một chút.'));
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
      <h1>{(order.paymentMethod || paymentMethod) === 'payos' ? 'Tiếp tục thanh toán qua PayOS' : 'Cảm ơn bạn đã đặt hàng'}</h1>
      <p>Mã đơn <strong>{order.code}</strong>. Trạng thái hiện tại: <strong>{order.status}</strong>.</p>
      <p>Tổng tiền do hệ thống xác nhận: <strong>{formatMoney(order.totalVnd)}</strong>.</p>
      <PaymentPanel
        orderId={order.id}
        paymentMethod={order.paymentMethod || paymentMethod}
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
    <p className="commerce-eyebrow">CHECKOUT</p><h1>Chưa có sản phẩm để thanh toán</h1>
    <p>Quay lại giỏ hàng và chọn các sản phẩm bạn muốn mua.</p>
    <Link className="commerce-primary" to="/gio-hang">Chọn sản phẩm trong giỏ</Link>
  </section>;

  const selectedAddress = addresses.find((address) => recordId(address) === selectedAddressId);
  const quoteExpired = quote && Date.parse(quote.quoteExpiresAt) <= currentTime;

  return <section className="commerce-page">
    <p className="commerce-eyebrow">CHECKOUT</p>
    <h1>Thông tin nhận hàng</h1>
    <p className="commerce-lede">Phí giao hàng và tồn kho được kiểm tra tự động khi bạn điền đủ thông tin nhận hàng.</p>
    {checkoutOptions && !checkoutOptions.checkoutConfigured && <p className="commerce-error" role="alert">Hiện chưa nhận đơn trực tuyến. Vui lòng liên hệ cửa hàng để được hỗ trợ.</p>}
    <div className="commerce-checkout-layout">
      <form className="commerce-panel commerce-form" onSubmit={submitOrder}>
        {user && addresses.length > 0 && <label className="commerce-field" htmlFor="checkout-address">
          <span>Địa chỉ nhận hàng</span>
          <select id="checkout-address" value={addressChoice} onChange={(event) => setAddressChoice(event.target.value)}>
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
          <label className="commerce-field" htmlFor="recipient-province"><span>Tỉnh / thành phố</span><input id="recipient-province" name="province" value={recipient.province} onChange={updateRecipient} required maxLength={100} autoComplete="address-level1" /></label>
          <label className="commerce-field" htmlFor="recipient-formatted"><span>Địa chỉ đầy đủ</span><textarea id="recipient-formatted" name="formattedAddress" value={recipient.formattedAddress} onChange={updateRecipient} required maxLength={500} rows={3} /></label>
        </div>}

        <label className="commerce-field" htmlFor="checkout-payment"><span>Phương thức thanh toán</span>
          <select id="checkout-payment" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            {!checkoutOptions?.paymentMethods.length && <option value="">Chưa có phương thức thanh toán khả dụng</option>}
            {checkoutOptions?.paymentMethods.map(method => <option key={method} value={method}>{method === 'cod' ? 'Thanh toán khi nhận hàng (COD)' : 'Thanh toán trực tuyến qua PayOS'}</option>)}
          </select>
        </label>
        <div className="commerce-field">
          <label htmlFor="checkout-voucher-code">Nhập mã voucher</label>
          <input id="checkout-voucher-code" value={voucherCode} disabled={applyingVoucher || busy !== ''} maxLength={40} autoComplete="off" placeholder="Nhập mã ưu đãi"
            onChange={event => { setVoucherCode(event.target.value); setVoucherError(''); }}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void applyVoucher(); } }} />
          <div className="commerce-actions"><button type="button" className="commerce-secondary" onClick={applyVoucher} disabled={applyingVoucher || busy !== '' || !voucherCode.trim()}>{applyingVoucher ? 'Đang kiểm tra mã…' : 'Áp dụng mã'}</button>
            {voucherId && <button type="button" className="commerce-secondary" disabled={applyingVoucher || busy !== ''} onClick={() => { setVoucherId(''); setVoucherCode(''); setVoucherError(''); }}>Bỏ voucher</button>}
          </div>
          {voucherError && <small role="alert">{voucherError}</small>}
          {!user && <small>Bạn có thể dùng mã ưu đãi áp dụng cho mọi khách hàng. Voucher cấp riêng cần đăng nhập đúng tài khoản.</small>}
        </div>
        {user?.role === 'customer' && <label className="commerce-field" htmlFor="checkout-voucher"><span>Hoặc chọn từ ví voucher</span>
          <select id="checkout-voucher" value={voucherId} disabled={applyingVoucher || busy !== ''} onChange={(event) => { setVoucherId(event.target.value); setVoucherCode(vouchers.find(voucher => voucher.id === event.target.value)?.code || ''); setVoucherError(''); }}>
            <option value="">Không dùng voucher</option>
            {vouchers.filter((voucher) => voucher.status === 'available').map((voucher) => <option key={voucher.id} value={voucher.id}>{voucher.code} · {voucher.title}</option>)}
          </select>
          {voucherLoadError && <small>{voucherLoadError}</small>}
          <small>Voucher còn hiệu lực và điều kiện tối thiểu sẽ được kiểm tra lại khi tính phí.</small>
        </label>}
        <label className="commerce-field" htmlFor="checkout-note"><span>Ghi chú <small>(không bắt buộc)</small></span><textarea id="checkout-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} /></label>
        <label className="commerce-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Tôi xác nhận thông tin nhận hàng và yêu cầu xử lý đơn hàng này.</span></label>
        {error && <p className="commerce-error" role="alert">{messageFor(error, 'Không thể hoàn tất thao tác.')}{error.requestId && <small>Mã yêu cầu: {error.requestId}</small>}</p>}
        {autoQuote.error && <p className="commerce-error" role="alert">{messageFor(autoQuote.error, 'Chưa thể kiểm tra đơn hàng.')} <button type="button" className="commerce-secondary" onClick={autoQuote.retry}>Thử lại</button></p>}
        <p className="commerce-note" role="status">{autoQuote.pending ? 'Đang cập nhật phí giao hàng và kiểm tra tồn kho…' : quote ? 'Tổng tiền và tồn kho đã được kiểm tra.' : 'Điền đủ thông tin nhận hàng để hệ thống tự cập nhật tổng tiền.'}</p>
        <div className="commerce-actions">
          <button className="commerce-primary" type="submit" disabled={busy !== '' || applyingVoucher || autoQuote.pending || !consent || !quote || quoteExpired || quote.warnings?.length > 0}>
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
            <span>{quoted ? formatMoney(quoted.unitPriceVnd * quoted.quantity) : Number.isSafeInteger(item.lineTotalVnd) ? formatMoney(item.lineTotalVnd) : 'Chưa có giá'}</span>
          </li>;
        })}</ul>
        {quote?.warnings?.length > 0 && <div className="commerce-error" role="alert"><strong>Chưa đủ tồn kho</strong><p>Giỏ hàng cần được cập nhật trước khi đặt.</p></div>}
        <dl className="commerce-totals">
          <div><dt>Tạm tính</dt><dd>{formatMoney(quote?.subtotalVnd ?? items.reduce((total, item) => total + (item.lineTotalVnd || 0), 0))}</dd></div>
          <div><dt>Giảm giá voucher</dt><dd>{quote ? `−${formatMoney(quote.discountVnd || 0)}` : '—'}</dd></div>
          <div><dt>Phí giao hàng</dt><dd>{quote ? formatMoney(quote.shippingFeeVnd) : 'Chưa xác định'}</dd></div>
          <div className="commerce-total"><dt>Tổng cộng</dt><dd>{quote ? formatMoney(quote.totalVnd) : '—'}</dd></div>
        </dl>
        {quote?.voucher && <p className="commerce-note">Đã áp dụng mã <strong>{quote.voucher.code}</strong>.</p>}
        {quoteExpired && <p className="commerce-note" role="status">Đang tự cập nhật tổng tiền và tồn kho…</p>}
        <p className="commerce-note">Kiểm tra địa chỉ nhận hàng và tổng tiền trước khi xác nhận đặt hàng.</p>
      </aside>
    </div>
  </section>;
}
