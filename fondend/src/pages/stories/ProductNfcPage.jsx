import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { setPageMetadata } from '../../utils/pageMetadata.js';
import { NfcSectionNav, OrnamentIcon, PageMotif, SectionHeading, SectionWave } from './NfcPageParts.jsx';
import { nfcProductStories, nfcWishImagery, parseNfcCare } from './nfcProductStories.js';
import './binh-giot-ngoc.css';
import './product-nfc.css';

function StoryParagraphs({ lines, dropCap = false }) {
  return lines.map((line, index) => {
    const source = line.match(/^\[.*\]\((https:\/\/chudauceramic\.vn\/[^)]+)\)$/u);
    if (source) {
      const url = new URL(source[1]);
      url.searchParams.delete('utm_source');
      return <p className="nfc-source" key={line}><a href={url.href} target="_blank" rel="noreferrer">Nguồn: Gốm Chu Đậu</a></p>;
    }
    const isHeading = line.length < 100 && !/[.:]$/u.test(line) && !/^-/u.test(line);
    if (isHeading) return <h3 className="nfc-prose-heading" key={line}>{line}</h3>;
    return <p className={dropCap && index === 0 ? 'gn-drop-cap' : undefined} key={line}>{line.replace(/^-\s*/u, '')}</p>;
  });
}

function StoryEntry({ entry, product, index }) {
  const isPair = product.entries.length > 1;
  const detailImage = product.entryImages[index];
  return <div className="nfc-story-entry">
    {isPair && <h3 className="nfc-entry-title">{entry.name}</h3>}
    <div className="gn-story-grid">
      <div className="gn-story-copy">
        <StoryParagraphs lines={entry.story.slice(0, 2)} dropCap />
        <div className="gn-symbol-note"><p>{isPair ? product.motifs[index][0].text : product.note}</p></div>
      </div>
      <figure className="gn-detail-photo">
        <img src={detailImage} alt={`Chi tiết hoa văn ${entry.name}`} loading="lazy" decoding="async" />
        <figcaption>{product.imageCaption || `Chi tiết họa tiết ${entry.name}`}</figcaption>
      </figure>
      <div className="gn-motifs"><h3>Họa tiết biểu tượng</h3>
        {product.motifs[index].map((motif) => <div className="gn-motif" key={motif.title}><span className="gn-icon-round"><OrnamentIcon name={motif.icon} /></span><div><h4>{motif.title}</h4><p>{motif.text}</p></div></div>)}
      </div>
    </div>
    <div className="nfc-prose nfc-story-continuation"><StoryParagraphs lines={entry.story.slice(2)} /></div>
  </div>;
}

function CareCards({ entries }) {
  const guides = [
    { title: 'Vệ sinh sản phẩm', image: '/assets/nfc/binh-giot-ngoc/cleaning.png' },
    { title: 'Bảo quản sản phẩm', icon: 'shield' },
    { title: 'Lưu ý khi sử dụng', icon: 'warning' },
    { title: 'Lưu ý đối với chip NFC', icon: 'nfc' },
  ];
  return <div className="gn-card-grid">
    {guides.map((guide, groupIndex) => <div className="gn-card gn-care-card" key={guide.title}>
      <div className="gn-care-card-title"><span className={`gn-icon-square${guide.image ? ' gn-icon-square--image' : ''}`} aria-hidden="true">{guide.image ? <img src={guide.image} alt="" width="28" height="28" loading="lazy" /> : <OrnamentIcon name={guide.icon} />}</span><h3>{guide.title}</h3></div>
      {entries.map((entry) => <div className="nfc-care-entry" key={entry.name}>{entries.length > 1 && <h4>{entry.name}</h4>}<ul>{entry.care.groups[groupIndex].map((line) => <li key={line}>{line}</li>)}</ul></div>)}
    </div>)}
  </div>;
}

export default function ProductNfcPage({ productId }) {
  const product = nfcProductStories[productId];
  const [selectedImage, setSelectedImage] = useState(0);
  const selected = product.images[selectedImage];
  const careEntries = product.entries.map((entry) => ({ name: entry.name, care: parseNfcCare(entry.care) }));
  const craftSteps = [
    { title: 'Chọn đất', src: '/assets/video/tro-lam-banner-poster.jpg', alt: 'Người thợ chuẩn bị và tạo hình đất gốm' },
    { title: 'Tạo hình', src: '/assets/photography/pottery-hands.jpg', alt: 'Đôi bàn tay tạo hình gốm trên bàn xoay' },
    { title: 'Vẽ họa tiết', src: product.entryImages[0], alt: `Chi tiết họa tiết ${product.name}` },
    { title: 'Hoàn thiện', src: product.images[0].src, alt: `${product.name} hoàn thiện` },
  ];

  useEffect(() => {
    setPageMetadata({ title: `${product.name} - Gốm Chu Đậu | TRO & LAM`, description: product.intro });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [product]);

  return <main className="giot-ngoc-page nfc-product-page" id="main-content">
    <section className="gn-hero" aria-labelledby="nfc-product-title">
      <img className="gn-hero-lotus" src="/assets/motifs/lotus-512.webp" alt="" aria-hidden="true" />
      <PageMotif motif="craneClouds" placement="hero-crane" opacity={.17} />
      <div className="gn-container gn-hero-grid">
        <div className="gn-hero-copy">
          <div className="gn-title-row"><div><p className="gn-eyebrow">Tinh hoa di sản gốm Việt</p><h1 id="nfc-product-title">{product.titlePrefix || 'BÌNH'}<br /><span>{product.titleLines.map((line, index) => <Fragment key={line}>{index > 0 && <br />}{line}</Fragment>)}</span></h1></div><span className="gn-seal" aria-label="Chu Đậu">CHU ĐẬU</span></div>
          <p className="gn-subtitle">{product.subtitle}</p>
          <p className="gn-hero-intro">{product.intro}</p>
          <div className="gn-gallery"><p className="gn-eyebrow" id="nfc-gallery-label">Góc nhìn tuyệt tác</p><div className="gn-thumbnails" role="group" aria-labelledby="nfc-gallery-label">
            {product.images.map((image, index) => <button type="button" key={image.src} className={`gn-thumbnail${selectedImage === index ? ' is-active' : ''}`} aria-pressed={selectedImage === index} aria-label={`Xem ${product.name} – ${image.label}`} aria-controls="nfc-hero-image" onClick={() => setSelectedImage(index)}><img src={image.src} alt="" width="80" height="80" /></button>)}
          </div><p className="gn-image-label" aria-live="polite">{selected.label}</p></div>
          {product.productLinks.length > 0 && <nav className="nfc-product-links" aria-label="Sản phẩm liên quan">{product.productLinks.map((link) => <Link to={`/san-pham/${link.slug}`} key={link.slug}>{link.label}</Link>)}</nav>}
        </div>
        <div className="gn-hero-visual"><div className="gn-vase-frame" style={{ backgroundColor: product.frameBackground || '#fff' }}><img key={selected.src} id="nfc-hero-image" src={selected.src} alt={selected.alt} style={{ objectFit: product.imageFit || (selected.src.endsWith('vrg-02.jpg') ? 'contain' : 'cover') }} fetchPriority="high" /></div><div className="gn-pedestal" aria-hidden="true" /></div>
      </div><SectionWave />
    </section>

    <NfcSectionNav prefix="nfc" />
    <section className="gn-section gn-pattern" aria-labelledby="nfc-story-title">
      <PageMotif motif="bamboo" placement="story-bamboo" /><PageMotif motif="birdBlossoms" placement="story-blossoms" opacity={.18} />
      <div className="gn-container"><SectionHeading id="nfc-story-title">1. Câu chuyện sản phẩm</SectionHeading>
        {product.entries.map((entry, index) => <StoryEntry key={entry.name} entry={entry} index={index} product={product} />)}
        {product.pairNote && <blockquote className="nfc-pair-note">{product.pairNote}</blockquote>}
        {product.imageSource && <p className="nfc-source"><a href={product.imageSource} target="_blank" rel="noreferrer">Ảnh phiên bản VRG: Gốm Chu Đậu</a></p>}
      </div><SectionWave tone="navy" reverse />
    </section>

    <section className="gn-section gn-craft" aria-labelledby="nfc-craft-title">
      <PageMotif motif="craneClouds" placement="craft-crane" opacity={.2} />
      <div className="gn-container"><SectionHeading id="nfc-craft-title">2. Hành trình chế tác</SectionHeading>
        <div className="nfc-narratives">{product.entries.map((entry) => <div className="nfc-prose" key={entry.name}>{product.entries.length > 1 && <h3 className="nfc-entry-title">{entry.name}</h3>}<StoryParagraphs lines={entry.craft} /></div>)}</div>
        <ol className="gn-craft-grid">{craftSteps.map((step, index) => <li className="gn-craft-step" key={step.title}><div className="gn-craft-photo"><img src={step.src} alt={step.alt} loading="lazy" /><span>{String(index + 1).padStart(2, '0')}</span></div><h3>{step.title}</h3></li>)}</ol>
        <p className="gn-media-note">Ảnh tư liệu nghề gốm và ảnh sản phẩm minh họa. <Link to="/nguon-tu-lieu">Nguồn hình ảnh &amp; phim</Link>{product.imageSource && <> · <a href={product.imageSource} target="_blank" rel="noreferrer">Ảnh phiên bản VRG</a></>}</p>
      </div><SectionWave />
    </section>

    <section className="gn-section gn-pattern" aria-labelledby="nfc-wishes-title">
      <PageMotif motif="swallowBlossoms" placement="wishes-blossoms" opacity={.12} /><PageMotif motif="drum" placement="wishes-drum" opacity={.12} /><PageMotif motif="riverLotus" placement="wishes-river" opacity={.16} />
      <div className="gn-container"><SectionHeading id="nfc-wishes-title">3. Ý nghĩa và lời chúc</SectionHeading>
        <div className="nfc-narratives">{product.entries.map((entry) => <div className="nfc-prose" key={entry.name}>{product.entries.length > 1 && <h3 className="nfc-entry-title">{entry.name}</h3>}<StoryParagraphs lines={entry.wishes} /></div>)}</div>
        <div className="gn-card-grid gn-wishes">{nfcWishImagery.map((image, index) => <div className="gn-card gn-wish" key={image.src}><img className="gn-wish-photo" src={image.src} alt={image.alt} loading="lazy" /><div className="gn-wish-copy"><h3>{product.wishTitles[index]}</h3><p>{product.wishTexts[index]}</p></div></div>)}</div>
      </div><SectionWave tone="navy" reverse />
    </section>

    <section className="gn-section gn-care" aria-labelledby="nfc-care-title">
      <PageMotif motif="bamboo" placement="care-bamboo" opacity={.12} /><PageMotif motif="lotus" placement="care-lotus" opacity={.18} />
      <div className="gn-container"><SectionHeading id="nfc-care-title">4. Hướng dẫn chăm sóc, vệ sinh, bảo quản sản phẩm</SectionHeading>
        {careEntries.some((entry) => entry.care.intro.length > 0) && <div className="nfc-narratives">{careEntries.map((entry) => <div className="nfc-prose" key={entry.name}>{product.entries.length > 1 && entry.care.intro.length > 0 && <h3 className="nfc-entry-title">{entry.name}</h3>}<StoryParagraphs lines={entry.care.intro} /></div>)}</div>}
        <CareCards entries={careEntries} />
        {careEntries.some((entry) => entry.care.closing.length > 0) && <div className="gn-closing">{careEntries.flatMap((entry) => entry.care.closing).map((line) => <p key={line}>{line}</p>)}</div>}
        <div className="gn-signoff"><Link to="/" aria-label="TRO & LAM – Trang chủ"><img src="/images/logo/brand-160.webp" srcSet="/images/logo/brand-160.webp 160w, /images/logo/brand-320.webp 320w" sizes="128px" alt="Logo TRO & LAM" width="128" height="128" loading="lazy" /></Link><span>Gốm Chu Đậu · Văn hóa Việt</span></div>
      </div><SectionWave />
    </section>
  </main>;
}
