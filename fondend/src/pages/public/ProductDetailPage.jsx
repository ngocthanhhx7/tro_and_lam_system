import { lazy, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CatalogError, CatalogLoading } from '../../components/catalog/CatalogStates.jsx';
import Icon from '../../components/catalog/Icon.jsx';
import ProductEditorialStory from '../../components/catalog/ProductEditorialStory.jsx';
import ProductCard from '../../components/catalog/ProductCard.jsx';
import { getListingProductBySlug, getRelatedListingProducts } from '../catalog/productListingData.js';
import { addCartQuantity, formatVnd, getPublishedProduct, submitQuoteRequest } from '../../services/catalog/catalogApi.js';
import { getProductImageSource } from '../../utils/productMedia.js';
import { setPageIndexability, setPageMetadata } from '../../utils/pageMetadata.js';
import './product-detail.css';

const PublicProductReviews = lazy(() => import('../support/CustomerReviewsPage.jsx')
  .then((module) => ({ default: module.PublicProductReviews })));
const curatedPriceFormatter = new Intl.NumberFormat('vi-VN');

function curatedImage(image, product, index) {
  return {
    url: image,
    alt: `${product.name}${index ? ` – ảnh ${index + 1}` : ''}`,
    sortOrder: index,
  };
}

function curatedSummary(product) {
  return {
    ...product,
    images: product.images.map((image, index) => curatedImage(image, product, index)),
    saleMode: 'buy',
    availableForPurchase: false,
    stockLabel: 'Tạm thời chưa có hàng',
    priceLabel: `${curatedPriceFormatter.format(product.priceVnd)} đ`,
  };
}

function mergeCuratedProduct(curated, apiProduct) {
  return {
    ...apiProduct,
    ...curated,
    curated: true,
    backendProductId: apiProduct?.id || '',
    sku: apiProduct?.sku || '',
    images: curated.images.map((image, index) => curatedImage(image, curated, index)),
    saleMode: apiProduct?.saleMode || 'buy',
    availableForPurchase: apiProduct?.availableForPurchase === true,
    stockLabel: apiProduct?.stockLabel || 'Tạm thời chưa có hàng',
    priceLabel: `${curatedPriceFormatter.format(curated.priceVnd)} đ`,
    relatedProducts: getRelatedListingProducts(curated).map(curatedSummary),
  };
}

function QuoteForm({ product }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    const input = {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      company: String(formData.get('company') || '').trim(),
      kind: 'quote',
      productId: product.id,
      quantity: Number(formData.get('quantity')),
      message: String(formData.get('message') || '').trim(),
      consent: formData.get('consent') === 'on',
    };
    for (const key of Object.keys(input)) if (input[key] === '') delete input[key];
    setSending(true);
    try {
      const result = await submitQuoteRequest(input);
      setMessage(result.data?.deliveryStatus === 'queued'
        ? 'Yêu cầu đã được tiếp nhận; việc chuyển thông tin cho nhân viên đang chờ xử lý.'
        : 'Yêu cầu đã được tiếp nhận.');
      form.reset();
    } catch (submitError) {
      setError(submitError.message || 'Chưa gửi được yêu cầu. Thông tin vẫn còn trên biểu mẫu để bạn thử lại.');
    } finally { setSending(false); }
  }

  return <section className="quote-panel" aria-labelledby="quote-title">
    <p className="eyebrow">TƯ VẤN RIÊNG</p><h2 id="quote-title">Gửi yêu cầu tư vấn</h2>
    <p>Nhân viên tiếp nhận yêu cầu để trao đổi thêm. Gửi yêu cầu chưa tạo đơn hàng hoặc giữ tồn.</p>
    <form className="catalog-form" onSubmit={submit}>
      <div className="catalog-form__grid">
        <label>Họ tên<input name="name" autoComplete="name" required maxLength="120" /></label>
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength="254" /></label>
        <label>Điện thoại<input name="phone" type="tel" autoComplete="tel" maxLength="30" /></label>
        <label>Tổ chức (không bắt buộc)<input name="company" autoComplete="organization" maxLength="160" /></label>
        <label>Số lượng dự kiến<input name="quantity" type="number" min="1" max="99" defaultValue="1" required /></label>
      </div>
      <label>Nội dung cần trao đổi<textarea name="message" required minLength="1" maxLength="5000" rows="4" placeholder="Viết thông tin cần tư vấn" /></label>
      <label className="check-label"><input name="consent" type="checkbox" required /><span>Cho phép liên hệ để trao đổi về yêu cầu này.</span></label>
      <button className="button button--primary" type="submit" disabled={sending}>{sending ? 'Đang gửi…' : 'Gửi yêu cầu tư vấn'}</button>
      {error && <p className="form-feedback form-feedback--error" role="alert">{error}</p>}
      {message && <p className="form-feedback form-feedback--success" role="status">{message}</p>}
    </form>
  </section>;
}

export default function ProductDetailPage() {
  const { slug } = useParams();
  const curatedProduct = getListingProductBySlug(slug);
  const [state, setState] = useState({ status: 'loading', product: null, error: '' });
  const [retry, setRetry] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageState, setSelectedImageState] = useState({ slug: '', index: 0 });
  const [cartStatus, setCartStatus] = useState({ busy: false, message: '', error: '' });

  useEffect(() => {
    const controller = new AbortController();
    if (curatedProduct) {
      if (curatedProduct.apiSlug) {
        getPublishedProduct(curatedProduct.apiSlug, { signal: controller.signal })
          .then((response) => setState({ slug, status: 'ready', product: response.data, error: '' }))
          .catch((error) => { if (error.name !== 'AbortError') setState({ slug, status: 'ready', product: null, error: '' }); });
      }
    } else {
      getPublishedProduct(slug, { signal: controller.signal })
        .then((response) => setState({ slug, status: 'ready', product: response.data, error: '' }))
        .catch((error) => { if (error.name !== 'AbortError') setState({ slug, status: 'error', product: null, error: error.message }); });
    }
    return () => controller.abort();
  }, [curatedProduct, slug, retry]);

  useEffect(() => {
    if (state.slug !== slug) return;
    if (!curatedProduct && state.status === 'error') {
      setPageIndexability(false);
      return;
    }
    const metadataProduct = curatedProduct
      ? mergeCuratedProduct(curatedProduct, state.slug === slug ? state.product : null)
      : state.slug === slug ? state.product : null;
    if (!metadataProduct) return;
    setPageIndexability(true);
    const title = `${metadataProduct.name} | TRO & LAM`;
    const description = String(metadataProduct.description || 'Thông tin sản phẩm gốm Chu Đậu do TRO & LAM công bố.')
      .replace(/\s+/gu, ' ')
      .trim()
      .slice(0, 160);
    setPageMetadata({ title, description });
  }, [curatedProduct, slug, state]);

  if (!curatedProduct && (state.slug !== slug || state.status === 'loading')) return <div className="section-wrap"><CatalogLoading count={1} /></div>;
  if (!curatedProduct && state.status === 'error') return <div className="section-wrap"><CatalogError message={state.error} onRetry={() => setRetry((value) => value + 1)} /></div>;
  const product = curatedProduct
    ? mergeCuratedProduct(curatedProduct, state.slug === slug ? state.product : null)
    : state.product;
  const cartProductId = product.backendProductId || (product.curated ? '' : product.id);
  const canBuy = Boolean(cartProductId) && ['buy', 'both'].includes(product.saleMode) && product.availableForPurchase === true && Number.isSafeInteger(product.priceVnd) && product.priceVnd > 0;
  const images = [...(product.images || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const selectedImage = selectedImageState.slug === slug && selectedImageState.index < images.length ? selectedImageState.index : 0;
  const selectedImageSource = getProductImageSource(images[selectedImage]);

  function selectAdjacentImage(direction) {
    setSelectedImageState({ slug, index: (selectedImage + direction + images.length) % images.length });
  }

  function updateQuantity(value) {
    setQuantity(Math.max(1, Math.min(99, Number(value) || 1)));
  }

  async function addToCart() {
    setCartStatus({ busy: true, message: '', error: '' });
    try {
      await addCartQuantity(cartProductId, quantity);
      setCartStatus({ busy: false, message: 'Đã cập nhật giỏ hàng từ danh mục hiện tại.', error: '' });
    } catch (error) {
      setCartStatus({ busy: false, message: '', error: error.message || 'Chưa cập nhật được giỏ hàng. Thử lại khi kết nối sẵn sàng.' });
    }
  }

  return <div className="product-detail section-wrap">
    <nav className="breadcrumbs" aria-label="Vị trí hiện tại"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><Link to="/san-pham">Sản phẩm</Link><span aria-hidden="true">/</span><span aria-current="page">{product.name}</span></nav>
    <div className="product-detail__grid">
      <div className="product-gallery">
        <div className="product-gallery__main">
          {images.length ? <img src={images[selectedImage]?.url} alt={images[selectedImage]?.alt || product.name} width="900" height="760" fetchPriority="high" /> : <div className="product-gallery__empty"><span aria-hidden="true">◌</span><p>Ảnh sản phẩm đang chờ cập nhật</p></div>}
        </div>
        {images.length > 1 && <div className="product-gallery__controls" aria-label="Thư viện ảnh sản phẩm">
          <button className="product-gallery__arrow" type="button" onClick={() => selectAdjacentImage(-1)} aria-label="Ảnh trước"><span aria-hidden="true">←</span></button>
          <div className="product-gallery__thumbs" aria-label="Chọn ảnh sản phẩm">{images.map((image, index) => <button key={`${image.url}-${index}`} type="button" className={selectedImage === index ? 'is-selected' : ''} onClick={() => setSelectedImageState({ slug, index })} aria-label={`Xem ảnh ${index + 1}: ${image.alt || product.name}`} aria-pressed={selectedImage === index}><img src={image.url} alt="" width="112" height="96" loading="lazy" /></button>)}</div>
          <button className="product-gallery__arrow" type="button" onClick={() => selectAdjacentImage(1)} aria-label="Ảnh tiếp theo"><span aria-hidden="true">→</span></button>
        </div>}
        {selectedImageSource && <div className="product-gallery__media-note" aria-live="polite"><img src="/assets/editorial/lotus-line-ornament.svg" alt="" width="48" height="32" /><p>{selectedImageSource.disclosure}</p></div>}
      </div>
      <section className="product-detail__info" aria-labelledby="product-title">
        <p className="eyebrow">{product.line === 'lifestyle' ? 'LIFESTYLE LINE' : 'DIPLOMACY LINE'}</p>
        <h1 id="product-title">{product.name}</h1>
        {product.sku && <p className="product-detail__sku">Mã sản phẩm: {product.sku}</p>}
        <p className="product-detail__description">{product.description || 'Thông tin mô tả đang được cập nhật.'}</p>
        {product.saleMode !== 'quote' && product.priceVnd > 0 && <p className="product-detail__price">{product.priceLabel || formatVnd(product.priceVnd)}</p>}
        <p className={`product-detail__availability${product.availableForPurchase ? ' is-available' : ''}`}><span aria-hidden="true">●</span> {product.stockLabel}</p>
        {['buy', 'both'].includes(product.saleMode) && <div className="buy-panel">
          <div className="buy-panel__quantity"><label htmlFor="product-quantity">Số lượng</label><div className="buy-panel__quantity-control"><input id="product-quantity" type="number" min="1" max="99" value={quantity} onChange={(event) => updateQuantity(event.target.value)} aria-label="Số lượng sản phẩm" /><div><button type="button" onClick={() => updateQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="Giảm số lượng">−</button><button type="button" onClick={() => updateQuantity(quantity + 1)} disabled={quantity >= 99} aria-label="Tăng số lượng">+</button></div></div></div>
          <button className="button button--primary" type="button" onClick={addToCart} disabled={!canBuy || cartStatus.busy}><Icon name="bag" size={18} />{cartStatus.busy ? 'Đang cập nhật…' : 'Thêm vào giỏ'}</button>
          {!canBuy && <p className="buy-panel__note">{product.availableForPurchase === false ? 'Sản phẩm hiện chưa thể đặt mua trực tiếp.' : 'Khả năng đặt mua sẽ được xác minh trước khi thêm vào giỏ.'}</p>}
          {cartStatus.error && <p className="form-feedback form-feedback--error" role="alert">{cartStatus.error}</p>}
          {cartStatus.message && <p className="form-feedback form-feedback--success" role="status">{cartStatus.message} <Link to="/gio-hang">Xem giỏ hàng</Link></p>}
        </div>}
        {['quote', 'both'].includes(product.saleMode) && <a className="button button--outline product-detail__quote-link" href="#quote-form">Yêu cầu tư vấn <span aria-hidden="true">↓</span></a>}
        <dl className="product-facts">
          {product.material && <div><dt>Chất liệu</dt><dd>{product.material}</dd></div>}
          {product.dimensions && <div><dt>Kích thước</dt><dd>{product.dimensions}</dd></div>}
          {product.careInstructions && <div><dt>Hướng dẫn chăm sóc</dt><dd>{product.careInstructions}</dd></div>}
          <div><dt>Hình thức</dt><dd>{product.saleMode === 'quote' ? 'Yêu cầu tư vấn' : product.saleMode === 'both' ? 'Mua trực tiếp hoặc yêu cầu tư vấn' : 'Mua trực tiếp khi còn hàng'}</dd></div>
        </dl>
        <section className="product-story" aria-labelledby="product-story-title">
          <p className="eyebrow">GÓC CÂU CHUYỆN</p>
          {product.storyText ? <>
            <h2 id="product-story-title">Câu chuyện phía sau {product.name}</h2>
            <p>{product.description}</p>
            <a className="text-link" href="#product-story">Đọc câu chuyện sản phẩm <span aria-hidden="true">→</span></a>
          </> : product.story ? <>
            <h2 id="product-story-title">{product.story.title}</h2>
            <p>{product.story.summary || product.story.origin}</p>
            {product.story.slug && <Link className="text-link" to={`/cau-chuyen/${encodeURIComponent(product.story.slug)}`}>Đọc câu chuyện <span aria-hidden="true">→</span></Link>}
          </> : <>
            <h2 id="product-story-title">Khám phá câu chuyện gốm Việt</h2>
            <p>Tìm hiểu thêm về hành trình của đất, men và kỹ nghệ thủ công trong gốm Chu Đậu.</p>
            <Link className="text-link" to="/cau-chuyen">Khám phá góc câu chuyện <span aria-hidden="true">→</span></Link>
          </>}
        </section>
      </section>
    </div>
    {['quote', 'both'].includes(product.saleMode) && <div id="quote-form" className="product-detail__quote"><QuoteForm product={product} /></div>}
    {product.storyText && <ProductEditorialStory product={product} />}
    <PublicProductReviews productId={cartProductId} />
    {product.relatedProducts?.length > 0 && <section className="related-products"><div className="section-heading section-heading--split"><div><p className="eyebrow">KHÁM PHÁ THÊM</p><h2>Cùng dòng sản phẩm</h2></div><Link className="text-link" to="/san-pham">Xem tất cả <span aria-hidden="true">→</span></Link></div><div className="product-grid">{product.relatedProducts.map((item) => <ProductCard key={item.id} product={item} headingLevel="h3" />)}</div></section>}
  </div>;
}
