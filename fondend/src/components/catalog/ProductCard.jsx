import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { addCartQuantity, formatVnd } from '../../services/catalog/catalogApi.js';
import { productImageProps } from '../../services/catalog/productImage.js';

export default function ProductCard({ product, headingLevel = 'h2', onCartUpdated }) {
  const [cartStatus, setCartStatus] = useState({ state: 'idle', message: '' });
  const cartPending = useRef(false);
  const image = product.images?.[0];
  const quoteOnly = product.saleMode === 'quote';
  const canAddToCart = ['buy', 'both'].includes(product.saleMode)
    && product.availableForPurchase === true
    && Number.isSafeInteger(product.priceVnd)
    && product.priceVnd > 0;

  async function addToCart() {
    if (!canAddToCart || cartPending.current) return;
    cartPending.current = true;
    setCartStatus({ state: 'loading', message: 'Đang thêm vào giỏ…' });
    try {
      const response = await addCartQuantity(product.id, 1);
      onCartUpdated?.(response.data);
      setCartStatus({ state: 'success', message: 'Đã thêm vào giỏ hàng.' });
    } catch (error) {
      setCartStatus({ state: 'error', message: error.message || 'Chưa thêm được sản phẩm. Hãy thử lại.' });
    } finally {
      cartPending.current = false;
    }
  }

  return <article className="product-card">
    <Link className="product-card__image" to={`/san-pham/${encodeURIComponent(product.slug)}`} aria-label={`Xem ${product.name}`}>
      {image
        ? <img {...productImageProps(image.url, { sizes: 'auto, (max-width: 359px) calc(100vw - 34px), (max-width: 639px) calc((100vw - 48px) / 2), (max-width: 1100px) 40vw, 440px' })} alt={image.alt || product.name} width="640" height="640" loading="lazy" />
        : <span className="product-card__image-empty">Ảnh sản phẩm đang chờ cập nhật</span>}
      {quoteOnly && <span className="product-card__tag">Tư vấn theo yêu cầu</span>}
    </Link>
    <div className="product-card__body">
      <p className="eyebrow">{product.line === 'lifestyle' ? 'Dòng gốm đời sống' : 'Dòng gốm quà tặng'}</p>
      {headingLevel === 'h3'
        ? <h3><Link to={`/san-pham/${encodeURIComponent(product.slug)}`}>{product.name}</Link></h3>
        : <h2><Link to={`/san-pham/${encodeURIComponent(product.slug)}`}>{product.name}</Link></h2>}
      <p className="product-card__availability" aria-live="polite">
        {quoteOnly ? 'Yêu cầu báo giá' : product.stockLabel}
      </p>
      <div className="product-card__bottom">
        {product.priceVnd ? <span className="product-card__price">{product.priceLabel || formatVnd(product.priceVnd)}</span> : <span className="product-card__price">&nbsp;</span>}
        <button
          className={`product-card__cart-action${cartStatus.state === 'success' ? ' is-added' : ''}`}
          type="button"
          aria-label={canAddToCart ? `Thêm ${product.name} vào giỏ hàng` : `${product.name}: hiện chưa thể thêm vào giỏ hàng`}
          title={canAddToCart ? 'Thêm vào giỏ hàng' : 'Sản phẩm hiện chưa thể đặt mua trực tiếp'}
          onClick={addToCart}
          disabled={!canAddToCart || cartStatus.state === 'loading'}
          aria-busy={cartStatus.state === 'loading'}
        >
          <Icon name="bag" size={20} />
          <span className="product-card__cart-plus" aria-hidden="true">{cartStatus.state === 'loading' ? '…' : cartStatus.state === 'success' ? '✓' : '+'}</span>
        </button>
      </div>
      {cartStatus.message && <p className={`product-card__cart-feedback is-${cartStatus.state}`} role={cartStatus.state === 'error' ? 'alert' : 'status'}>
        {cartStatus.message}{cartStatus.state === 'success' && <> <Link to="/gio-hang">Xem giỏ</Link></>}
      </p>}
    </div>
  </article>;
}
