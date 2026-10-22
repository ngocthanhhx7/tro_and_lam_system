import { useId, useState } from 'react';

export default function ProductDescription({ text }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const content = text || 'Thông tin mô tả đang được cập nhật.';
  const long = content.length > 220;
  return <div className="product-description">
    <p id={id} className={`product-detail__description${long && !expanded ? ' is-collapsed' : ''}`}>{content}</p>
    {long && <button type="button" className="product-description__toggle" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>{expanded ? 'Thu gọn mô tả' : 'Xem thêm mô tả'}</button>}
  </div>;
}
