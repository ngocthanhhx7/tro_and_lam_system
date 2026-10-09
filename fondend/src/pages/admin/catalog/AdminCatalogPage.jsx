import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  archiveAdminCategory,
  archiveAdminProduct,
  getAdminProduct,
  listAdminCategories,
  listAdminProducts,
  saveAdminCategory,
  saveAdminProduct,
  uploadCatalogImage,
} from '../../../services/catalog/catalogApi.js';
import { CatalogError } from '../../../components/catalog/CatalogStates.jsx';
import Icon from '../../../components/catalog/Icon.jsx';
import { formatMoney } from '../../commerce/commerce.format.js';

const emptyProduct = () => ({ name: '', slug: '', sku: '', line: 'lifestyle', categoryId: '', description: '', material: '', dimensions: '', careInstructions: '', images: [], saleMode: 'quote', status: 'draft', featured: false });
const emptyCategory = () => ({ name: '', slug: '', description: '', sortOrder: 0, status: 'draft' });

function productDraftFrom(product) {
  return {
    ...emptyProduct(),
    ...product,
    categoryId: product.categoryId && typeof product.categoryId === 'object' ? product.categoryId.id : product.categoryId,
    images: product.images || [],
    expectedVersion: product.version,
    priceVnd: product.priceVnd || '',
    storyId: product.storyId && typeof product.storyId === 'object' ? product.storyId.id : product.storyId || '',
  };
}

function messageFor(error) {
  if (error.code === 'FORBIDDEN') return 'Tài khoản hiện tại không có quyền quản lý danh mục sản phẩm.';
  if (error.code === 'MEDIA_UNAVAILABLE') return 'Kho ảnh chưa được cấu hình. Ảnh được chọn chỉ ở trạng thái bản nháp và chưa tải lên.';
  if (error.code === 'VERSION_CONFLICT' && error.message === 'Dữ liệu đã thay đổi. Hãy tải lại và thử lại') return 'Dữ liệu đã đổi kể từ lần tải trước. Tải lại mục này để tránh ghi đè thay đổi khác.';
  return error.message || 'Yêu cầu chưa hoàn tất.';
}

export default function AdminCatalogPage({ initialTab = 'products' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isCategories = initialTab === 'categories' || location.pathname === '/admin/categories';
  const isNewProduct = location.pathname.endsWith('/new');
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ q: '', line: '', status: '' });
  const [submitted, setSubmitted] = useState(filters);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [categories, setCategories] = useState([]);
  const [catalogState, setCatalogState] = useState({ status: 'loading', error: '' });
  const [productDraft, setProductDraft] = useState(emptyProduct());
  const [categoryDraft, setCategoryDraft] = useState(emptyCategory());
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [mediaState, setMediaState] = useState({ status: 'idle', message: '' });
  const [retry, setRetry] = useState(0);

  const productEditorOpen = !isCategories && (isNewProduct || Boolean(id));

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    Promise.all([
      listAdminProducts({ page, limit: 20, ...submitted }, { signal: controller.signal }),
      listAdminCategories({ signal: controller.signal }),
    ]).then(([productResponse, categoryResponse]) => {
      if (!live) return;
      setProducts(productResponse.data || []);
      setPagination(productResponse.meta?.pagination || null);
      setCategories(categoryResponse.data || []);
      setCatalogState({ status: 'ready', error: '' });
    }).catch((error) => {
      if (!live || error.name === 'AbortError') return;
      setCatalogState({ status: 'error', error: messageFor(error) });
    });
    return () => { live = false; controller.abort(); };
  }, [page, retry, submitted]);

  useEffect(() => {
    if (isCategories) return;
    if (id) {
      const cached = products.find((item) => item.id === id);
      if (cached) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Route changes select the cached record that seeds this editor form.
        setProductDraft(productDraftFrom(cached));
      } else {
        const controller = new AbortController();
        getAdminProduct(id, { signal: controller.signal }).then((response) => setProductDraft(productDraftFrom(response.data)))
          .catch((error) => { setFormError(messageFor(error)); });
        return () => controller.abort();
      }
    } else if (isNewProduct) {
      setProductDraft(emptyProduct()); setFormMessage(''); setFormError('');
    }
  }, [id, isNewProduct, isCategories, products]);

  function updateProduct(field, value) { setProductDraft((current) => ({ ...current, [field]: value })); }
  function updateCategory(field, value) { setCategoryDraft((current) => ({ ...current, [field]: value })); }
  function selectCategory(categoryId) {
    const category = categories.find((item) => item.id === categoryId);
    setSelectedCategoryId(categoryId);
    setCategoryDraft(category ? { slug: category.slug, name: category.name, description: category.description || '', parentId: category.parentId || '', sortOrder: category.sortOrder, status: category.status, expectedVersion: category.version } : emptyCategory());
    setFormMessage(''); setFormError('');
  }

  async function handleProductSave(event) {
    event.preventDefault();
    if (productDraft.status === 'published' && productDraft.images.length < 1) {
      setFormError('Sản phẩm cần tối thiểu 1 ảnh trước khi công bố.'); setFormMessage('');
      return;
    }
    if (productDraft.images.length > 5) {
      setFormError('Mỗi sản phẩm có thể dùng tối đa 5 ảnh.'); setFormMessage('');
      return;
    }
    setSaving(true); setFormError(''); setFormMessage('');
    const payload = {
      name: productDraft.name.trim(), slug: productDraft.slug.trim(), sku: productDraft.sku.trim(),
      line: productDraft.line, categoryId: productDraft.categoryId,
      description: productDraft.description.trim(), material: productDraft.material.trim(),
      dimensions: (productDraft.dimensions || '').trim(),
      careInstructions: (productDraft.careInstructions || '').trim(),
      images: productDraft.images.map((image, sortOrder) => ({ url: image.url, alt: image.alt.trim(), sortOrder })),
      saleMode: productDraft.saleMode, status: productDraft.status, featured: Boolean(productDraft.featured),
      storyId: productDraft.storyId?.trim() || '',
    };
    if (productDraft.saleMode !== 'quote' && productDraft.priceVnd !== '') payload.priceVnd = Number(productDraft.priceVnd);
    if (id) payload.expectedVersion = productDraft.expectedVersion;
    try {
      const response = await saveAdminProduct(payload, id);
      setFormMessage('Đã lưu thông tin sản phẩm.');
      if (id) setProductDraft((current) => ({ ...current, expectedVersion: response.data.version }));
      else navigate(`/admin/products/${response.data.id}/edit`, { replace: true });
      setRetry((value) => value + 1);
    } catch (error) { setFormError(messageFor(error)); }
    finally { setSaving(false); }
  }

  async function handleProductArchive(product) {
    if (!window.confirm(`Lưu trữ “${product.name}”? Sản phẩm sẽ không còn hiện trong danh mục công khai.`)) return;
    setFormError(''); setFormMessage('');
    try {
      await archiveAdminProduct(product.id, product.version);
      setProducts((items) => items.map((item) => item.id === product.id ? { ...item, status: 'archived', version: item.version + 1 } : item));
      setFormMessage('Đã lưu trữ sản phẩm. Lịch sử đơn hàng không bị xóa.');
    } catch (error) { setFormError(messageFor(error)); }
  }

  async function handleCategorySave(event) {
    event.preventDefault(); setSaving(true); setFormError(''); setFormMessage('');
    const payload = { ...categoryDraft, name: categoryDraft.name.trim(), slug: categoryDraft.slug.trim(), description: categoryDraft.description.trim() };
    if (!payload.parentId) delete payload.parentId;
    try {
      const response = await saveAdminCategory(payload, selectedCategoryId || undefined);
      setFormMessage('Đã lưu danh mục.');
      if (selectedCategoryId) setCategoryDraft((current) => ({ ...current, expectedVersion: response.data.version }));
      else {
        setSelectedCategoryId(response.data.id);
        setCategoryDraft((current) => ({ ...current, expectedVersion: response.data.version }));
      }
      setRetry((value) => value + 1);
    } catch (error) { setFormError(messageFor(error)); }
    finally { setSaving(false); }
  }

  async function handleCategoryArchive(category) {
    if (!window.confirm(`Lưu trữ danh mục “${category.name}”?`)) return;
    setFormError(''); setFormMessage('');
    try {
      await archiveAdminCategory(category.id, category.version);
      setCategories((items) => items.map((item) => item.id === category.id ? { ...item, status: 'archived', version: item.version + 1 } : item));
      if (selectedCategoryId === category.id) { setSelectedCategoryId(''); setCategoryDraft(emptyCategory()); }
      setFormMessage('Đã lưu trữ danh mục.');
    } catch (error) { setFormError(messageFor(error)); }
  }

  async function handleImageUpload() {
    setMediaState((current) => ({ ...current, status: 'uploading', message: 'Đang kiểm tra và tải ảnh…' }));
    setFormError('');
    if (!selectedFiles.length || selectedFiles.some((item) => !item.alt.trim())) {
      setMediaState({ status: 'draft', message: 'Chọn từ 1 đến 5 ảnh và nhập mô tả riêng cho từng ảnh.' });
      return;
    }
    if (productDraft.images.length + selectedFiles.length > 5) {
      setMediaState({ status: 'draft', message: 'Tổng số ảnh của sản phẩm không được vượt quá 5.' });
      return;
    }
    const uploadedIds = new Set();
    const uploadedImages = [];
    let uploadError;
    for (const item of selectedFiles) {
      try {
        const response = await uploadCatalogImage(item.file, item.alt.trim());
        const media = response.data;
        if (!media?.url || media.status !== 'ready') throw new Error('Kho ảnh chưa xác nhận URL công khai. Ảnh vẫn ở trạng thái bản nháp.');
        uploadedImages.push({ url: media.url, alt: media.alt, sortOrder: productDraft.images.length + uploadedImages.length });
        uploadedIds.add(item.id);
      } catch (error) {
        uploadError = error;
        break;
      }
    }
    if (uploadedImages.length) {
      setProductDraft((current) => ({ ...current, images: [...current.images, ...uploadedImages] }));
    }
    if (uploadedIds.size) setSelectedFiles((current) => current.filter((item) => !uploadedIds.has(item.id)));
    if (uploadError) {
      const prefix = uploadedImages.length ? `Đã tải ${uploadedImages.length} ảnh; ` : '';
      setMediaState({ status: uploadError.code === 'MEDIA_UNAVAILABLE' ? 'unavailable' : 'draft', message: `${prefix}${messageFor(uploadError)}` });
    } else {
      setMediaState({ status: 'ready', message: `Đã tải ${uploadedImages.length} ảnh vào kho media.` });
    }
  }

  return <main className="admin-catalog section-wrap">
    <div className="admin-catalog__header">
      <div><p className="eyebrow">TRO &amp; LAM · QUẢN TRỊ</p><h1>{isCategories ? 'Quản lý danh mục' : 'Quản lý sản phẩm'}</h1><p>Quản lý tác phẩm, bộ sưu tập và nội dung sản phẩm.</p></div>
      {!isCategories && <Link className="button button--primary" to="/admin/products/new"><Icon name="plus" size={17} /> Thêm sản phẩm</Link>}
    </div>
    <nav className="admin-tabs" aria-label="Quản lý danh mục"><Link className={!isCategories ? 'is-active' : ''} to="/admin/products">Sản phẩm</Link><Link className={isCategories ? 'is-active' : ''} to="/admin/categories">Danh mục</Link></nav>
    {!isCategories && <form className="operations-toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSubmitted({ ...filters }); setCatalogState({ status: 'loading', error: '' }); }}>
      <label>Tìm tác phẩm<input type="search" placeholder="Tên tác phẩm hoặc mã SKU" maxLength={120} value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} /></label>
      <label>Bộ sưu tập<select value={filters.line} onChange={(event) => setFilters({ ...filters, line: event.target.value })}><option value="">Tất cả</option><option value="lifestyle">Lifestyle</option><option value="diplomacy">Diplomacy</option></select></label>
      <label>Trạng thái<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Tất cả</option><option value="published">Đã công bố</option><option value="draft">Bản nháp</option><option value="archived">Đã lưu trữ</option></select></label><button className="operations-button" type="submit">Lọc</button>
    </form>}
    {catalogState.status === 'error' && <CatalogError message={catalogState.error} onRetry={() => { setCatalogState({ status: 'loading', error: '' }); setRetry((value) => value + 1); }} />}
    {catalogState.status === 'loading' && <p className="admin-loading" role="status">Đang tải danh mục quản trị…</p>}
    {catalogState.status === 'ready' && <div className="admin-catalog__layout">
      {isCategories ? <>
        <section className="admin-list" aria-labelledby="admin-category-list-title">
          <div className="section-heading"><p className="eyebrow">CATEGORIES</p><h2 id="admin-category-list-title">Danh mục</h2></div>
          <button className="button button--primary" type="button" onClick={() => selectCategory('')}>Tạo danh mục mới</button>
          <ul className="admin-record-list">{categories.map((category) => <li key={category.id}><button type="button" className="admin-record" onClick={() => selectCategory(category.id)}><span><strong>{category.name}</strong><small>{category.slug} · {category.status}</small></span><span aria-hidden="true">→</span></button><button className="icon-button admin-record__archive" type="button" onClick={() => handleCategoryArchive(category)} disabled={category.status === 'archived'} aria-label={`Lưu trữ danh mục ${category.name}`}>⌫</button></li>)}</ul>
          {!categories.length && <p>Chưa có danh mục. Thêm danh mục sau khi có dữ liệu thật được duyệt.</p>}
        </section>
        <section className="admin-editor" aria-labelledby="admin-category-form-title">
          <p className="eyebrow">THÔNG TIN DANH MỤC</p><h2 id="admin-category-form-title">{selectedCategoryId ? 'Chỉnh sửa danh mục' : 'Thêm danh mục'}</h2>
          <form className="catalog-form" onSubmit={handleCategorySave}>
            <label>Tên danh mục<input required maxLength="120" value={categoryDraft.name} onChange={(event) => updateCategory('name', event.target.value)} /></label>
            <label>Đường dẫn<input required maxLength="180" pattern="[a-z0-9]+(-[a-z0-9]+)*" value={categoryDraft.slug} onChange={(event) => updateCategory('slug', event.target.value)} /><small>Ví dụ: viet-tay. Dùng chữ thường, số và dấu gạch ngang.</small></label>
            <label>Mô tả<textarea maxLength="5000" rows="4" value={categoryDraft.description} onChange={(event) => updateCategory('description', event.target.value)} /></label>
            <label>Danh mục cha<select value={categoryDraft.parentId || ''} onChange={(event) => updateCategory('parentId', event.target.value)}><option value="">Không có</option>{categories.filter((item) => item.id !== selectedCategoryId && item.status !== 'archived').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <div className="catalog-form__grid"><label>Thứ tự<input type="number" min="0" step="1" value={categoryDraft.sortOrder ?? 0} onChange={(event) => updateCategory('sortOrder', Number(event.target.value))} /></label><label>Trạng thái<select value={categoryDraft.status} onChange={(event) => updateCategory('status', event.target.value)}><option value="draft">Bản nháp</option><option value="published">Đã công bố</option><option value="archived">Đã lưu trữ</option></select></label></div>
            <button className="button button--primary" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu danh mục'}</button>
            {formError && <p className="form-feedback form-feedback--error" role="alert">{formError}</p>}{formMessage && <p className="form-feedback form-feedback--success" role="status">{formMessage}</p>}
          </form>
        </section>
      </> : <>
        <section className="admin-list" aria-labelledby="admin-product-list-title">
          <div className="section-heading"><p className="eyebrow">PRODUCTS</p><h2 id="admin-product-list-title">Sản phẩm</h2></div>
          <div className="workspace-table-wrap"><table><thead><tr><th>Tác phẩm</th><th>Bộ sưu tập</th><th>Giá bán</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}>
            <td><Link className="admin-product-cell" to={`/admin/products/${product.id}/edit`}>{product.images[0]?.url ? <img src={product.images[0].url} alt="" /> : <Icon name="pottery" size={32} />}<span><strong>{product.name}</strong><small>{product.sku}</small></span></Link></td>
            <td>{product.line === 'lifestyle' ? 'Lifestyle' : 'Diplomacy'}</td><td>{product.priceVnd ? formatMoney(product.priceVnd) : 'Theo báo giá'}</td><td><span className={`workspace-badge workspace-badge--${product.status === 'published' ? 'paid' : 'pending'}`}>{({ draft: 'Bản nháp', published: 'Đã công bố', archived: 'Đã lưu trữ' })[product.status]}</span></td>
            <td><Link to={`/admin/products/${product.id}/edit`}>Chỉnh sửa</Link><button className="icon-button admin-record__archive" type="button" onClick={() => handleProductArchive(product)} disabled={product.status === 'archived'} aria-label={`Lưu trữ sản phẩm ${product.name}`}><Icon name="history" size={16} /></button></td>
          </tr>)}</tbody></table></div>
          {pagination && <nav className="operations-pagination" aria-label="Phân trang sản phẩm"><span>{pagination.total} tác phẩm · Trang {page} / {pagination.totalPages || 1}</span><div><button type="button" className="operations-button operations-button--quiet" disabled={page === 1} onClick={() => setPage(page - 1)}>Trước</button><button type="button" className="operations-button operations-button--quiet" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Sau</button></div></nav>}
          {!productEditorOpen && formError && <p className="form-feedback form-feedback--error" role="alert">{formError}</p>}
          {!productEditorOpen && formMessage && <p className="form-feedback form-feedback--success" role="status">{formMessage}</p>}
          {!products.length && <p>Chưa có sản phẩm. Tạo bản nháp sau khi được cung cấp mã SKU và nội dung đã xác nhận.</p>}
        </section>
        <section className="admin-editor" aria-labelledby="admin-product-form-title">
          {productEditorOpen ? <>
            <p className="eyebrow">{id ? 'CẬP NHẬT THEO PHIÊN BẢN' : 'NỘI DUNG CHƯA CÔNG BỐ'}</p><h2 id="admin-product-form-title">{id ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}</h2>
            <form className="catalog-form" onSubmit={handleProductSave}>
              <label>Tên sản phẩm<input required minLength="1" maxLength="160" value={productDraft.name} onChange={(event) => updateProduct('name', event.target.value)} /></label>
              <div className="catalog-form__grid"><label>Đường dẫn<input required maxLength="180" pattern="[a-z0-9]+(-[a-z0-9]+)*" value={productDraft.slug} onChange={(event) => updateProduct('slug', event.target.value)} placeholder="vi-du-san-pham" /><small>Dùng chữ thường, số và dấu gạch ngang.</small></label><label>SKU<input required maxLength="80" value={productDraft.sku} onChange={(event) => updateProduct('sku', event.target.value)} /></label></div>
              <div className="catalog-form__grid"><label>Dòng sản phẩm<select value={productDraft.line} onChange={(event) => updateProduct('line', event.target.value)}><option value="lifestyle">Lifestyle Line</option><option value="diplomacy">Diplomacy Line</option></select></label><label>Danh mục<select required value={productDraft.categoryId} onChange={(event) => updateProduct('categoryId', event.target.value)}><option value="">Chọn danh mục</option>{categories.filter((item) => item.status !== 'archived').map((category) => <option key={category.id} value={category.id}>{category.name} · {category.status}</option>)}</select></label></div>
              <label>Mô tả<textarea required maxLength="12000" rows="5" value={productDraft.description} onChange={(event) => updateProduct('description', event.target.value)} /></label>
              <div className="catalog-form__grid"><label>Chất liệu<input required maxLength="500" value={productDraft.material} onChange={(event) => updateProduct('material', event.target.value)} /></label><label>Kích thước<input maxLength="300" value={productDraft.dimensions || ''} onChange={(event) => updateProduct('dimensions', event.target.value)} /></label></div>
              <label>Hướng dẫn chăm sóc<textarea maxLength="3000" rows="3" value={productDraft.careInstructions || ''} onChange={(event) => updateProduct('careInstructions', event.target.value)} /></label>
              <div className="catalog-form__grid"><label>Hình thức bán<select value={productDraft.saleMode} onChange={(event) => updateProduct('saleMode', event.target.value)}><option value="buy">Mua trực tiếp</option><option value="quote">Yêu cầu báo giá</option><option value="both">Mua hoặc yêu cầu báo giá</option></select></label>
                {productDraft.saleMode !== 'quote' && <label>Giá công bố (VND)<input type="number" min="1" step="1" required value={productDraft.priceVnd ?? ''} onChange={(event) => updateProduct('priceVnd', event.target.value)} /></label>}
              </div>
              <div className="catalog-form__grid"><label>Trạng thái<select value={productDraft.status} onChange={(event) => updateProduct('status', event.target.value)}><option value="draft">Bản nháp</option><option value="published">Đã công bố</option><option value="archived">Đã lưu trữ</option></select></label><label>Mã câu chuyện đã duyệt (tùy chọn)<input value={productDraft.storyId || ''} onChange={(event) => updateProduct('storyId', event.target.value)} /></label></div>
              <label className="check-label"><input type="checkbox" checked={Boolean(productDraft.featured)} onChange={(event) => updateProduct('featured', event.target.checked)} /><span>Đưa vào mục nổi bật</span></label>
              <fieldset className="media-fieldset"><legend>Ảnh sản phẩm</legend><p>Sản phẩm công bố cần từ 1 đến 5 ảnh có quyền sử dụng. Có thể chọn và tải nhiều ảnh cùng lúc; dữ liệu demo dùng 3 ảnh mỗi sản phẩm. Không dùng minh họa biên tập như ảnh của SKU.</p><p>Đã tải {productDraft.images.length}/5 ảnh.</p>
                {productDraft.images.length > 0 && <ul className="media-list">{productDraft.images.map((image, index) => <li key={`${image.url}-${index}`}><img src={image.url} alt="" width="64" height="64" /><span><strong>{image.alt}</strong><small>{image.url}</small></span><button type="button" className="icon-button" aria-label={`Xóa ảnh ${image.alt}`} onClick={() => updateProduct('images', productDraft.images.filter((_, itemIndex) => itemIndex !== index))}>×</button></li>)}</ul>}
                <div className="media-upload">
                  <label>Chọn tệp ảnh<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={mediaState.status === 'uploading' || productDraft.images.length + selectedFiles.length >= 5} onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    event.target.value = '';
                    if (productDraft.images.length + selectedFiles.length + files.length > 5) {
                      setMediaState({ status: 'draft', message: 'Mỗi sản phẩm có thể dùng tối đa 5 ảnh. Hãy chọn ít tệp hơn.' });
                      return;
                    }
                    setSelectedFiles((current) => [...current, ...files.map((file, index) => ({ id: `${Date.now()}-${index}-${file.name}`, file, alt: '' }))]);
                    setMediaState({ status: 'idle', message: '' });
                  }} /></label>
                  {selectedFiles.length > 0 && <ul className="media-list">{selectedFiles.map((item) => <li key={item.id}><span><strong>{item.file.name}</strong><small>{Math.ceil(item.file.size / 1024)} KB · Chưa tải lên</small><label>Mô tả ảnh<input value={item.alt} required maxLength="250" disabled={mediaState.status === 'uploading'} onChange={(event) => setSelectedFiles((current) => current.map((entry) => entry.id === item.id ? { ...entry, alt: event.target.value } : entry))} /></label></span><button type="button" className="icon-button" disabled={mediaState.status === 'uploading'} aria-label={`Bỏ ảnh ${item.file.name}`} onClick={() => setSelectedFiles((current) => current.filter((entry) => entry.id !== item.id))}>×</button></li>)}</ul>}
                  <button type="button" className="button button--outline" onClick={handleImageUpload} disabled={mediaState.status === 'uploading' || selectedFiles.length === 0}>{mediaState.status === 'uploading' ? 'Đang tải…' : `Tải ${selectedFiles.length || ''} ảnh lên kho media`}</button>
                  {mediaState.message && <p className={`form-feedback${mediaState.status === 'ready' ? ' form-feedback--success' : ' form-feedback--warning'}`} role="status">{mediaState.message}</p>}
                </div>
              </fieldset>
              <button className="button button--primary" type="submit" disabled={saving || mediaState.status === 'uploading'}>{saving ? 'Đang lưu…' : id ? 'Lưu thay đổi' : 'Tạo sản phẩm'}</button>
              {formError && <p className="form-feedback form-feedback--error" role="alert">{formError}</p>}{formMessage && <p className="form-feedback form-feedback--success" role="status">{formMessage}</p>}
            </form>
          </> : <div className="admin-editor__empty"><span className="catalog-state__mark" aria-hidden="true">◌</span><h2>Quản lý nội dung sản phẩm</h2><p>Chọn một sản phẩm hoặc tạo bản nháp. Trạng thái công bố chỉ dành cho dữ liệu đã được xác nhận.</p></div>}
        </section>
      </>}
    </div>}
  </main>;
}
