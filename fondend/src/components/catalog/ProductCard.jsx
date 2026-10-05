import { Link } from 'react-router-dom';
import { formatVnd } from '../../services/catalog/catalogApi.js';

export default function ProductCard({ product }) {
  const image = product.images?.[0];
  const quoteOnly = product.saleMode === 'quote';
  return <article className="product-card">
    <Link className="product-card__image" to={`/san-pham/${encodeURIComponent(product.slug)}`} aria-label={`Xem ${product.name}`}>
      {image
        ? <img src={image.url} alt={image.alt} width="640" height="520" loading="lazy" />
        : <span className="product-card__image-empty">Ảnh sản phẩm đang chờ cập nhật</span>}
      {quoteOnly && <span className="product-card__tag">Tư vấn theo yêu cầu</span>}
    </Link>
    <div className="product-card__body">
      <p className="eyebrow">{product.line === 'lifestyle' ? 'Lifestyle Line' : 'Diplomacy Line'}</p>
      <h2><Link to={`/san-pham/${encodeURIComponent(product.slug)}`}>{product.name}</Link></h2>
      <p className="product-card__availability" aria-live="polite">
        {quoteOnly ? 'Yêu cầu báo giá' : product.stockLabel}
      </p>
      <div className="product-card__bottom">
        {product.priceVnd ? <span className="product-card__price">{formatVnd(product.priceVnd)}</span> : <span className="product-card__price">&nbsp;</span>}
        <Link className="text-link" to={`/san-pham/${encodeURIComponent(product.slug)}`}>
          {quoteOnly ? 'Tìm hiểu và hỏi giá' : 'Xem chi tiết'} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  </article>;
}
