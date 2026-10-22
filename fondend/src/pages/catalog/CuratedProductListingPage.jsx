import { useSearchParams } from 'react-router-dom';
import ProductCatalogPage from './ProductCatalogPage.jsx';
import { staticImageProps } from '../../services/catalog/staticImage.js';
import './curated-product-listing.css';

const lineTabs = [
  { id: '', label: 'Tất cả sản phẩm' },
  { id: 'lifestyle', label: 'Dòng gốm đời sống' },
  { id: 'diplomacy', label: 'Dòng gốm quà tặng' },
];

export default function CuratedProductListingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeLine = searchParams.get('line') || '';

  function selectLine(line) {
    const next = new URLSearchParams(searchParams);
    if (line) next.set('line', line);
    else next.delete('line');
    next.delete('page');
    setSearchParams(next);
  }

  return <div className="curated-listing">
    <header className="curated-listing__hero">
      <div className="curated-listing__hero-art" aria-hidden="true"><img {...staticImageProps('/assets/editorial/product-listing-hero.webp', { width: 960, sizes: '100vw' })} alt="" width="1586" height="992" loading="eager" fetchPriority="high" /></div>
      <div className="curated-listing__hero-inner section-wrap">
        <div className="curated-listing__hero-copy">
          <p className="eyebrow">GỐM CHU ĐẬU · TRO & LAM</p>
          <h1>Sản phẩm</h1>
          <p>Khám phá các sản phẩm Gốm Chu Đậu được tuyển chọn bởi TRO & LAM — kết hợp kỹ nghệ thủ công, hoa văn truyền thống và câu chuyện văn hóa Việt.</p>
          <nav className="curated-listing__tabs" aria-label="Dòng sản phẩm">
            {lineTabs.map((tab) => <button
              key={tab.id || 'all'}
              type="button"
              aria-current={activeLine === tab.id ? 'page' : undefined}
              onClick={() => selectLine(tab.id)}
            >{tab.label}</button>)}
          </nav>
        </div>
      </div>
    </header>
    <ProductCatalogPage showIntro={false} />
  </div>;
}
