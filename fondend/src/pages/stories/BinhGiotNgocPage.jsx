import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NfcSectionNav, OrnamentIcon, PageMotif, SectionHeading, SectionWave } from './NfcPageParts.jsx';
import { setPageMetadata } from '../../utils/pageMetadata.js';
import './binh-giot-ngoc.css';

const productImages = [
  { src: '/assets/products/owner-provided/binh-giot-ngoc-01.webp', label: 'Họa tiết hoa', alt: 'Bình Giọt Ngọc với họa tiết hoa và lá vẽ thủ công' },
  { src: '/assets/products/owner-provided/binh-giot-ngoc-02.webp', label: 'Vịnh Hạ Long', alt: 'Bình Giọt Ngọc với phong cảnh Vịnh Hạ Long' },
  { src: '/assets/products/owner-provided/binh-giot-ngoc-03.webp', label: 'Chữ Phúc', alt: 'Bình Giọt Ngọc trang trí chữ Phúc màu đỏ' },
];

const motifs = [
  { icon: 'leaf', title: 'Lá chuối, lá lúa, chim Lạc', text: 'Cội nguồn nông nghiệp lúa nước & hồn thiêng sông núi' },
  { icon: 'flower', title: 'Hoa cúc đại đóa', text: 'Biểu tượng của trường thọ, thanh tao và chính khí' },
  { icon: 'lotus', title: 'Cánh sen cách điệu', text: 'Tâm an nhiên, sự thanh khiết giác ngộ của nhà Phật' },
  { icon: 'star', title: 'Họa tiết mẫu đơn', text: 'Phú quý phồn vinh, vương giả và hôn nhân viên mãn' },
];

const craftSteps = [
  { title: 'Chọn đất', src: '/assets/video/tro-lam-banner-poster.jpg', alt: 'Đôi tay người thợ cùng đất gốm trong phim tư liệu Tro & Lam', text: 'Đất sét trắng trầm tích sông Lục Đầu lắng đọng ngàn năm, khử tạp chất đạt độ tinh khiết tuyệt đối.' },
  { title: 'Tạo hình', src: '/assets/photography/pottery-hands.jpg', alt: 'Đôi bàn tay tạo hình gốm trên bàn xoay', text: 'Nghệ nhân chuốt gốm trên bàn xoay hoặc đúc khuôn tinh vi, tạo dáng bình thu nhỏ cổ, phình rộng thân.' },
  { title: 'Vẽ họa tiết', src: productImages[0].src, alt: 'Cận cảnh họa tiết hoa lá trên thân Bình Giọt Ngọc', text: 'Họa sĩ vẽ tay trực tiếp bằng bút lông lông thỏ dưới men, từng nét thanh nét đậm phóng khoáng thần tình.' },
  { title: 'Nung hoàn thiện', src: '/assets/editorial/diplomacy-slides/binh-giot-ngoc.webp', alt: 'Bình Giọt Ngọc hoàn thiện trong phối cảnh trưng bày ánh vàng', text: 'Ủ men tro trấu độc bản và nung ở nhiệt độ cao trên 1260°C, men chảy tự nhiên tạo màu lam ngọc huyền ảo.' },
];

const wishes = [
  { src: '/assets/nfc/binh-giot-ngoc/thu-hut-tai-loc.png', alt: 'Túi gấm đỏ đựng tiền vàng bên cây quất và đèn lồng', title: 'Thu hút tài lộc', text: 'Mang may mắn, tài lộc và thịnh vượng đến gia chủ.' },
  { src: '/assets/nfc/binh-giot-ngoc/may-man-vuong-khi.png', alt: 'Cỏ bốn lá xanh trên nền đất', title: 'May mắn và vượng khí', text: 'Biểu trưng cho bình an, hạnh phúc và năng lượng tích cực.' },
  { src: '/assets/nfc/binh-giot-ngoc/cuoc-song-du-day.png', alt: 'Gia đình quây quần vui vẻ bên mâm cơm', title: 'Cuộc sống đủ đầy', text: 'Gửi gắm ước vọng về cuộc sống sung túc, viên mãn.' },
  { src: '/assets/nfc/binh-giot-ngoc/thanh-dat-thinh-vuong.png', alt: 'Đôi tay trao tặng hộp quà thắt nơ trắng', title: 'Thành đạt và thịnh vượng', text: 'Là món quà ý nghĩa dành tặng đối tác, người thân trong những dịp đặc biệt.' },
];

const careGuides = [
  { iconSrc: '/assets/nfc/binh-giot-ngoc/cleaning.png', title: 'Vệ sinh sản phẩm', items: ['Dùng khăn mềm, khô hoặc hơi ẩm lau nhẹ bề mặt.', 'Tránh dùng hóa chất mạnh gây ảnh hưởng đến lớp men.'] },
  { icon: 'shield', title: 'Bảo quản sản phẩm', items: ['Đặt ở nơi khô ráo, thoáng mát.', 'Tránh va đập mạnh, tránh để sản phẩm tiếp xúc trực tiếp với lửa hoặc nhiệt độ cao.'] },
  { icon: 'warning', title: 'Lưu ý khi sử dụng', items: ['Không ngâm sản phẩm trong nước.', 'Hạn chế tiếp xúc với các vật sắc nhọn gây trầy xước.'] },
  { icon: 'nfc', title: 'Lưu ý đối với chip NFC', items: ['Tránh để chip NFC tiếp xúc với nước hoặc môi trường ẩm ướt.', 'Giữ chip ở trạng thái nguyên vẹn để đảm bảo khả năng quét và truy xuất thông tin sản phẩm.'] },
];

export default function BinhGiotNgocPage() {
  const [selectedImage, setSelectedImage] = useState(0);
  const image = productImages[selectedImage];

  useEffect(() => {
    setPageMetadata({
      title: 'Bình Giọt Ngọc - Gốm Chu Đậu | TRO & LAM',
      description: 'Khám phá câu chuyện Bình Giọt Ngọc, tinh hoa gốm Chu Đậu: họa tiết biểu tượng, hành trình chế tác, ý nghĩa và hướng dẫn chăm sóc sản phẩm.',
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return <main className="giot-ngoc-page" id="main-content">
    <section className="gn-hero" aria-labelledby="giot-ngoc-title">
      <img className="gn-hero-lotus" src="/assets/motifs/lotus-512.webp" alt="" aria-hidden="true" />
      <PageMotif motif="craneClouds" placement="hero-crane" opacity={.17} />
      <div className="gn-container gn-hero-grid">
        <div className="gn-hero-copy">
          <div className="gn-title-row">
            <div>
              <p className="gn-eyebrow">Kiệt tác di sản hoàng triều</p>
              <h1 id="giot-ngoc-title">BÌNH<br /><span>GIỌT NGỌC</span></h1>
            </div>
            <span className="gn-seal" aria-label="Chu Đậu">CHU ĐẬU</span>
          </div>
          <p className="gn-subtitle">Tinh hoa gốm Chu Đậu – Trong từng họa tiết</p>
          <p className="gn-hero-intro">Một tác phẩm gốm mang giá trị thẩm mỹ, là nơi lưu giữ những câu chuyện về lịch sử, nghệ thuật và khát vọng của người Việt. Biểu tượng cho sự thăng hoa của tinh thần dân tộc và cốt cách thanh cao nghìn năm văn hiến.</p>
          <div className="gn-gallery">
            <p className="gn-eyebrow" id="gn-gallery-label">Góc nhìn tuyệt tác</p>
            <div className="gn-thumbnails" role="group" aria-labelledby="gn-gallery-label">
              {productImages.map((item, index) => <button type="button" key={item.src} className={`gn-thumbnail${selectedImage === index ? ' is-active' : ''}`} onClick={() => setSelectedImage(index)} aria-pressed={selectedImage === index} aria-label={`Xem Bình Giọt Ngọc – ${item.label}`} aria-controls="gn-hero-image">
                <img src={item.src} alt="" width="80" height="80" />
              </button>)}
            </div>
            <p className="gn-image-label" aria-live="polite">{image.label}</p>
          </div>
        </div>
        <div className="gn-hero-visual">
          <div className="gn-vase-frame"><img key={image.src} id="gn-hero-image" src={image.src} alt={image.alt} width="498" height="502" fetchPriority="high" /></div>
          <div className="gn-pedestal" aria-hidden="true" />
        </div>
      </div>
      <SectionWave />
    </section>

    <NfcSectionNav prefix="gn" />
    <section className="gn-section gn-pattern" aria-labelledby="gn-story-title">
      <PageMotif motif="bamboo" placement="story-bamboo" />
      <PageMotif motif="birdBlossoms" placement="story-blossoms" opacity={.18} />
      <div className="gn-container">
        <SectionHeading id="gn-story-title">1. Câu chuyện sản phẩm</SectionHeading>
        <div className="gn-story-grid">
          <div className="gn-story-copy">
            <p className="gn-drop-cap">Bình Giọt Ngọc là sản phẩm gốm Chu Đậu lấy cảm hứng từ nghệ thuật tạo hình gốm Việt thời Trần – Lê sơ thế kỷ XIV - XV, mang vẻ đẹp hài hòa giữa đường nét truyền thống và những giá trị văn hóa được lưu giữ qua hàng trăm năm.</p>
            <blockquote>Với tinh thần tôn vinh những nét văn hóa đặc trưng của gốm Chu Đậu, Bình Giọt Ngọc được họa trang điểm những đóa hoa sen, cúc, mẫu đơn tinh xảo, thể hiện sự thanh khiết, cao quý và bền vững.</blockquote>
            <p>Không chỉ là một vật phẩm trang trí, Bình Giọt Ngọc còn là cầu nối giữa quá khứ và hiện tại, lưu giữ tinh hoa nghề gốm truyền thống, tôn vinh bàn tay tài hoa của những nghệ nhân, và mang lại giá trị tinh thần sâu sắc cho không gian sống hiện đại.</p>
            <div className="gn-symbol-note"><span aria-hidden="true">✓</span><p>Dáng bình “miệng loe, cổ thắt, thân phình tròn” – Thế phong thủy tích tài đọng lộc vững chãi trường tồn.</p></div>
          </div>
          <figure className="gn-detail-photo">
            <img src={productImages[0].src} alt="Chi tiết cổ bình và họa tiết hoa lá trên Bình Giọt Ngọc" width="498" height="502" loading="lazy" />
            <figcaption>Chi tiết men tro trấu &amp; men lam ngọc cổ truyền</figcaption>
          </figure>
          <div className="gn-motifs">
            <h3>Họa tiết biểu tượng</h3>
            {motifs.map((motif) => <div className="gn-motif" key={motif.title}><span className="gn-icon-round"><OrnamentIcon name={motif.icon} /></span><div><h4>{motif.title}</h4><p>{motif.text}</p></div></div>)}
          </div>
        </div>
      </div>
      <SectionWave tone="navy" reverse />
    </section>

    <section className="gn-section gn-craft" aria-labelledby="gn-craft-title">
      <PageMotif motif="craneClouds" placement="craft-crane" opacity={.2} />
      <div className="gn-container">
        <SectionHeading id="gn-craft-title">2. Hành trình chế tác</SectionHeading>
        <p className="gn-section-intro">Từ dòng đất sét tinh khiết của sông Lục Đầu, qua bàn tay tài hoa của nghệ nhân, mỗi sản phẩm là kết tinh của kỹ thuật, tâm huyết và giá trị văn hóa.</p>
        <ol className="gn-craft-grid">
          {craftSteps.map((step, index) => <li className="gn-craft-step" key={step.title}>
            <div className="gn-craft-photo"><img src={step.src} alt={step.alt} width="640" height="480" loading="lazy" /><span>{String(index + 1).padStart(2, '0')}</span></div>
            <h3>{step.title}</h3><p>{step.text}</p>
          </li>)}
        </ol>
        <p className="gn-media-note">Hình ảnh minh họa từ tư liệu nghề gốm và ảnh sản phẩm trong dự án. <Link to="/nguon-tu-lieu">Nguồn hình ảnh &amp; phim</Link></p>
      </div>
      <SectionWave />
    </section>

    <section className="gn-section gn-pattern" aria-labelledby="gn-wishes-title">
      <PageMotif motif="swallowBlossoms" placement="wishes-blossoms" opacity={.12} />
      <PageMotif motif="drum" placement="wishes-drum" opacity={.12} />
      <PageMotif motif="riverLotus" placement="wishes-river" opacity={.16} />
      <div className="gn-container">
        <SectionHeading id="gn-wishes-title">3. Ý nghĩa và lời chúc</SectionHeading>
        <p className="gn-section-intro">Bình Giọt Ngọc được phỏng theo mẫu bình gốm Chu Đậu cổ ngày xưa, với những đường nét hoa văn được lưu giữ, mang đậm bản sắc văn hóa Việt. Biểu trưng ý nghĩa thu hút tài lộc, may mắn và vượng khí cho gia chủ. Bình Giọt Ngọc Gốm Chu Đậu được coi là sản phẩm trang trí đặc trưng, là lựa chọn quà tặng hàng đầu cho bạn.</p>
        <div className="gn-card-grid gn-wishes">
          {wishes.map((wish) => <div className="gn-card gn-wish" key={wish.title}>
            <img className="gn-wish-photo" src={wish.src} alt={wish.alt} loading="lazy" decoding="async" />
            <div className="gn-wish-copy"><h3>{wish.title}</h3><p>{wish.text}</p></div>
          </div>)}
        </div>
        <div className="gn-highlights">
          <div className="gn-highlight"><p className="gn-eyebrow">Di sản gốm quốc bảo</p><h3>Bình Giọt Ngọc với chất men kỷ lục độc bản Việt Nam</h3><p>Men gốm Chu Đậu được xác lập Kỷ lục Độc bản Việt Nam - được chiết xuất từ tro trấu nếp cái hoa vàng kết hợp đất sét Lục Đầu Giang. Lớp men rạn tự nhiên màu nước dưa hoặc vàng ngà quý phái, trường tồn với thời gian mà không một dòng gốm nào trên thế giới có được.</p></div>
          <div className="gn-highlight"><p className="gn-eyebrow">Phong thủy &amp; ngoại giao</p><h3>Món đồ trang trí phong thủy, quà tặng như ý</h3><p>Được mệnh danh là pháp bảo phong thủy chiêu tài khai vận cho phòng khách, phòng làm việc lãnh đạo. Đồng thời là tặng phẩm ngoại giao cấp quốc gia cao quý, gửi trao thành ý trân trọng và ước nguyện phồn vinh tới bạn bè quốc tế và đối tác tri kỷ.</p></div>
        </div>
      </div>
      <SectionWave tone="navy" reverse />
    </section>

    <section className="gn-section gn-care" aria-labelledby="gn-care-title">
      <PageMotif motif="bamboo" placement="care-bamboo" opacity={.12} />
      <PageMotif motif="lotus" placement="care-lotus" opacity={.18} />
      <div className="gn-container">
        <SectionHeading id="gn-care-title">4. Hướng dẫn chăm sóc, vệ sinh, bảo quản sản phẩm</SectionHeading>
        <p className="gn-section-intro">Bình Giọt Ngọc mang vẻ đẹp trang nhã của nghệ thuật gốm Chu Đậu. Để giữ gìn dáng bình, lớp men và những họa tiết trang trí tinh tế, hãy chăm sóc sản phẩm theo những hướng dẫn dưới đây.</p>
        <div className="gn-card-grid">
          {careGuides.map((guide) => <div className="gn-card gn-care-card" key={guide.title}><div className="gn-care-card-title"><span className={`gn-icon-square${guide.iconSrc ? ' gn-icon-square--image' : ''}`} aria-hidden="true">{guide.iconSrc ? <img src={guide.iconSrc} alt="" width="28" height="28" loading="lazy" /> : <OrnamentIcon name={guide.icon} />}</span><h3>{guide.title}</h3></div><ul>{guide.items.map((item) => <li key={item}>{item}</li>)}</ul></div>)}
        </div>
        <p className="gn-closing">“Chăm sóc đúng cách là cách gìn giữ vẻ đẹp của Bình Giọt Ngọc và trân trọng tâm huyết của người nghệ nhân qua từng nét gốm.”</p>
        <div className="gn-signoff"><Link to="/" aria-label="TRO & LAM – Trang chủ"><img src="/images/logo/brand-160.webp" srcSet="/images/logo/brand-160.webp 160w, /images/logo/brand-320.webp 320w" sizes="128px" alt="Logo TRO & LAM" width="128" height="128" loading="lazy" /></Link><span>Gốm Chu Đậu · Văn hóa Việt</span></div>
      </div>
      <SectionWave />
    </section>
  </main>;
}
