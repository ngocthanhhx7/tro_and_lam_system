import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import { ApiError } from '../../services/httpClient.js';
import { accountApi } from '../../services/account/account.api.js';
import './cart.css';

function cartError(error) {
  if (error instanceof ApiError && error.status === 401) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để xem giỏ hàng tài khoản.';
  if (error instanceof ApiError && error.status === 409) return 'Giỏ hàng đã được cập nhật ở nơi khác. Tải lại để xem thông tin mới nhất.';
  return error?.message || 'Chưa thể tải giỏ hàng. Hãy thử lại.';
}

function money(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
}

export default function CartPage() {
  const { user } = useAuth();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCart = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let response = await accountApi.getCart();
      if (user) {
        // The server consumes the opaque guest token and records it as merged in one transaction.
        response = await accountApi.mergeGuestCart(response.data.version);
      }
      setCart(response.data);
      if (response.data.adjustments?.length) setNotice('Một số số lượng đã được giới hạn tối đa 99 sản phẩm mỗi mặt hàng.');
      else setNotice('');
    } catch (loadError) {
      setError(cartError(loadError));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    async function loadInitialCart() {
      try {
        let response = await accountApi.getCart();
        if (user) response = await accountApi.mergeGuestCart(response.data.version);
        if (!active) return;
        setCart(response.data);
        setNotice(response.data.adjustments?.length
          ? 'Một số số lượng đã được giới hạn tối đa 99 sản phẩm mỗi mặt hàng.'
          : '');
      } catch (loadError) {
        if (active) setError(cartError(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadInitialCart();
    return () => { active = false; };
  }, [user]);

  async function setQuantity(item, quantity) {
    if (quantity < 1 || quantity > 99) return;
    setPendingId(item.productId);
    setError('');
    try {
      const response = await accountApi.setCartItemQuantity(item.productId, quantity, cart.version);
      setCart(response.data);
    } catch (updateError) {
      setError(cartError(updateError));
    } finally {
      setPendingId(null);
    }
  }

  async function removeItem(item) {
    setPendingId(item.productId);
    setError('');
    try {
      const response = await accountApi.removeCartItem(item.productId, cart.version);
      setCart(response.data);
      setNotice('Đã xóa sản phẩm khỏi giỏ hàng.');
    } catch (removeError) {
      setError(cartError(removeError));
    } finally {
      setPendingId(null);
    }
  }

  return <section className="cart-page">
    <div className="cart-page__intro">
      <p className="cart-page__eyebrow">TRO & LAM</p>
      <h1>Giỏ hàng</h1>
      <p>Giá được lấy từ danh mục hiện tại. Giá và khả năng cung ứng sẽ được xác nhận lại khi báo giá thanh toán.</p>
    </div>
    {error && <div className="cart-message cart-message--error" role="alert">{error} <button type="button" onClick={loadCart}>Tải lại giỏ hàng</button></div>}
    {notice && <p className="cart-message cart-message--success" role="status">{notice}</p>}
    {loading && <div className="cart-loading" role="status" aria-busy="true">Đang tải giỏ hàng…</div>}
    {!loading && cart?.items.length === 0 && <div className="cart-empty"><h2>Giỏ hàng đang trống</h2><p>Chọn sản phẩm phù hợp để tiếp tục.</p><Link className="cart-button" to="/san-pham">Xem sản phẩm</Link></div>}
    {!loading && Boolean(cart?.items.length) && <div className="cart-layout">
      <div className="cart-items" aria-label="Các sản phẩm trong giỏ hàng">
        {cart.warnings.map((warning) => <p className="cart-message cart-message--warning" key={warning.productId}>Một sản phẩm không còn được mở bán. Bạn có thể xóa sản phẩm khỏi giỏ.</p>)}
        {cart.items.map((item) => <article className="cart-item" key={item.productId}>
          {item.product?.imageUrl
            ? <img className="cart-item__image" src={item.product.imageUrl} alt={item.product.name} loading="lazy" />
            : <div className="cart-item__image cart-item__image--empty" aria-hidden="true">TRO & LAM</div>}
          <div className="cart-item__details">
            <h2>{item.product?.name || 'Sản phẩm không còn mở bán'}</h2>
            {item.product && <p>Mã sản phẩm: {item.product.sku}</p>}
            {item.product && <p>{money(item.product.priceVnd)} / sản phẩm</p>}
            <div className="cart-item__actions">
              {item.checkoutEligible && <div className="cart-quantity" aria-label={`Số lượng ${item.product.name}`}>
                <button type="button" aria-label={`Giảm số lượng ${item.product.name}`} onClick={() => setQuantity(item, item.quantity - 1)} disabled={pendingId === item.productId || item.quantity <= 1}>−</button>
                <span aria-live="polite">{item.quantity}</span>
                <button type="button" aria-label={`Tăng số lượng ${item.product.name}`} onClick={() => setQuantity(item, item.quantity + 1)} disabled={pendingId === item.productId || item.quantity >= 99}>+</button>
              </div>}
              <button className="cart-remove" type="button" onClick={() => removeItem(item)} disabled={pendingId === item.productId}>{pendingId === item.productId ? 'Đang cập nhật…' : 'Xóa'}</button>
            </div>
          </div>
          <strong className="cart-item__total">{item.lineTotalVnd === null ? 'Cần kiểm tra lại' : money(item.lineTotalVnd)}</strong>
        </article>)}
      </div>
      <aside className="cart-summary" aria-labelledby="cart-summary-title">
        <h2 id="cart-summary-title">Tạm tính</h2>
        <p>Thành tiền sản phẩm <strong>{money(cart.subtotalVnd)}</strong></p>
        <p className="cart-summary__note">Phí giao hàng và tổng cuối cùng được xác nhận ở bước thanh toán.</p>
        <Link className="cart-button" to="/thanh-toan">Tiếp tục thanh toán</Link>
        {!user && <p className="cart-summary__note">Bạn có thể thanh toán với tư cách khách hoặc <Link to="/dang-nhap">đăng nhập</Link> để đồng bộ giỏ hàng.</p>}
        {user && <p className="cart-summary__note">Đã đăng nhập: giỏ khách được gộp một lần vào giỏ tài khoản trên máy chủ.</p>}
      </aside>
    </div>}
  </section>;
}
