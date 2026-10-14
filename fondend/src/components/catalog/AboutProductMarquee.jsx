import './about-product-marquee.css';

const products = [
  { src: '/assets/editorial/about-marquee/binh-giot-ngoc.webp', alt: 'Bình Giọt Ngọc trong không gian ánh vàng', label: 'Bình Giọt Ngọc' },
  { src: '/assets/editorial/about-marquee/binh-giot-ngoc-phuc.webp', alt: 'Bình gốm Giọt Ngọc khắc chữ Phúc trong không gian ánh vàng', label: 'Bình Giọt Ngọc chữ Phúc' },
  { src: '/assets/editorial/about-marquee/binh-hoa-lam.webp', alt: 'Bình Hoa Lam trong không gian ánh vàng', label: 'Bình Hoa Lam' },
  { src: '/assets/editorial/about-marquee/binh-ly-ngu-vong-nguyet.webp', alt: 'Bình Phú Quý khắc nổi Lý Ngư Vọng Nguyệt', label: 'Bình Lý Ngư Vọng Nguyệt' },
  { src: '/assets/editorial/about-marquee/binh-phu-quy.webp', alt: 'Bình Phú Quý trong không gian ánh vàng', label: 'Bình Phú Quý' },
  { src: '/assets/editorial/about-marquee/binh-phuong-hoang.webp', alt: 'Bình Phượng Hoàng trong không gian ánh vàng', label: 'Bình Phượng Hoàng' },
  { src: '/assets/editorial/about-marquee/binh-ty-ba.webp', alt: 'Bình Tỳ Bà trong không gian ánh vàng', label: 'Bình Tỳ Bà' },
  { src: '/assets/editorial/about-marquee/binh-thien-nga.webp', alt: 'Bình Thiên Nga trong không gian ánh vàng', label: 'Bình Thiên Nga' },
  { src: '/assets/editorial/about-marquee/dinnerware.webp', alt: 'Bộ đồ ăn gốm hoa lam trong không gian thưởng lãm lúc hoàng hôn', label: 'Bộ đồ ăn gốm' },
  { src: '/assets/editorial/about-marquee/tea-set.webp', alt: 'Bộ trà gốm hoa lam viền vàng trong không gian thưởng trà', label: 'Bộ trà hoa lam' },
  { src: '/assets/editorial/about-marquee/tea-set-evening.webp', alt: 'Bộ trà gốm trong không gian thưởng trà lúc hoàng hôn', label: 'Bộ trà gốm' },
  { src: '/assets/editorial/about-marquee/ceramic-plate.webp', alt: 'Đĩa gốm trang trí hoa lam trong không gian ánh vàng', label: 'Đĩa gốm' },
  { src: '/assets/editorial/about-marquee/tea-jar.webp', alt: 'Hộp trà gốm với họa tiết chim Lạc trong không gian ánh vàng', label: 'Hộp trà gốm' },
];

function ProductGroup({ decorative = false }) {
  return (
    <div className="about-product-marquee__group" aria-hidden={decorative || undefined}>
      {products.map((product) => (
        <figure className="about-product-marquee__card" key={product.src}>
          <img src={product.src} alt={decorative ? '' : product.alt} loading="lazy" decoding="async" />
          <figcaption>{product.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export default function AboutProductMarquee() {
  return (
    <section className="about-product-marquee atelier-section" aria-label="Bộ sưu tập sản phẩm TRO & LAM">
      <div className="about-product-marquee__viewport">
        <div className="about-product-marquee__track">
          <ProductGroup />
          <ProductGroup decorative />
        </div>
      </div>
    </section>
  );
}
