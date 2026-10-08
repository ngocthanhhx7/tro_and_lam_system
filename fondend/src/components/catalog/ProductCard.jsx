import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { addCartQuantity, formatVnd } from '../../services/catalog/catalogApi.js';
import { getProductImageSource } from '../../utils/productMedia.js';

export default function ProductCard({ product, headingLevel = 'h2' }) {
  const [cartStatus, setCartStatus] = useState({ state: 'idle', message: '' });
  const image = product.images?.[0];
  const quoteOnly = product.saleMode === 'quote';
  const canAddToCart = ['buy', 'both'].includes(product.saleMode)
    && product.availableForPurchase === true
    && Number.isSafeInteger(product.priceVnd)
    && product.priceVnd > 0;
  const imageSource = getProductImageSource(image);

  async function addToCart() {
    if (!canAddToCart || cartStatus.state === 'loading') return;
    setCartStatus({ state: 'loading', message: '' });
    try {
      await addCartQuantity(product.id, 1);
      setCartStatus({ state: 'success', message: 'Đã thêm vào giỏ hàng.' });
    } catch (error) {
      setCartStatus({ state: 'error', message: error.message || 'Chưa thêm được sản phẩm. Hãy thử lại.' });
    }
  }

  return <article className="product-card">
    <Link className="product-card__image" to={`/san-pham/${encodeURIComponent(product.slug)}`} aria-label={`Xem ${product.name}`}>
      {image
        ? <img src={image.url} alt={image.alt || product.name} width="640" height="520" loading="lazy" />
        : <span className="product-card__image-empty">Ảnh sản phẩm đang chờ cập nhật</span>}
      {quoteOnly && <span className="product-card__tag">Tư vấn theo yêu cầu</span>}
      {imageSource && <span className={`product-card__tag product-card__tag--${imageSource.kind}`}>{imageSource.badge}</span>}
    </Link>
    <div className="product-card__body">
      <p className="eyebrow">{product.line === 'lifestyle' ? 'Lifestyle Line' : 'Diplomacy Line'}</p>
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
        >
          <Icon name="bag" size={20} />
          <span className="product-card__cart-plus" aria-hidden="true">{cartStatus.state === 'success' ? '✓' : '+'}</span>
        </button>
      </div>
      {cartStatus.message && <p className={`product-card__cart-feedback is-${cartStatus.state}`} role={cartStatus.state === 'error' ? 'alert' : 'status'}>
        {cartStatus.message}{cartStatus.state === 'success' && <> <Link to="/gio-hang">Xem giỏ</Link></>}
      </p>}
    </div>
  </article>;
}
