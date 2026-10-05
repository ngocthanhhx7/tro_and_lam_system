import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { searchPublishedProducts } from '../../services/catalog/catalogApi.js';
import ProductCard from '../../components/catalog/ProductCard.jsx';
import { CatalogEmpty, CatalogError, CatalogLoading } from '../../components/catalog/CatalogStates.jsx';

const lineCopy = [
  { line: 'lifestyle', title: 'Trong nhịp sống thường ngày', description: 'Khám phá lư xông trầm mini, hũ trà và bộ chén độc ẩm khi các sản phẩm được công bố trong danh mục.' },
  { line: 'diplomacy', title: 'Dành cho những dịp trao tặng', description: 'Tìm hiểu các tác phẩm thuộc Diplomacy Line và hình thức liên hệ được niêm yết theo từng sản phẩm.' },
];

export default function CatalogHomePage() {
  const [state, setState] = useState({ status: 'loading', items: [], error: '' });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    searchPublishedProducts({ page: 1, limit: 100, sort: 'newest' }, { signal: controller.signal })
      .then((response) => setState({ status: 'ready', items: (response.data || []).filter((product) => product.featured).slice(0, 4), error: '' }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', items: [], error: error.message }); });
    return () => controller.abort();
  }, [retry]);

  return <>
    <section className="home-hero">
      <div className="home-hero__copy">
        <p className="eyebrow">GỐM CHU ĐẬU · TRO & LAM</p>
        <h1>Gốm cho nhịp sống hôm nay.</h1>
        <p className="home-hero__lead">Khám phá hai dòng sản phẩm, thông tin bán hàng đã công bố và câu chuyện được biên tập cho từng lựa chọn.</p>
        <div className="button-row">
          <Link className="button button--primary" to="/san-pham">Khám phá sản phẩm <span aria-hidden="true">→</span></Link>
          <Link className="button button--text" to="/qua-tang-doanh-nghiep">Tư vấn quà tặng <span aria-hidden="true">↗</span></Link>
        </div>
        <p className="home-hero__quiet">Giá và khả năng đặt mua hiển thị theo thông tin của từng sản phẩm đã công bố.</p>
      </div>
      <figure className="home-hero__art">
        <div className="home-hero__art-frame"><img src="/assets/generated/chu-dau-jar-editorial.jpg" alt="Minh họa biên tập về gốm." width="1200" height="896" fetchPriority="high" /></div>
        <figcaption>Ảnh minh họa do AI tạo; không đại diện sản phẩm đang bán.</figcaption>
        <span className="home-hero__seal" aria-hidden="true">TRO<br />& LAM</span>
      </figure>
      <span className="home-hero__index" aria-hidden="true">01 / 02</span>
    </section>

    <section className="home-lines section-wrap" aria-labelledby="lines-title">
      <div className="section-heading section-heading--split">
        <div><p className="eyebrow">BỘ SƯU TẬP</p><h2 id="lines-title">Hai hướng khám phá</h2></div>
        <Link className="text-link" to="/san-pham">Xem toàn bộ danh mục <span aria-hidden="true">→</span></Link>
      </div>
      <div className="line-grid">
        {lineCopy.map((line, index) => <Link className={`line-panel line-panel--${index + 1}`} key={line.line} to={`/bo-suu-tap/${line.line}`}>
          <span className="line-panel__number">0{index + 1}</span><p className="eyebrow">{line.line === 'lifestyle' ? 'LIFESTYLE LINE' : 'DIPLOMACY LINE'}</p>
          <h3>{line.title}</h3><p>{line.description}</p><span className="line-panel__link">Khám phá dòng gốm <span aria-hidden="true">↗</span></span>
        </Link>)}
      </div>
    </section>

    <section className="home-featured section-wrap" aria-labelledby="featured-title">
      <div className="section-heading section-heading--split">
        <div><p className="eyebrow">TỪ DANH MỤC ĐÃ CÔNG BỐ</p><h2 id="featured-title">Một vài điểm dừng</h2></div>
        <Link className="text-link" to="/san-pham">Đi đến danh mục <span aria-hidden="true">→</span></Link>
      </div>
      {state.status === 'loading' && <CatalogLoading count={4} />}
      {state.status === 'error' && <CatalogError message={state.error} onRetry={() => setRetry((value) => value + 1)} />}
      {state.status === 'ready' && (state.items.length ? <div className="product-grid">{state.items.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <CatalogEmpty />)}
    </section>

    <section className="home-story-band">
      <div className="home-story-band__inner">
        <p className="eyebrow">CÂU CHUYỆN · HOA VĂN · CHĂM SÓC</p>
        <h2>Thông tin rõ ràng, để mỗi lựa chọn bắt đầu từ điều đã được xác nhận.</h2>
        <p>Câu chuyện và hướng dẫn chỉ xuất hiện khi nội dung đã được biên tập, công bố.</p>
        <Link className="button button--light" to="/cau-chuyen">Đọc câu chuyện <span aria-hidden="true">→</span></Link>
      </div>
      <span className="home-story-band__ornament" aria-hidden="true">✳</span>
    </section>
  </>;
}
