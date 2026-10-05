import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ProductCard from '../../components/catalog/ProductCard.jsx';
import { CatalogEmpty, CatalogError, CatalogLoading, Pagination } from '../../components/catalog/CatalogStates.jsx';
import { getPublishedCategories, searchPublishedProducts } from '../../services/catalog/catalogApi.js';

const lineLabels = { lifestyle: 'Lifestyle Line', diplomacy: 'Diplomacy Line' };

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

export default function ProductCatalogPage() {
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
  return <div className="catalog-page section-wrap">
    <nav className="breadcrumbs" aria-label="Vị trí hiện tại"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">{pageTitle}</span></nav>
    <section className="catalog-page__intro">
      <p className="eyebrow">TRO & LAM · DANH MỤC ĐÃ CÔNG BỐ</p>
      <h1>{pageTitle}</h1>
      <p>Tìm kiếm và lọc theo thông tin sản phẩm đã được công bố. Sản phẩm yêu cầu báo giá không hiển thị mức giá giả.</p>
    </section>
    <div className="catalog-layout">
      <CatalogFilterForm key={routeKey} filters={filters} categories={categories} forcedLine={forcedLine} onApply={setQuery} onReset={resetFilters} />
      <section className="catalog-results" aria-label="Kết quả sản phẩm" aria-live="polite">
        <div className="catalog-results__top"><p>{state.pagination ? `${state.pagination.total} sản phẩm` : 'Danh mục sản phẩm'}</p>{state.pagination?.total > 0 && <span>Trang {state.pagination.page} / {state.pagination.totalPages}</span>}</div>
        {state.status === 'loading' && <CatalogLoading />}
        {state.status === 'error' && <CatalogError message={state.error} onRetry={() => setRetry((value) => value + 1)} />}
        {state.status === 'ready' && (state.items.length ? <><div className="product-grid">{state.items.map((product) => <ProductCard key={product.id} product={product} />)}</div><Pagination page={state.pagination.page} totalPages={state.pagination.totalPages} onChange={(page) => setQuery({ page })} /></> : <CatalogEmpty onReset={resetFilters} />)}
      </section>
    </div>
  </div>;
}
