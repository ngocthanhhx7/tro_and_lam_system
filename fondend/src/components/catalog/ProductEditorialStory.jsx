function NumberedRows({ items }) {
  return <div className="product-narrative__rows">{items.map((item, index) => <div className="product-narrative__row" key={`${item.title}-${index}`}>
    <span>{String(index + 1).padStart(2, '0')}</span>
    <h3>{item.title}</h3>
    {item.body && <p>{item.body}</p>}
  </div>)}</div>;
}

function MaterialColumns({ items }) {
  return <div className="product-narrative__materials">{items.map((item, index) => <div key={`${item}-${index}`}>
    <span>{String(index + 1).padStart(2, '0')}</span>
    <p>{item}</p>
  </div>)}</div>;
}

function Specifications({ items }) {
  return <dl className="product-narrative__specs">{items.map((item) => <div key={item.label}>
    <dt>{item.label}</dt><dd>{item.value}</dd>
  </div>)}</dl>;
}

export default function ProductEditorialStory({ product }) {
  const motifItems = Array.isArray(product.motifs)
    ? product.motifs.map((motif) => ({ title: motif, body: '' }))
    : [];
  const meaningItems = [...(product.meanings || []), ...motifItems];
  let sectionNumber = 0;
  const nextNumber = () => String(++sectionNumber).padStart(2, '0');

  return <section className="product-narrative" id="product-story" aria-labelledby="product-narrative-title">
    <header className="product-narrative__intro">
      <p className="eyebrow">GÓC CÂU CHUYỆN</p>
      <h2 id="product-narrative-title">Câu chuyện phía sau<br />{product.name}</h2>
      <p>{product.description}</p>
    </header>

    {product.storyText && <section className="product-narrative__section">
      <p className="product-narrative__label"><span>{nextNumber()}</span> — CÂU CHUYỆN SẢN PHẨM</p>
      <p className="product-narrative__lead">{product.storyText}</p>
    </section>}

    {(product.craft || product.materials?.length || product.process?.length || product.fiveElements) && <section className="product-narrative__section">
      <p className="product-narrative__label"><span>{nextNumber()}</span> — KỸ NGHỆ &amp; CHẤT LIỆU</p>
      {product.craft && <p className="product-narrative__lead">{product.craft}</p>}
      {product.materials?.length > 0 && <MaterialColumns items={product.materials} />}
      {product.process?.length > 0 && <ol className="product-narrative__process">{product.process.map((step) => <li key={step}>{step}</li>)}</ol>}
      {product.fiveElements && <p className="product-narrative__note">{product.fiveElements}</p>}
    </section>}

    {(product.meaning || meaningItems.length > 0 || typeof product.motifs === 'string') && <section className="product-narrative__section">
      <p className="product-narrative__label"><span>{nextNumber()}</span> — HOA VĂN &amp; Ý NGHĨA</p>
      {product.meaning && <p className="product-narrative__lead">{product.meaning}</p>}
      {typeof product.motifs === 'string' && <p className="product-narrative__lead">{product.motifs}</p>}
      {meaningItems.length > 0 && <NumberedRows items={meaningItems} />}
    </section>}

    {product.message && <section className="product-narrative__section product-narrative__message">
      <p className="product-narrative__label"><span>{nextNumber()}</span> — THÔNG ĐIỆP</p>
      <blockquote>“{product.message}”</blockquote>
      {product.note && <p className="product-narrative__note">{product.note}</p>}
    </section>}

    {product.specifications?.length > 0 && <section className="product-narrative__section">
      <p className="product-narrative__label"><span>{nextNumber()}</span> — THÔNG SỐ</p>
      <Specifications items={product.specifications} />
    </section>}
  </section>;
}
