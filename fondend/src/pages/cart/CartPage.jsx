import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/auth.context.js';
import ProductCard from '../../components/catalog/ProductCard.jsx';
import { ApiError } from '../../services/httpClient.js';
import { accountApi } from '../../services/account/account.api.js';
import { searchPublishedProducts } from '../../services/catalog/catalogApi.js';
import './cart.css';

function cartError(error) {
  if (error instanceof ApiError && error.status === 401) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để xem giỏ hàng tài khoản.';
  if (error instanceof ApiError && error.status === 409) return 'Giỏ hàng đã được cập nhật ở nơi khác. Tải lại để xem thông tin mới nhất.';
  return error?.message || 'Chưa thể tải giỏ hàng. Hãy thử lại.';
}

function money(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
}

function isPurchasable(product) {
  return ['buy', 'both'].includes(product?.saleMode)
    && product.availableForPurchase === true
    && Number.isSafeInteger(product.priceVnd)
    && product.priceVnd > 0;
}

export default function CartPage() {
  const { user } = useAuth();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [recommendations, setRecommendations] = useState([]);

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

  const cartProductIds = cart?.items?.map((item) => item.productId).join('|') || '';
  useEffect(() => {
    if (loading) return undefined;
    let active = true;
    const inCart = new Set(cartProductIds ? cartProductIds.split('|') : []);
    searchPublishedProducts({ limit: 12 })
      .then((response) => {
        if (!active) return;
        setRecommendations((response.data || [])
          .filter((product) => !inCart.has(product.id) && isPurchasable(product))
          .slice(0, 4));
      })
      .catch(() => { if (active) setRecommendations([]); });
    return () => { active = false; };
  }, [cartProductIds, loading]);

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

  const items = cart?.items || [];
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);
  const checkoutAllowed = items.length > 0 && items.every((item) => item.checkoutEligible);

  return <section className="cart-page" aria-labelledby="cart-title">
    <div className="cart-page__container">
      <nav className="cart-breadcrumbs" aria-label="Vị trí hiện tại">
        <Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">Giỏ hàng</span>
      </nav>
      <div className="cart-page__intro">
        <div>
          <p className="cart-page__eyebrow">TRO &amp; LAM · GỐM CHU ĐẬU</p>
          <h1 id="cart-title">Giỏ hàng của bạn</h1>
          <p>Kiểm tra những sản phẩm bạn đã chọn trước khi tiếp tục.</p>
        </div>
        {cart && <div className="cart-count"><span aria-hidden="true" />{itemCount} sản phẩm</div>}
      </div>

      {error && <div className="cart-message cart-message--error" role="alert">{error} <button type="button" onClick={loadCart}>Tải lại giỏ hàng</button></div>}
      {notice && <p className="cart-message cart-message--success" role="status">{notice}</p>}
      {loading && <div className="cart-loading" role="status" aria-busy="true">Đang tải giỏ hàng…</div>}

      {!loading && cart && items.length === 0 && <div className="cart-empty">
        <span className="cart-empty__mark" aria-hidden="true">◇</span>
        <p className="cart-page__eyebrow">MỘT MÓN GỐM ĐANG CHỜ BẠN</p>
        <h2>Giỏ hàng đang trống</h2>
        <p>Khám phá các dòng sản phẩm để tìm món gốm phù hợp.</p>
        <Link className="cart-button" to="/san-pham">Tiếp tục khám phá sản phẩm</Link>
      </div>}

      {!loading && items.length > 0 && <div className="cart-layout">
        <section className="cart-items" aria-label="Các sản phẩm trong giỏ hàng">
          <div className="cart-table-header" aria-hidden="true">
            <span className="cart-table-header__product">Sản phẩm</span>
            <span className="cart-table-header__price">Đơn giá</span>
            <span className="cart-table-header__quantity">Số lượng</span>
            <span className="cart-table-header__total">Thành tiền</span>
          </div>
          {cart.warnings.map((warning) => <p className="cart-message cart-message--warning" key={warning.productId}>
            Một sản phẩm không còn được mở bán. Bạn có thể xóa sản phẩm khỏi giỏ.
          </p>)}
          {items.map((item) => <article className="cart-item" key={item.productId}>
            <div className="cart-item__product">
              {item.product?.imageUrl
                ? <img className="cart-item__image" src={item.product.imageUrl} alt={item.product.name} loading="lazy" />
                : <div className="cart-item__image cart-item__image--empty" aria-hidden="true">TRO &amp; LAM</div>}
              <div className="cart-item__details">
                <p className="cart-item__line">{item.product?.line === 'lifestyle' ? 'Lifestyle Line' : item.product ? 'Diplomacy Line' : 'Sản phẩm không còn mở bán'}</p>
                <h2>{item.product?.slug
                  ? <Link to={`/san-pham/${encodeURIComponent(item.product.slug)}`}>{item.product.name}</Link>
                  : item.product?.name || 'Sản phẩm không còn mở bán'}</h2>
                {item.product && <p className="cart-item__sku">Mã sản phẩm: {item.product.sku}</p>}
                <button className="cart-remove" type="button" onClick={() => removeItem(item)} disabled={pendingId === item.productId}>
                  <span aria-hidden="true">×</span>{pendingId === item.productId ? 'Đang cập nhật…' : 'Xóa sản phẩm'}
                </button>
              </div>
            </div>
            <div className="cart-item__unit-price">
              <span className="cart-mobile-label">Đơn giá</span>
              <span>{item.product ? money(item.product.priceVnd) : 'Cần kiểm tra lại'}</span>
            </div>
            <div className="cart-item__quantity-column">
              <span className="cart-mobile-label">Số lượng</span>
              {item.checkoutEligible ? <div className="cart-quantity" aria-label={`Số lượng ${item.product.name}`}>
                <button type="button" aria-label={`Giảm số lượng ${item.product.name}`} onClick={() => setQuantity(item, item.quantity - 1)} disabled={pendingId === item.productId || item.quantity <= 1}>−</button>
                <span aria-live="polite">{item.quantity}</span>
                <button type="button" aria-label={`Tăng số lượng ${item.product.name}`} onClick={() => setQuantity(item, item.quantity + 1)} disabled={pendingId === item.productId || item.quantity >= 99}>+</button>
              </div> : <span>{item.quantity}</span>}
            </div>
            <strong className="cart-item__total">
              <span className="cart-mobile-label">Thành tiền</span>
              {item.lineTotalVnd === null ? 'Cần kiểm tra lại' : money(item.lineTotalVnd)}
            </strong>
          </article>)}
        </section>

        <aside className="cart-summary" aria-labelledby="cart-summary-title">
          <p className="cart-page__eyebrow">TÓM TẮT</p>
          <h2 id="cart-summary-title">Đơn hàng</h2>
          <div className="cart-summary__row"><span>{itemCount} sản phẩm</span><strong>{money(cart.subtotalVnd)}</strong></div>
          <p className="cart-summary__note">Phí giao hàng và khả năng cung ứng sẽ được xác nhận ở bước tiếp theo.</p>
          {checkoutAllowed
            ? <Link className="cart-button" to="/thanh-toan">Tiến hành đặt hàng</Link>
            : <button className="cart-button" type="button" disabled>Chưa thể tiến hành đặt hàng</button>}
          {!user && <p className="cart-summary__note">Bạn có thể tiếp tục với tư cách khách hoặc <Link to="/dang-nhap">đăng nhập</Link> để đồng bộ giỏ hàng.</p>}
          {user && <p className="cart-summary__note">Giỏ hàng khách đã được gộp vào giỏ tài khoản.</p>}
          <Link className="cart-continue" to="/san-pham"><span aria-hidden="true">←</span> Tiếp tục khám phá sản phẩm</Link>
        </aside>
      </div>}

      {recommendations.length > 0 && <section className="cart-recommendations" aria-labelledby="cart-recommendations-title">
        <div className="cart-recommendations__heading">
          <div><p className="cart-page__eyebrow">TUYỂN CHỌN ĐỒNG ĐIỆU</p><h2 id="cart-recommendations-title">Có thể bạn cũng yêu thích</h2></div>
          <Link to="/san-pham">Xem toàn bộ sản phẩm <span aria-hidden="true">→</span></Link>
        </div>
        <div className="product-grid">{recommendations.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      </section>}
    </div>
  </section>;
}
