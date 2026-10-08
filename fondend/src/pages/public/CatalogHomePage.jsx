import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { searchPublishedProducts } from '../../services/catalog/catalogApi.js';
import ProductCard from '../../components/catalog/ProductCard.jsx';
import { CatalogEmpty, CatalogError, CatalogLoading } from '../../components/catalog/CatalogStates.jsx';
import Icon from '../../components/catalog/Icon.jsx';
import { HeritageFilm } from '../../components/catalog/EditorialMedia.jsx';
import { lineImagery, media } from '../../constants/editorialMedia.js';
import HeroMotion from '../../components/catalog/HeroMotion.jsx';
import './homepage-ornaments.css';

export default function CatalogHomePage() {
  const [state, setState] = useState({ status: 'loading', items: [], error: '' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    searchPublishedProducts({ page: 1, limit: 100, sort: 'newest' }, { signal: controller.signal })
      .then((response) => {
        const featured = (response.data || []).filter((product) => product.featured);
        const items = [
          ...featured.filter((product) => product.line === 'lifestyle').slice(0, 2),
          ...featured.filter((product) => product.line === 'diplomacy').slice(0, 2),
        ];
        setState({ status: 'ready', items, error: '' });
      })
      .catch((error) => { if (error.name !== 'AbortError') setState({ status: 'error', items: [], error: error.message }); });
    return () => controller.abort();
  }, [retry]);
  return <>
    <section className="atelier-hero">
      <HeroMotion />
      <div className="atelier-hero__content"><p className="eyebrow">TRO & LAM · GỐM CHU ĐẬU</p><h1>Giữ một nét xưa.<br /><em>Chạm một nhịp sống mới.</em></h1><p>Từ vẻ đẹp của gốm, tìm về những điều bình dị.<br className="desktop-break" /> Một góc nhà an yên. Một món quà đầy ý nghĩa.</p><div className="button-row"><Link className="button button--light" to="/san-pham">Khám phá sản phẩm <Icon name="arrow" size={18} /></Link><a className="hero-film-link" href="#phim-gom"><Icon name="play" size={18} /> Câu chuyện của gốm</a></div></div>
      <div className="atelier-hero__bottom"><span>NẾP GỐM XƯA. NHỊP SỐNG MỚI.</span><a href="#loi-ngo">Chậm lại để cảm nhận <Icon name="chevron" size={16} /></a></div>
    </section>
    <section className="editorial-intro atelier-section" id="loi-ngo"><div className="editorial-intro__heading"><p className="eyebrow">HÀNH TRÌNH TRO & LAM</p><h2>Đưa gốm đến gần<br />hơn với mỗi ngày.</h2><div className="fine-rule" /><p>TRO & LAM kể câu chuyện về gốm Chu Đậu qua những điều gần gũi: một góc trà, một vật phẩm cho không gian sống, hay món quà dành cho dịp cần sự trân trọng.</p><Link className="text-link" to="/ve-chung-toi">Khám phá hành trình <Icon name="arrow" size={18} /></Link></div><figure className="editorial-intro__image"><img src={media.heritage} alt="Bình gốm hoa lam Chu Đậu trong bộ sưu tập bảo tàng" width="960" height="1200" loading="lazy" /><figcaption>Một góc nhìn về gốm Chu Đậu · Ảnh tư liệu</figcaption><span className="image-label">SẮC LAM<br />CÒN MÃI</span></figure></section>
    <section className="collection-story atelier-section" aria-labelledby="home-lifestyle-title"><div className="collection-story__image"><img src={lineImagery.lifestyle.home} alt={lineImagery.lifestyle.alt} loading="lazy" width="896" height="1152" /><small className="collection-story__disclosure">{lineImagery.lifestyle.disclosure}</small><span>01 / LIFESTYLE</span></div><div className="collection-story__copy"><p className="eyebrow">GỐM TRONG ĐỜI SỐNG</p><h2 id="home-lifestyle-title">Một chút gốm.<br />Một khoảng bình yên.</h2><p>Dành một góc nhỏ cho những điều bạn yêu. Khám phá dòng Lifestyle, nơi gốm đồng hành cùng không gian và nhịp sống mỗi ngày.</p><Link className="text-link" to="/bo-suu-tap/lifestyle">Khám phá Lifestyle <Icon name="arrow" size={18} /></Link></div></section>
    <section className="collection-story collection-story--reverse atelier-section" aria-labelledby="home-diplomacy-title"><div className="collection-story__image collection-story__image--vase"><img src={lineImagery.diplomacy.home} alt={lineImagery.diplomacy.alt} loading="lazy" width="896" height="1152" /><small className="collection-story__disclosure">{lineImagery.diplomacy.disclosure}</small><span>02 / DIPLOMACY</span></div><div className="collection-story__copy"><p className="eyebrow">GỐM CHO NHỮNG DỊP TRAO TẶNG</p><h2 id="home-diplomacy-title">Gửi một món quà.<br />Gói một tấm lòng.</h2><p>Một món quà được lựa chọn bằng sự quan tâm. Dòng Diplomacy mở ra những gợi ý gốm dành cho đối tác, tổ chức và những dịp trang trọng.</p><Link className="text-link" to="/bo-suu-tap/diplomacy">Khám phá Diplomacy <Icon name="arrow" size={18} /></Link></div></section>
    <section className="atelier-featured atelier-section"><div className="section-heading section-heading--split"><div><p className="eyebrow">LỰA CHỌN TỪ TRO & LAM</p><h2>Gốm dành cho bạn</h2></div><Link className="text-link" to="/san-pham">Tất cả sản phẩm <Icon name="arrow" size={18} /></Link></div>{state.status === 'loading' && <CatalogLoading count={4} />}{state.status === 'error' && <CatalogError onRetry={() => setRetry((value) => value + 1)} />}{state.status === 'ready' && (state.items.length ? <div className="product-grid">{state.items.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <CatalogEmpty />)}</section>
    <HeritageFilm />
    <section className="closing-note atelier-section"><img className="closing-note__lotus" src="/assets/editorial/lotus-line-ornament.svg" alt="" aria-hidden="true" width="240" height="160" loading="lazy" /><div className="closing-note__content"><p className="eyebrow">MỖI NGÀY, MỘT CHÚT SẮC LAM</p><h2>Để vẻ đẹp của gốm<br />tiếp tục câu chuyện cùng bạn.</h2><Link className="text-link" to="/cau-chuyen">Ghé thăm góc câu chuyện <Icon name="arrow" size={18} /></Link></div></section>
  </>;
}
