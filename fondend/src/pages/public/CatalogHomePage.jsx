import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { searchPublishedProducts } from '../../services/catalog/catalogApi.js';
import ProductCard from '../../components/catalog/ProductCard.jsx';
import { CatalogEmpty, CatalogError, CatalogLoading } from '../../components/catalog/CatalogStates.jsx';
import Icon from '../../components/catalog/Icon.jsx';
import { HeritageFilm } from '../../components/catalog/EditorialMedia.jsx';
import HeroMotion from '../../components/catalog/HeroMotion.jsx';
import HomePageDecorations from '../../components/catalog/HomePageDecorations.jsx';
import ProductLineSlideshow from '../../components/catalog/ProductLineSlideshow.jsx';
import { lifestyleSlides, diplomacySlides } from '../../constants/homepageSlides.js';
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
    <section className="collection-story home-product-line atelier-section" id="loi-ngo" aria-labelledby="home-lifestyle-title">
      <ProductLineSlideshow slides={lifestyleSlides} label="Lifestyle" />
      <div className="collection-story__copy">
        <p className="eyebrow">DÒNG SẢN PHẨM LIFESTYLE</p>
        <h2 id="home-lifestyle-title">Lifestyle – Tinh hoa gốm Việt trong cuộc sống</h2>
        <p><strong>Dòng sản phẩm Lifestyle</strong> của Gốm Chu Đậu là sự kết hợp hài hòa giữa nghệ thuật gốm truyền thống và phong cách sống hiện đại. Được chế tác từ nguồn nguyên liệu chọn lọc, sử dụng men tro trấu đặc trưng cùng kỹ thuật trang trí thủ công tinh xảo, mỗi sản phẩm đều mang đậm dấu ấn văn hóa Việt.</p>
        <p>Lấy cảm hứng từ hoa sen, chim hạc và những khung cảnh làng quê thanh bình, Lifestyle không chỉ mang đến vẻ đẹp thanh lịch cho không gian sống mà còn góp phần gìn giữ giá trị truyền thống trong từng khoảnh khắc sinh hoạt thường ngày.</p>
        <p className="home-product-line__motto"><strong>Tinh tế trong thiết kế – Bền đẹp trong sử dụng – Đậm đà bản sắc Việt.</strong></p>
        <Link className="text-link" to="/bo-suu-tap/lifestyle">Khám phá Lifestyle <Icon name="arrow" size={18} /></Link>
      </div>
      <div className="home-product-line__highlights" aria-labelledby="home-lifestyle-products">
        <h3 id="home-lifestyle-products">Các sản phẩm tiêu biểu</h3>
        <ol className="home-product-line__products">
          <li>
            <h4>Bộ Trà Lạc Hồng – Tinh hoa nghệ thuật thưởng trà</h4>
            <p>Bộ trà Lạc Hồng nổi bật với họa tiết chim hạc truyền thống, đường viền vàng sang trọng và lớp men tro trấu đặc trưng. Được chế tác kết hợp giữa công nghệ hiện đại và nghệ thuật thủ công, sản phẩm mang đến trải nghiệm thưởng trà thanh lịch, đồng thời là món quà ý nghĩa dành tặng người thân, bạn bè và đối tác.</p>
            <p><strong>Quy cách:</strong> 01 ấm, 06 chén, 07 đĩa kê – Dung tích ấm 760 ml.</p>
          </li>
          <li>
            <h4>Hộp Trà Gốm Chu Đậu – Gìn giữ hương vị truyền thống</h4>
            <p>Hộp trà Gốm Chu Đậu được chế tác tinh xảo với các họa tiết hoa sen, chim hạc, cỏ cây và làng quê Việt Nam. Kết hợp chất liệu gốm cao cấp cùng kỹ thuật trang trí thủ công, sản phẩm vừa hỗ trợ bảo quản hương vị trà, vừa tạo điểm nhấn thanh lịch cho không gian thưởng trà.</p>
          </li>
          <li>
            <h4>Bộ Đồ Ăn Gốm Chu Đậu – Nâng niu từng bữa cơm Việt</h4>
            <p>Bộ đồ ăn Gốm Chu Đậu kết hợp vẻ đẹp truyền thống với tính tiện dụng hiện đại. Những họa tiết đồng quê được vẽ thủ công dưới men, tái hiện cuộc sống thanh bình và ấm no của người Việt. Sản phẩm được nung ở nhiệt độ cao, chú trọng chất lượng và an toàn trong sử dụng, góp phần mang đến những bữa cơm gia đình ấm cúng, trọn vẹn.</p>
          </li>
        </ol>
      </div>
    </section>
    <section className="collection-story collection-story--reverse home-product-line atelier-section" aria-labelledby="home-diplomacy-title">
      <ProductLineSlideshow slides={diplomacySlides} label="Diplomacy" />
      <div className="collection-story__copy">
        <p className="eyebrow">DÒNG SẢN PHẨM DIPLOMACY</p>
        <h2 id="home-diplomacy-title">Diplomacy – Tinh hoa gốm sứ Việt Nam</h2>
        <p><strong>Dòng sản phẩm Diplomacy</strong> của Gốm Chu Đậu là sự kết tinh giữa nghệ thuật gốm truyền thống và bản sắc văn hóa Việt Nam. Lấy cảm hứng từ những tuyệt tác gốm cổ thời Trần – Lê Sơ, mỗi sản phẩm được chế tác tinh xảo, kết hợp kỹ thuật vẽ, khắc thủ công cùng dòng men tro trấu đặc trưng.</p>
        <p>Không chỉ mang giá trị nghệ thuật và lịch sử, từng họa tiết trên sản phẩm còn gửi gắm những thông điệp ý nghĩa về <strong>phú quý, thịnh vượng, thành công, hạnh phúc và sự hòa hợp</strong>. Đây là dòng sản phẩm gốm sứ cao cấp, tôn vinh tinh hoa văn hóa Việt và thích hợp làm quà tặng trang trọng.</p>
        <Link className="text-link" to="/bo-suu-tap/diplomacy">Khám phá Diplomacy <Icon name="arrow" size={18} /></Link>
      </div>
      <div className="home-product-line__highlights" aria-labelledby="home-diplomacy-products">
        <h3 id="home-diplomacy-products">Các sản phẩm tiêu biểu</h3>
        <ol className="home-product-line__products">
          <li>
            <h4>Bình Phượng Hoàng – Biểu tượng thịnh vượng</h4>
            <p>Lấy cảm hứng từ gốm cổ thế kỷ XIV–XV, bình nổi bật với họa tiết Phượng Hoàng, hoa cúc đại đóa và cánh sen cách điệu. Sản phẩm tượng trưng cho sự hòa hợp âm dương, công danh thành đạt, thịnh vượng và hạnh phúc viên mãn.</p>
          </li>
          <li>
            <h4>Bình Thiên Nga – Khát vọng vươn cao</h4>
            <p>Được phục dựng theo nguyên mẫu gốm cổ Chu Đậu thời Lê Sơ, bình mang họa tiết Thiên Nga với bốn tư thế “Phi – Minh – Túc – Thực”, biểu trưng cho sự thăng tiến, bình an, sung túc và cuộc sống đủ đầy.</p>
          </li>
          <li>
            <h4>Cặp bình Hoa Lam – Tỳ Bà – Hạnh phúc lứa đôi</h4>
            <p>Cặp bình đại diện cho sự hòa hợp âm dương trong văn hóa Việt. Bình Hoa Lam tượng trưng cho người đàn ông thành đạt, chính trực; bình Tỳ Bà tôn vinh vẻ đẹp và phẩm hạnh của người phụ nữ Việt Nam. Cả hai gửi gắm ước nguyện gia đình hòa thuận, hạnh phúc bền lâu.</p>
          </li>
          <li>
            <h4>Bình Giọt Ngọc Cửu Ngư Quần Hội – Tài lộc sum vầy</h4>
            <p>Nổi bật với họa tiết cá chép vượt Vũ Môn và chín cá chép quây quần bên hoa sen, bình tượng trưng cho công danh thăng tiến, tài lộc dồi dào, cuộc sống sung túc và gia đình đoàn viên hạnh phúc.</p>
          </li>
          <li>
            <h4>Bình Phú Quý Lý Ngư Vọng Nguyệt – Phú quý viên mãn</h4>
            <p>Được chế tác thủ công với họa tiết đôi cá chép hướng về ánh trăng, kết hợp hoa sen và nghệ thuật trang trí vàng kim. Sản phẩm biểu trưng cho ý chí vươn lên, sự thành đạt, tài lộc, phú quý và cuộc sống viên mãn.</p>
          </li>
        </ol>
      </div>
    </section>
    <section className="atelier-featured atelier-section"><div className="section-heading section-heading--split"><div><p className="eyebrow">LỰA CHỌN TỪ TRO & LAM</p><h2>Gốm dành cho bạn</h2></div><Link className="text-link" to="/san-pham">Tất cả sản phẩm <Icon name="arrow" size={18} /></Link></div>{state.status === 'loading' && <CatalogLoading count={4} />}{state.status === 'error' && <CatalogError onRetry={() => setRetry((value) => value + 1)} />}{state.status === 'ready' && (state.items.length ? <div className="product-grid">{state.items.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <CatalogEmpty />)}</section>
    <HeritageFilm />
    <section className="closing-note atelier-section"><div className="closing-note__content"><p className="eyebrow">MỖI NGÀY, MỘT CHÚT SẮC LAM</p><h2>Để vẻ đẹp của gốm<br />tiếp tục câu chuyện cùng bạn.</h2><Link className="text-link" to="/cau-chuyen">Ghé thăm góc câu chuyện <Icon name="arrow" size={18} /></Link></div></section>
    <HomePageDecorations />
  </>;
}
