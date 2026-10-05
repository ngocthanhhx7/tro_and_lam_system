import { productLines } from '../constants/brand.js';

export default function HomePage() {
  return <>
    <section className="intro"><p className="eyebrow">TRO & LAM</p><h1>Gốm Chu Đậu trong đời sống đương đại.</h1><p>Kết nối nghề thủ công truyền thống, thiết kế đương đại và câu chuyện văn hóa qua NFC Storytelling.</p></section>
    <section aria-label="Hai dòng sản phẩm" className="lines">{productLines.map((line) => <article key={line.name}><h2>{line.name}</h2><p>{line.description}</p></article>)}</section>
    <p className="notice">Website đang trong giai đoạn xây dựng. Danh mục sản phẩm và kênh tư vấn sẽ được cập nhật trong các giai đoạn tiếp theo.</p>
  </>;
}
