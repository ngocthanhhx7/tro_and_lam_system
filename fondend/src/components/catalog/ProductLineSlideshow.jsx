import { useEffect, useRef, useState } from 'react';
import './product-line-slideshow.css';

export default function ProductLineSlideshow({ slides, label }) {
  const slideCount = slides.length;
  const loopSlides = [...slides, slides[0]];
  const container = useRef(null);
  const [position, setPosition] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const activeSlide = position % slideCount;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyPreference = () => setReducedMotion(preference.matches);
    const applyVisibility = () => setVisible(document.visibilityState === 'visible');
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: .15 });
    observer.observe(container.current);
    preference.addEventListener('change', applyPreference);
    document.addEventListener('visibilitychange', applyVisibility);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', applyPreference);
      document.removeEventListener('visibilitychange', applyVisibility);
    };
  }, []);

  useEffect(() => {
    if (reducedMotion || !visible || !inView || hovered) return;
    const timer = window.setInterval(() => setPosition((current) => Math.min(current + 1, slideCount)), 4000);
    return () => window.clearInterval(timer);
  }, [visible, inView, hovered, reducedMotion, slideCount]);

  useEffect(() => {
    if (position !== slideCount) return;
    // Also reset if motion preferences change or the browser cancels the transition.
    const timer = window.setTimeout(() => setPosition((current) => current === slideCount ? 0 : current), 850);
    return () => window.clearTimeout(timer);
  }, [position, slideCount]);

  return <div
    ref={container}
    className="collection-story__image product-line-slideshow"
    role="region"
    aria-roledescription="trình chiếu ảnh"
    aria-label={`Ảnh dòng sản phẩm ${label}`}
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true); }}
    onPointerLeave={() => setHovered(false)}
  >
    <div
      className="product-line-slideshow__track"
      style={{ transform: `translateX(-${position * 100}%)`, transition: position === 0 || reducedMotion ? 'none' : undefined }}
      onTransitionEnd={(event) => { if (event.target === event.currentTarget && position === slideCount) setPosition(0); }}
    >
      {loopSlides.map((slide, index) => <div className="product-line-slideshow__slide" key={`${slide.src}-${index}`} role="group" aria-roledescription="ảnh" aria-label={`${index + 1} / ${slideCount}`} aria-hidden={index !== activeSlide}>
        <img src={slide.src} alt={index === slideCount ? '' : slide.alt} width="1122" height="1402" loading={index === slideCount || (inView && index === activeSlide + 1) ? 'eager' : 'lazy'} decoding="async" fetchPriority="low" draggable="false" />
      </div>)}
    </div>
  </div>;
}
