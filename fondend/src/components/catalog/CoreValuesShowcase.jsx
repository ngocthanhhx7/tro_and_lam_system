import { useState } from 'react';
import Icon from './Icon.jsx';
import './core-values-showcase.css';

const valueImages = [
  { src: '/assets/editorial/diplomacy-slides/binh-giot-ngoc.webp', alt: 'Bình Giọt Ngọc hoa lam trong không gian ánh vàng.' },
  { src: '/assets/editorial/diplomacy-slides/binh-thien-nga.webp', alt: 'Bình Thiên Nga gốm Chu Đậu trong không gian ánh vàng.' },
  { src: '/assets/editorial/lifestyle-slides/tea-jar.webp', alt: 'Hộp trà gốm hoa văn chim Lạc trong không gian ánh vàng.' },
  { src: '/assets/editorial/lifestyle-slides/dinnerware.webp', alt: 'Bộ đồ ăn gốm hoa lam trong không gian ánh vàng.' },
  { src: '/assets/editorial/story/binh-giot-ngoc-phuc.webp', alt: 'Bình Giọt Ngọc trang trí chữ Phúc trong không gian ánh vàng.' },
];

export default function CoreValuesShowcase({ values }) {
  const [selected, setSelected] = useState(0);
  const active = values[selected];
  const image = valueImages[selected];

  return <section className="story-brand__section story-brand__values" aria-labelledby="story-values-title">
    <div className="story-brand__container core-values">
      <header className="core-values__header">
        <p className="eyebrow">04 — GIÁ TRỊ CỐT LÕI</p>
        <h2 id="story-values-title" className="core-values__title">Những giá trị <span>chúng tôi gìn giữ.</span></h2>
      </header>
      <div className="core-values__layout">
        <ol className="core-values__choices" aria-label="Năm giá trị cốt lõi">
          {values.map((value, index) => <li key={value.number}>
            <button
              type="button"
              className={`core-values__choice${selected === index ? ' core-values__choice--active' : ''}`}
              aria-label={`Xem giá trị ${value.vietnamese}`}
              aria-pressed={selected === index}
              aria-controls="story-value-detail"
              onClick={() => setSelected(index)}
            >
              <span className="core-values__number">{value.number}</span>
              <img className="core-values__thumbnail" src={valueImages[index].src} alt="" width="1122" height="1402" loading="lazy" decoding="async" />
              <span className="core-values__choice-copy">
                <strong>{value.vietnamese}</strong>
                <span>{value.name}</span>
              </span>
              <span className="core-values__arrow"><Icon name="arrow" size={18} /></span>
            </button>
          </li>)}
        </ol>
        <article className="core-values__detail" id="story-value-detail" aria-labelledby="story-value-detail-title" aria-live="polite" aria-atomic="true">
          <img key={image.src} className="core-values__detail-image" src={image.src} alt={image.alt} width="1122" height="1402" decoding="async" />
          <div className="core-values__shade" aria-hidden="true" />
          <div key={active.number} className="core-values__caption">
            <span className="core-values__english">{active.name}</span>
            <div className="core-values__detail-heading">
              <h3 id="story-value-detail-title">{active.vietnamese}</h3>
              <span aria-hidden="true">{active.number}</span>
            </div>
            <p className="core-values__description">{active.description}</p>
          </div>
        </article>
      </div>
    </div>
  </section>;
}
