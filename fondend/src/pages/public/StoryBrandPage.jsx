import { Link } from 'react-router-dom';
import Icon from '../../components/catalog/Icon.jsx';
import { HeritageFilm } from '../../components/catalog/EditorialMedia.jsx';
import './story-brand.css';

const storySteps = [
  { number: '01', title: 'NGUỒN GỐC', text: 'Nơi câu chuyện của sản phẩm bắt đầu.' },
  { number: '02', title: 'HOA VĂN', text: 'Những nét vẽ và ý nghĩa được gửi gắm.' },
  { number: '03', title: 'KỸ NGHỆ', text: 'Những chi tiết làm nên dáng gốm.' },
  { number: '04', title: 'CÂU CHUYỆN', text: 'Văn hóa được kể tiếp trong đời sống hôm nay.' },
];

const milestones = [
  { year: '2026', text: 'Hoàn thiện thương hiệu, các dòng Lifestyle và Diplomacy, cùng trải nghiệm NFC và AI Chatbot.' },
  { year: '2027–2028', text: 'Mở rộng sản phẩm, năng lực sản xuất, hệ thống phân phối và trải nghiệm công nghệ.' },
  { year: '2029–2030', text: 'Mở rộng thị trường quốc tế, đưa câu chuyện gốm Chu Đậu đến gần hơn với khách hàng ngoài Việt Nam.' },
];

const values = [
  { number: '01', name: 'QUALITY', vietnamese: 'Chất lượng', description: 'Chú trọng nguyên liệu, chế tác, hoàn thiện và đóng gói để mỗi chi tiết đều chỉn chu.' },
  { number: '02', name: 'HERITAGE', vietnamese: 'Di sản', description: 'Gốm Chu Đậu là nền tảng văn hóa; chất liệu, hoa văn và câu chuyện được gìn giữ trong nhịp sống hôm nay.' },
  { number: '03', name: 'INNOVATION', vietnamese: 'Đổi mới', description: 'Thiết kế và NFC mở rộng trải nghiệm, giúp người dùng khám phá câu chuyện phía sau mỗi món đồ.' },
  { number: '04', name: 'SUSTAINABILITY', vietnamese: 'Bền vững', description: 'Ưu tiên vật liệu tự nhiên như xơ mướp, vải và lụa, hướng tới trải nghiệm tiêu dùng có trách nhiệm.' },
  { number: '05', name: 'CONNECTION', vietnamese: 'Kết nối', description: 'Công nghệ trở thành cầu nối giữa hiện vật và câu chuyện văn hóa được lưu giữ trong gốm.' },
];

function StoryImage({ src, alt, className, caption, loading = 'lazy' }) {
  return <figure className={`story-brand__image ${className}`}>
    <img src={src} alt={alt} loading={loading} decoding="async" width="1024" height="1024" />
    {caption && <figcaption>{caption}</figcaption>}
  </figure>;
}

function MissionVision() {
  return <section className="story-brand__section story-brand__mission" aria-label="Sứ mệnh và tầm nhìn">
    <div className="story-brand__mission-image" aria-hidden="true">
      <img src="/assets/products/owner-provided/binh-phu-quy.webp" alt="" loading="lazy" decoding="async" />
    </div>
    <div className="story-brand__container">
      <div className="story-brand__mission-columns">
        <section aria-labelledby="story-mission-title">
          <p className="eyebrow">GÌN GIỮ VÀ PHÁT HUY</p>
          <h2 id="story-mission-title">Sứ mệnh</h2>
          <p>Tro &amp; Lam gìn giữ và phát huy giá trị gốm Chu Đậu qua những sản phẩm phù hợp với nhu cầu và phong cách sống hiện đại.</p>
          <p>Kỹ nghệ thủ công truyền thống gặp gỡ thiết kế, NFC và những lựa chọn bao bì thân thiện với môi trường, để mỗi lần trao tặng mở ra một trải nghiệm mới.</p>
        </section>
        <section aria-labelledby="story-vision-title">
          <p className="eyebrow">ĐƯỜNG DÀI PHÍA TRƯỚC</p>
          <h2 id="story-vision-title">Tầm nhìn</h2>
          <p>Tro &amp; Lam hướng tới trở thành thương hiệu gốm Chu Đậu mang bản sắc Việt, kết nối thủ công truyền thống, thiết kế đương đại và công nghệ hiện đại.</p>
          <ol className="story-brand__timeline">
            {milestones.map((milestone) => <li key={milestone.year}>
              <span>{milestone.year}</span>
              <p>{milestone.text}</p>
            </li>)}
          </ol>
        </section>
      </div>
    </div>
  </section>;
}

function CoreValues() {
  return <section className="story-brand__section story-brand__values" aria-labelledby="story-values-title">
    <div className="story-brand__container story-brand__values-layout">
      <div className="story-brand__values-intro">
        <p className="eyebrow">04 — GIÁ TRỊ CỐT LÕI</p>
        <h2 id="story-values-title">Những giá trị<br />chúng tôi gìn giữ.</h2>
        <StoryImage
          className="story-brand__values-image"
          src="/assets/products/owner-provided/binh-giot-ngoc-01.webp"
          alt="Bình Giọt Ngọc với họa tiết xanh lam, ảnh sản phẩm do chủ dự án cung cấp."
        />
      </div>
      <ol className="story-brand__value-list">
        {values.map((value) => <li key={value.number}>
          <span className="story-brand__value-number">{value.number}</span>
          <div className="story-brand__value-name"><h3>{value.name}</h3><span>{value.vietnamese}</span></div>
          <p>{value.description}</p>
          <span className="story-brand__value-arrow" aria-hidden="true">→</span>
        </li>)}
      </ol>
    </div>
  </section>;
}

export default function StoryBrandPage() {
  return <div className="story-brand">
    <section className="story-brand__hero" aria-labelledby="story-brand-title">
      <div className="story-brand__hero-grid">
        <div className="story-brand__hero-copy">
          <p className="eyebrow">CÂU CHUYỆN TRO &amp; LAM</p>
          <h1 id="story-brand-title">Từ đất Việt,<br />một câu chuyện<br />được kể bằng gốm.</h1>
          <p>Tro &amp; Lam được hình thành từ tình yêu với quê hương và mong muốn đưa giá trị của gốm Chu Đậu đến gần hơn với đời sống hiện đại.</p>
          <p>Phía sau mỗi nét men, hoa văn và dáng gốm là câu chuyện về đất, con người và văn hóa Việt Nam.</p>
        </div>
        <StoryImage
          className="story-brand__hero-image"
          src="/assets/products/owner-provided/hoa-lam-ty-ba-pair.webp"
          alt="Ảnh chung của bình Hoa Lam và Tỳ Bà với hoa văn lam, do chủ dự án cung cấp."
          loading="eager"
        />
      </div>
    </section>

    <section className="story-brand__section story-brand__origin" id="khoi-nguon" aria-labelledby="story-origin-title">
      <div className="story-brand__container story-brand__origin-grid">
        <StoryImage
          className="story-brand__origin-image"
          src="/assets/photography/chu-dau-heritage.jpg"
          alt="Hiện vật bình gốm hoa lam Chu Đậu thuộc Bảo tàng Lịch sử Việt Nam."
          caption="Hiện vật gốm Chu Đậu · Bảo tàng Lịch sử Việt Nam."
        />
        <div className="story-brand__origin-copy">
          <p className="eyebrow">01 — KHỞI NGUỒN</p>
          <h2 id="story-origin-title">Từ một miền đất,<br />đến một niềm tự hào.</h2>
          <p>Phong lớn lên ở Nam Sách, Hải Dương, trong những câu chuyện về quê hương và làng nghề gốm Chu Đậu. Càng tìm hiểu về gốm, anh càng nhận ra phía sau nét men, hoa văn và dáng gốm là những câu chuyện về đất, con người và kỹ nghệ thủ công.</p>
          <p>Từ niềm tự hào ấy, Tro &amp; Lam được hình thành với mong muốn để gốm Chu Đậu không chỉ được ngắm nhìn như một sản phẩm truyền thống, mà còn hiện diện trong đời sống hiện đại.</p>
          <blockquote>Một di sản chỉ thực sự sống khi nó tiếp tục được biết đến, được yêu thích và được kể lại bằng những cách mới.</blockquote>
        </div>
      </div>
    </section>

    <HeritageFilm />

    <section className="story-brand__section story-brand__philosophy" aria-labelledby="story-philosophy-title">
      <div className="story-brand__container story-brand__philosophy-grid">
        <div>
          <p className="eyebrow">02 — TRIẾT LÝ</p>
          <h2 id="story-philosophy-title">Đất Việt<br />trong từng nét gốm.</h2>
          <p className="story-brand__slogan">Tro &amp; Lam – Đất Việt trong từng nét gốm</p>
          <p className="story-brand__translation">Tro &amp; Lam – Vietnam in Every Ceramic Stroke</p>
        </div>
        <div className="story-brand__philosophy-copy">
          <p>“Đất Việt” là điểm khởi nguồn — vừa gợi chất liệu làm nên gốm, vừa đại diện cho bản sắc văn hóa Việt.</p>
          <p>“Từng nét gốm” là hình dáng, hoa văn, kỹ thuật chế tác và những câu chuyện được lưu giữ trong mỗi sản phẩm Chu Đậu.</p>
          <p>Tro &amp; Lam đưa những giá trị ấy vào sản phẩm có tính ứng dụng, thẩm mỹ và trải nghiệm đương đại.</p>
        </div>
      </div>
    </section>

    <section className="story-brand__section story-brand__today" aria-labelledby="story-today-title">
      <div className="story-brand__container">
       <div className="story-brand__today-grid">
        <div className="story-brand__today-copy">
          <p className="eyebrow">03 — TRO &amp; LAM HÔM NAY</p>
          <h2 id="story-today-title">Di sản,<br />được kể theo một cách mới.</h2>
          <p>Mỗi sản phẩm được trao đi không chỉ mang theo vẻ đẹp của gốm, mà còn mở ra câu chuyện về nguồn gốc, hoa văn, kỹ nghệ và những giá trị văn hóa phía sau nó.</p>
          <p>Chạm điện thoại vào sản phẩm để khám phá câu chuyện qua NFC; AI Chatbot đồng hành cùng hành trình tìm hiểu ấy. Bao bì với những vật liệu tự nhiên như xơ mướp, vải và lụa tiếp nối cảm giác thủ công từ khoảnh khắc mở quà.</p>
        </div>
        <StoryImage
          className="story-brand__today-image"
          src="/assets/products/owner-provided/hu-tra-chim-lac.webp"
          alt="Hũ trà gốm hoa văn chim lạc, ảnh sản phẩm do chủ dự án cung cấp."
        />
       </div>
       <ol className="story-brand__steps" aria-label="Những lớp chuyện có thể khám phá qua NFC">
         {storySteps.map((step) => <li key={step.number}>
           <span>{step.number}</span>
           <div><h3>{step.title}</h3><p>{step.text}</p></div>
         </li>)}
       </ol>
      </div>
    </section>

    <MissionVision />
    <CoreValues />

    <section className="story-brand__closing" aria-labelledby="story-closing-title">
      <img className="story-brand__closing-image" src="/assets/products/owner-provided/binh-thien-nga-02.webp" alt="" loading="lazy" decoding="async" />
      <div className="story-brand__closing-inner">
        <p className="eyebrow">TRO &amp; LAM · GỐM CHU ĐẬU</p>
        <h2 id="story-closing-title">Để di sản<br />tiếp tục được kể.</h2>
        <p>Tro &amp; Lam tin rằng một di sản chỉ thực sự sống khi nó tiếp tục được biết đến, được yêu thích và được kể lại bằng những cách mới.</p>
        <Link className="text-link" to="/san-pham">Khám phá sản phẩm <Icon name="arrow" size={18} /></Link>
      </div>
    </section>
  </div>;
}
