import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ProductCard from '../../components/catalog/ProductCard.jsx';
import { CatalogEmpty, CatalogError, CatalogLoading, Pagination } from '../../components/catalog/CatalogStates.jsx';
import { getPublishedCategories, searchPublishedProducts } from '../../services/catalog/catalogApi.js';
import { lineImagery } from '../../constants/editorialMedia.js';

const lineLabels = { lifestyle: 'Lifestyle Line', diplomacy: 'Diplomacy Line' };
const lineIntroductions = {
  lifestyle: {
    eyebrow: 'GỐM TRONG ĐỜI SỐNG',
    heading: 'Một chút gốm. Một khoảng bình yên.',
    summary: 'Lifestyle Line gợi mở những món gốm cho góc trà, không gian sống và những món quà gần gũi.',
    image: lineImagery.lifestyle.landing,
    alt: lineImagery.lifestyle.alt,
    caption: 'Hũ trà họa tiết chim Lạc · Ảnh do chủ dự án cung cấp',
    disclosure: lineImagery.lifestyle.disclosure,
    items: ['Gợi ý cho góc hương', 'Gợi ý lưu trữ trà', 'Gợi ý thưởng trà'],
  },
  diplomacy: {
    eyebrow: 'GỐM CHO NHỮNG DỊP TRAO TẶNG',
    heading: 'Gửi một món quà. Gói một tấm lòng.',
    summary: 'Diplomacy Line dành cho những lựa chọn quà tặng văn hóa, doanh nghiệp và các dịp trang trọng.',
    image: lineImagery.diplomacy.landing,
    alt: lineImagery.diplomacy.alt,
    caption: 'Bình Thiên Nga · Ảnh do chủ dự án cung cấp',
    disclosure: lineImagery.diplomacy.disclosure,
    items: ['Bình Thiên Nga', 'Bình Phú Quý', 'Bình Giọt Ngọc', 'Bình Hoa Lam', 'Bình Tỳ Bà'],
  },
};

function readFilters(params, forcedLine) {
  return {
    q: params.get('q') || '',
    line: forcedLine || params.get('line') || '',
    category: params.get('category') || '',
    priceMin: params.get('priceMin') || '',
    priceMax: params.get('priceMax') || '',
    saleMode: params.get('saleMode') || '',
    available: params.get('available') || '',
    sort: params.get('sort') || 'newest',
    page: params.get('page') || '1',
  };
}

function CatalogFilterForm({ filters, categories, forcedLine, onApply, onReset }) {
  const [draft, setDraft] = useState(filters);

  function submitFilters(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(['q', 'line', 'category', 'priceMin', 'priceMax', 'saleMode', 'available', 'sort'].map((key) => [key, String(data.get(key) || '')]));
    if (forcedLine) values.line = undefined;
    values.page = '1';
    onApply(values);
  }

  return <aside className="filter-panel" aria-label="Lọc sản phẩm">
    <div className="filter-panel__heading"><h2>Lọc danh mục</h2><button className="text-link" type="button" onClick={onReset}>Xóa lọc</button></div>
    <form className="catalog-filters" onSubmit={submitFilters}>
      <label>Tìm theo tên hoặc nội dung<input type="search" name="q" maxLength="120" value={draft.q} onChange={(event) => setDraft({ ...draft, q: event.target.value })} placeholder="Nhập từ khóa" /></label>
      <label>Dòng sản phẩm<select name="line" value={forcedLine || draft.line} disabled={Boolean(forcedLine)} onChange={(event) => setDraft({ ...draft, line: event.target.value })}><option value="">Tất cả dòng</option><option value="lifestyle">Lifestyle Line</option><option value="diplomacy">Diplomacy Line</option></select></label>
      <label>Danh mục<select name="category" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="">Tất cả danh mục</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <fieldset><legend>Giá công bố (VND)</legend><div className="filter-panel__range"><label><span className="visually-hidden">Từ giá</span><input name="priceMin" type="number" min="0" step="1" value={draft.priceMin} onChange={(event) => setDraft({ ...draft, priceMin: event.target.value })} placeholder="Từ" /></label><span aria-hidden="true">—</span><label><span className="visually-hidden">Đến giá</span><input name="priceMax" type="number" min="0" step="1" value={draft.priceMax} onChange={(event) => setDraft({ ...draft, priceMax: event.target.value })} placeholder="Đến" /></label></div></fieldset>
      <label>Hình thức bán<select name="saleMode" value={draft.saleMode} onChange={(event) => setDraft({ ...draft, saleMode: event.target.value })}><option value="">Tất cả hình thức</option><option value="buy">Mua trực tiếp</option><option value="quote">Yêu cầu báo giá</option><option value="both">Mua hoặc yêu cầu tư vấn</option></select></label>
      <label>Tình trạng đặt mua<select name="available" value={draft.available} onChange={(event) => setDraft({ ...draft, available: event.target.value })}><option value="">Tất cả</option><option value="true">Có thể đặt mua</option><option value="false">Tạm hết hàng</option></select></label>
      <label>Sắp xếp<select name="sort" value={draft.sort} onChange={(event) => setDraft({ ...draft, sort: event.target.value })}><option value="newest">Mới cập nhật</option><option value="name">Tên A–Z</option><option value="price_asc">Giá thấp đến cao</option><option value="price_desc">Giá cao đến thấp</option></select></label>
      <button className="button button--primary filter-panel__submit" type="submit">Áp dụng bộ lọc <span aria-hidden="true">→</span></button>
    </form>
  </aside>;
}

export default function ProductCatalogPage({ showIntro = true } = {}) {
  const [searchParams] = useSearchParams();
  const { line: routeLine } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const forcedLine = routeLine && Object.hasOwn(lineLabels, routeLine) ? routeLine : undefined;
  const filters = useMemo(() => readFilters(searchParams, forcedLine), [searchParams, forcedLine]);
  const [categories, setCategories] = useState([]);
  const [result, setResult] = useState({ requestKey: '', status: 'loading', items: [], pagination: null, error: '' });
  const [retry, setRetry] = useState(0);
  const routeKey = `${location.pathname}?${searchParams.toString()}`;
  const requestKey = JSON.stringify({ filters, forcedLine, retry });
  const state = result.requestKey === requestKey
    ? result
    : { status: 'loading', items: [], pagination: null, error: '' };

  useEffect(() => {
    const controller = new AbortController();
    getPublishedCategories({ signal: controller.signal }).then((response) => setCategories(response.data || []))
      .catch(() => { if (!controller.signal.aborted) setCategories([]); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const request = { ...filters, page: Number(filters.page), limit: 12 };
    if (request.available === '') delete request.available;
    if (forcedLine) request.line = forcedLine;
    searchPublishedProducts(request, { signal: controller.signal })
      .then((response) => setResult({ requestKey, status: 'ready', items: response.data || [], pagination: response.meta?.pagination || null, error: '' }))
      .catch((error) => { if (error.name !== 'AbortError') setResult({ requestKey, status: 'error', items: [], pagination: null, error: error.message }); });
    return () => controller.abort();
  }, [filters, forcedLine, requestKey]);

  if (routeLine && !Object.hasOwn(lineLabels, routeLine)) {
    return <div className="section-wrap catalog-state"><h1>Không tìm thấy bộ sưu tập</h1><p>Dòng sản phẩm này chưa được công bố.</p><Link className="button button--outline" to="/san-pham">Xem danh mục</Link></div>;
  }

  function setQuery(values) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined || value === null || value === '') params.delete(key);
      else params.set(key, String(value));
    }
    navigate(`${location.pathname}${params.size ? `?${params}` : ''}`);
  }

  function resetFilters() {
    navigate(location.pathname);
  }

  const pageTitle = forcedLine ? lineLabels[forcedLine] : 'Sản phẩm';
  return <div className={`catalog-page section-wrap${showIntro ? '' : ' catalog-page--embedded'}`}>
    {showIntro && <nav className="breadcrumbs" aria-label="Vị trí hiện tại"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">{pageTitle}</span></nav>}
    {showIntro && (forcedLine ? <section className="product-line-intro">
      <div className="product-line-intro__feature">
        <div className="product-line-intro__copy"><p className="eyebrow">{lineIntroductions[forcedLine].eyebrow}</p><h1>{lineIntroductions[forcedLine].heading}</h1><p>{lineIntroductions[forcedLine].summary}</p><div className="product-line-intro__actions"><a className="text-link" href="#san-pham-trong-dong">Xem sản phẩm <span aria-hidden="true">→</span></a>{forcedLine === 'diplomacy' && <Link className="text-link" to="/qua-tang-doanh-nghiep">Trao đổi về quà tặng <span aria-hidden="true">→</span></Link>}</div></div>
        <figure><img src={lineIntroductions[forcedLine].image} alt={lineIntroductions[forcedLine].alt} loading="eager" width="896" height="1152" /><small className="collection-story__disclosure">{lineIntroductions[forcedLine].disclosure}</small><figcaption>{lineIntroductions[forcedLine].caption}</figcaption><span aria-hidden="true">{forcedLine === 'lifestyle' ? '01 / LIFESTYLE' : '02 / DIPLOMACY'}</span></figure>
      </div>
      <div className="product-line-intro__guide"><div><p className="eyebrow">KHÁM PHÁ DÒNG SẢN PHẨM</p><h2>{forcedLine === 'lifestyle' ? 'Những món gốm cho từng góc nhỏ' : 'Những dáng bình dành cho dịp trao tặng'}</h2><p className="product-line-intro__note">Đây là gợi ý phong cách. Tên mẫu, SKU, nguồn cung và giá cần được xác nhận khi tư vấn.</p></div><ul>{lineIntroductions[forcedLine].items.map((item, index) => <li key={item}><span>0{index + 1}</span>{item}</li>)}</ul></div>
      <nav className="collection-tabs" aria-label="Dòng sản phẩm"><Link to="/san-pham">Tất cả sản phẩm</Link><Link to="/bo-suu-tap/lifestyle" aria-current={forcedLine === 'lifestyle' ? 'page' : undefined}>Lifestyle · Gốm trong đời sống</Link><Link to="/bo-suu-tap/diplomacy" aria-current={forcedLine === 'diplomacy' ? 'page' : undefined}>Diplomacy · Gốm trao tặng</Link></nav>
    </section> : <section className="catalog-page__intro">
      <p className="eyebrow">GỐM CHU ĐẬU · TRO & LAM</p>
      <h1>{pageTitle}</h1>
      <p>Tìm một món gốm cho không gian của bạn, hay một món quà cho người bạn trân quý.</p>
      <nav className="collection-tabs" aria-label="Dòng sản phẩm"><Link to="/san-pham" aria-current="page">Tất cả sản phẩm</Link><Link to="/bo-suu-tap/lifestyle">Lifestyle · Gốm trong đời sống</Link><Link to="/bo-suu-tap/diplomacy">Diplomacy · Gốm trao tặng</Link></nav>
    </section>)}
    <div className="catalog-layout">
      <CatalogFilterForm key={routeKey} filters={filters} categories={categories} forcedLine={forcedLine} onApply={setQuery} onReset={resetFilters} />
      <section className="catalog-results" id="san-pham-trong-dong" aria-label="Kết quả sản phẩm" aria-live="polite">
        <div className="catalog-results__top"><p>{state.pagination ? `${state.pagination.total} sản phẩm` : 'Danh mục sản phẩm'}</p>{state.pagination?.total > 0 && <span>Trang {state.pagination.page} / {state.pagination.totalPages}</span>}</div>
        {state.status === 'loading' && <CatalogLoading />}
        {state.status === 'error' && <CatalogError message={state.error} onRetry={() => setRetry((value) => value + 1)} />}
        {state.status === 'ready' && (state.items.length ? <><div className="product-grid">{state.items.map((product) => <ProductCard key={product.id} product={product} />)}</div><Pagination page={state.pagination.page} totalPages={state.pagination.totalPages} onChange={(page) => setQuery({ page })} /></> : <CatalogEmpty onReset={resetFilters} />)}
      </section>
    </div>
  </div>;
}
