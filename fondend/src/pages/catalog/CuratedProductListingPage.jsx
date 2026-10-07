import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listingGroups, listingProducts } from './productListingData.js';
import './curated-product-listing.css';

const emptyFilters = { q: '', line: '', category: '', priceMin: '', priceMax: '', sort: 'newest' };
const priceFormatter = new Intl.NumberFormat('vi-VN');

function normalize(value) {
  return value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/gu, '').replace(/đ/gu, 'd');
}

function ProductLink({ product }) {
  return product.detailSlug
    ? <Link className="curated-product__link" to={`/san-pham/${product.detailSlug}`} aria-label={`Xem chi tiết ${product.name}`}>Xem chi tiết <span aria-hidden="true">→</span></Link>
    : <Link className="curated-product__link" to="/lien-he" aria-label={`Hỏi thêm về ${product.name}`}>Hỏi thêm <span aria-hidden="true">→</span></Link>;
}

function ProductItem({ product, wide = false }) {
  const group = listingGroups.find((item) => item.id === product.category);
  return <article className={`curated-product${wide ? ' curated-product--wide' : ''}${product.image ? '' : ' curated-product--unverified'}`}>
    {product.image
      ? <div className="curated-product__image"><img src={product.image} alt={product.name} loading="lazy" width={wide ? 900 : 640} height={wide ? 600 : 720} /></div>
      : <p className="curated-product__image-note">Ảnh đúng phiên bản đang được xác nhận</p>}
    <div className="curated-product__copy">
      <p className="curated-product__category">{group.label}</p>
      <h3>{product.name}</h3>
      <p className="curated-product__description">{product.description}</p>
      <div className="curated-product__bottom">
        <span className="curated-product__price">{priceFormatter.format(product.priceVnd)} đ</span>
        <ProductLink product={product} />
      </div>
    </div>
  </article>;
}

function ListingFilters({ filters, onApply, onReset }) {
  const [draft, setDraft] = useState(filters);
  const [mobileOpen, setMobileOpen] = useState(false);

  function update(key, value) { setDraft((current) => ({ ...current, [key]: value })); }

  return <aside className="curated-filters" aria-label="Lọc sản phẩm">
    <div className="curated-filters__heading">
      <h2>Lọc danh mục</h2>
      <button className="text-link" type="button" onClick={() => { onReset(); setMobileOpen(false); }}>Xóa lọc</button>
    </div>
    <button className="curated-filters__toggle" type="button" aria-expanded={mobileOpen} aria-controls="curated-filter-fields" onClick={() => setMobileOpen((open) => !open)}>
      Bộ lọc <span aria-hidden="true">{mobileOpen ? '−' : '+'}</span>
    </button>
    <div id="curated-filter-fields" className={`curated-filters__body${mobileOpen ? ' is-open' : ''}`}>
      <form onSubmit={(event) => { event.preventDefault(); onApply(draft); setMobileOpen(false); }}>
        <label>Tìm theo tên hoặc nội dung<input type="search" value={draft.q} onChange={(event) => update('q', event.target.value)} placeholder="Nhập từ khóa" maxLength="120" /></label>
        <label>Dòng sản phẩm<select value={draft.line} onChange={(event) => update('line', event.target.value)}><option value="">Tất cả dòng</option><option value="diplomacy">Diplomacy Line</option><option value="lifestyle">Lifestyle Line</option></select></label>
        <label>Danh mục<select value={draft.category} onChange={(event) => update('category', event.target.value)}><option value="">Tất cả danh mục</option>{listingGroups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
        <fieldset><legend>Giá công bố (VND)</legend><div className="curated-filters__range"><input aria-label="Từ giá" type="number" min="0" step="1" value={draft.priceMin} onChange={(event) => update('priceMin', event.target.value)} placeholder="Từ" /><span aria-hidden="true">—</span><input aria-label="Đến giá" type="number" min="0" step="1" value={draft.priceMax} onChange={(event) => update('priceMax', event.target.value)} placeholder="Đến" /></div></fieldset>
        <label>Hình thức bán<select disabled><option>Chưa có dữ liệu công bố</option></select></label>
        <label>Tình trạng đặt mua<select disabled><option>Chưa có dữ liệu công bố</option></select></label>
        <label>Sắp xếp<select value={draft.sort} onChange={(event) => update('sort', event.target.value)}><option value="newest">Theo danh mục</option><option value="name">Tên A–Z</option><option value="price_asc">Giá thấp đến cao</option><option value="price_desc">Giá cao đến thấp</option></select></label>
        <p className="curated-filters__notice">Tình trạng đặt mua sẽ được bổ sung khi có dữ liệu chính thức.</p>
        <button className="button button--primary curated-filters__submit" type="submit">Áp dụng bộ lọc <span aria-hidden="true">→</span></button>
      </form>
    </div>
  </aside>;
}

export default function CuratedProductListingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => ({
    q: searchParams.get('q') || '',
    line: searchParams.get('line') || '',
    category: searchParams.get('category') || '',
    priceMin: searchParams.get('priceMin') || '',
    priceMax: searchParams.get('priceMax') || '',
    sort: ['name', 'price_asc', 'price_desc'].includes(searchParams.get('sort')) ? searchParams.get('sort') : 'newest',
  }), [searchParams]);

  const products = useMemo(() => {
    const q = normalize(filters.q.trim());
    const minPrice = /^\d+$/u.test(filters.priceMin) ? Number(filters.priceMin) : null;
    const maxPrice = /^\d+$/u.test(filters.priceMax) ? Number(filters.priceMax) : null;
    const filtered = listingProducts.filter((product) => (
      (!filters.category || product.category === filters.category)
      && (!filters.line || product.line === filters.line)
      && (!q || normalize(`${product.name} ${product.description}`).includes(q))
      && (minPrice === null || product.priceVnd >= minPrice)
      && (maxPrice === null || product.priceVnd <= maxPrice)
    ));
    if (filters.sort === 'name') return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    if (filters.sort === 'price_asc') return [...filtered].sort((a, b) => a.priceVnd - b.priceVnd);
    if (filters.sort === 'price_desc') return [...filtered].sort((a, b) => b.priceVnd - a.priceVnd);
    return filtered;
  }, [filters]);

  function applyFilters(next) {
    const params = new URLSearchParams();
    for (const key of ['q', 'line', 'category', 'priceMin', 'priceMax', 'sort']) {
      if (next[key] && next[key] !== emptyFilters[key]) params.set(key, next[key]);
    }
    setSearchParams(params);
  }

  return <div className="curated-listing">
    <header className="curated-listing__hero">
      <div className="curated-listing__hero-art" aria-hidden="true"><img src="/assets/editorial/product-listing-hero.png" alt="" width="1586" height="1024" loading="eager" fetchPriority="high" /></div>
      <div className="curated-listing__hero-inner section-wrap">
        <div className="curated-listing__hero-copy">
          <p className="eyebrow">GỐM CHU ĐẬU · TRO & LAM</p>
          <h1>Sản phẩm</h1>
          <p>Khám phá những sản phẩm Gốm Chu Đậu được tuyển chọn bởi Tro & Lam – nơi kỹ nghệ thủ công, hoa văn truyền thống và câu chuyện văn hóa Việt cùng hiện diện trong từng sản phẩm.</p>
          <nav className="curated-listing__tabs" aria-label="Nhóm sản phẩm">
            <button type="button" aria-current={!filters.category ? 'page' : undefined} onClick={() => applyFilters({ ...filters, category: '' })}>Tất cả sản phẩm</button>
            {listingGroups.map((group) => <button key={group.id} type="button" aria-current={filters.category === group.id ? 'page' : undefined} onClick={() => applyFilters({ ...filters, category: group.id })}>{group.label.toLocaleLowerCase('vi').replace(/^./u, (letter) => letter.toLocaleUpperCase('vi'))}</button>)}
          </nav>
        </div>
      </div>
    </header>
    <div className="curated-listing__main section-wrap">
      <ListingFilters key={searchParams.toString()} filters={filters} onApply={applyFilters} onReset={() => setSearchParams(new URLSearchParams())} />
      <div className="curated-listing__results" aria-live="polite">
        <p className="curated-listing__count">{products.length} sản phẩm</p>
        {products.length ? listingGroups.map((group) => {
          const items = products.filter((product) => product.category === group.id);
          if (!items.length) return null;
          return <section className={`curated-section curated-section--${group.id}`} key={group.id} aria-labelledby={`group-${group.id}`}>
            <div className="curated-section__head"><div><p className="curated-section__eyebrow"><span>{group.number}</span> — {group.label}</p><h2 id={`group-${group.id}`}>{group.title}</h2></div><button className="curated-section__all" type="button" onClick={() => applyFilters({ ...emptyFilters, category: group.id })}>Xem tất cả <span aria-hidden="true">→</span></button></div>
            <div className="curated-section__grid">{items.map((product) => <ProductItem key={product.id} product={product} wide={group.id === 'tableware'} />)}</div>
          </section>;
        }) : <div className="curated-listing__empty"><h2>Chưa tìm thấy sản phẩm phù hợp</h2><p>Thử tên sản phẩm khác hoặc xóa bộ lọc để xem toàn bộ danh mục.</p><button className="text-link" type="button" onClick={() => setSearchParams(new URLSearchParams())}>Xem tất cả sản phẩm →</button></div>}
      </div>
    </div>
  </div>;
}
