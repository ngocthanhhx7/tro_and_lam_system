import { useEffect, useRef, useState } from 'react';
import { productImageProps } from '../../services/catalog/productImage.js';
import Icon from './Icon.jsx';
import './product-image-zoom.css';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = points => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);

export default function ProductImageZoom({ image, productName }) {
  const frame = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const gesture = useRef({ type: 'mouse', x: 0, y: 0, moved: false });
  const [active, setActive] = useState(false);
  const [zoom, setZoom] = useState(2);
  const [frameWidth, setFrameWidth] = useState(0);
  const alt = image.alt || productName;
  useEffect(() => {
    const observer = new ResizeObserver(entries => setFrameWidth(Math.ceil(entries[0].contentRect.width)));
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);

  function focusAt(clientX, clientY) {
    const element = frame.current;
    const bounds = element.getBoundingClientRect();
    element.style.setProperty('--zoom-x', `${clamp((clientX - bounds.left) / bounds.width * 100, 0, 100)}%`);
    element.style.setProperty('--zoom-y', `${clamp((clientY - bounds.top) / bounds.height * 100, 0, 100)}%`);
  }
  function reset() { setActive(false); setZoom(2); pointers.current.clear(); pinch.current = null; }
  function pointerDown(event) {
    gesture.current = { type: event.pointerType, x: event.clientX, y: event.clientY, moved: false };
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (active && event.pointerType !== 'mouse') {
      event.currentTarget.setPointerCapture(event.pointerId);
      if (pointers.current.size === 2) {
        pinch.current = { distance: distance([...pointers.current.values()]), zoom };
        gesture.current.moved = true;
      }
    }
  }
  function pointerMove(event) {
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y) > 8) gesture.current.moved = true;
    if (!active) return;
    if (pinch.current && pointers.current.size === 2) {
      const points = [...pointers.current.values()];
      if (pinch.current.distance > 0) setZoom(clamp(pinch.current.zoom * distance(points) / pinch.current.distance, 1, 4));
      focusAt((points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2);
    } else if (event.pointerType === 'mouse' || pointers.current.has(event.pointerId)) focusAt(event.clientX, event.clientY);
  }
  function pointerEnd(event) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }
  function tap(event) {
    if (event.detail === 0) {
      frame.current.style.setProperty('--zoom-x', '50%');
      frame.current.style.setProperty('--zoom-y', '50%');
      setZoom(2); setActive(value => !value);
    } else if (gesture.current.type !== 'mouse' && !gesture.current.moved) {
      focusAt(event.clientX, event.clientY);
      setZoom(2); setActive(value => !value);
    }
  }

  return <div className={`product-image-zoom${active ? ' is-active' : ''}`}
    onPointerEnter={event => {
      if (event.pointerType === 'mouse') { focusAt(event.clientX, event.clientY); setZoom(2); setActive(true); }
    }}
    onPointerLeave={event => { if (event.pointerType === 'mouse') reset(); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) reset(); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); reset(); } }}>
    <button ref={frame} className="product-image-zoom__trigger" type="button" aria-label={`${active ? 'Thu nhỏ' : 'Phóng to'} ảnh ${alt}`} aria-pressed={active}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd}
      onPointerCancel={event => { gesture.current.moved = true; pointerEnd(event); }} onClick={tap}>
      <img {...productImageProps(image.url, { width: active ? 1280 : 960, sizes: frameWidth ? `${Math.ceil(frameWidth * (active ? zoom : 1))}px` : '(max-width: 820px) calc(100vw - 32px), 50vw' })} alt={alt} width="900" height="900" fetchPriority="high" draggable="false" style={{ transform: `scale(${active ? zoom : 1})` }} />
      {!active && <span className="product-image-zoom__hint"><Icon name="search" size={16} /><span className="product-image-zoom__mouse-hint">Rê chuột để xem chi tiết</span><span className="product-image-zoom__touch-hint">Chạm để phóng to</span></span>}
    </button>
    {active && <div className="product-image-zoom__controls" aria-label={`Điều chỉnh ảnh ${productName}`}>
      <button type="button" aria-label="Thu nhỏ ảnh" disabled={zoom <= 1} onClick={() => setZoom(value => clamp(value - .5, 1, 4))}>−</button>
      <output aria-live="polite">{Math.round(zoom * 100)}%</output>
      <button type="button" aria-label="Phóng to ảnh" disabled={zoom >= 4} onClick={() => setZoom(value => clamp(value + .5, 1, 4))}>+</button>
      <button type="button" aria-label="Kết thúc phóng to" onClick={reset}><Icon name="close" size={18} /></button>
    </div>}
  </div>;
}
