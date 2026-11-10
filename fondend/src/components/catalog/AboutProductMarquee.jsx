import './about-product-marquee.css';
import { ownerAboutProducts as products } from '../../constants/ownerProductPhotos.js';
import { staticImageProps } from '../../services/catalog/staticImage.js';

const marqueeProducts = [...products, products[0]];

function ProductGroup({ decorative = false }) {
  return (
    <div className="about-product-marquee__group" aria-hidden={decorative || undefined}>
      {marqueeProducts.map((product, index) => (
        <figure className="about-product-marquee__card" key={`${product.src}-${index}`}>
          <img {...staticImageProps(product.src, { width: 640, sizes: '(max-width: 640px) calc((100vw - 44px) / 2), (max-width: 1436px) 22vw, 316px' })} width={product.width} height={product.height} alt={decorative ? '' : product.alt} loading="lazy" />
          <figcaption>{product.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export default function AboutProductMarquee() {
  return (
    <section className="about-product-marquee atelier-section" aria-label="Bộ sưu tập sản phẩm TRO & LAM" style={{ '--about-marquee-steps': Math.ceil(marqueeProducts.length / 2), '--about-marquee-mobile-duration': `${Math.ceil(marqueeProducts.length / 2) * 4}s` }}>
      <div className="about-product-marquee__viewport">
        <div className="about-product-marquee__track">
          <ProductGroup />
          <ProductGroup decorative />
        </div>
      </div>
    </section>
  );
}
