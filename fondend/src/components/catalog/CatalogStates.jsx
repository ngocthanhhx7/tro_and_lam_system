export function CatalogLoading({ count = 6 }) {
  return <div className="product-grid" aria-label="Đang tải sản phẩm" aria-busy="true">
    {Array.from({ length: count }, (_, index) => <div className="product-skeleton" key={index} aria-hidden="true"><span /><span /><span /></div>)}
  </div>;
}

export function CatalogError({ message, onRetry }) {
  return <div className="catalog-state catalog-state--error" role="alert">
    <h2>Chưa tải được danh mục</h2>
    <p>{message || 'Kết nối đang gián đoạn. Hãy thử lại sau ít phút.'}</p>
    <button className="button button--outline" type="button" onClick={onRetry}>Thử lại</button>
  </div>;
}

export function CatalogEmpty({ onReset }) {
  return <div className="catalog-state">
    <span className="catalog-state__mark" aria-hidden="true">◌</span>
    <h2>Chưa có sản phẩm phù hợp</h2>
    <p>{onReset ? 'Thử thay đổi từ khóa hoặc xóa bộ lọc để khám phá thêm.' : 'Chưa có sản phẩm để trưng bày tại đây. Bạn có thể liên hệ để được tư vấn lựa chọn gốm.'}</p>
    {onReset && <button className="button button--outline" type="button" onClick={onReset}>Xóa bộ lọc</button>}
  </div>;
}

export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return <nav className="pagination" aria-label="Phân trang danh mục">
    <button type="button" className="button button--outline" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Trang trước">←</button>
    <span aria-live="polite">Trang {page} / {totalPages}</span>
    <button type="button" className="button button--outline" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Trang sau">→</button>
  </nav>;
}
