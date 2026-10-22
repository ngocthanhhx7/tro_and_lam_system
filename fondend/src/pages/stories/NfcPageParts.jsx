import DecorativeMotif from '../../components/catalog/DecorativeMotif.jsx';

export function OrnamentIcon({ name }) {
  const paths = {
    leaf: <><path d="M12 3C3 8 4 16 12 21c8-5 9-13 0-18Z" /><path d="M12 7v14m-5-9 5 4 5-4" /></>,
    flower: <><circle cx="12" cy="12" r="3" /><path d="M12 3c5 0 1 6 0 6s-5-6 0-6Zm9 9c0 5-6 1-6 0s6-5 6 0Zm-9 9c-5 0-1-6 0-6s5 6 0 6ZM3 12c0-5 6-1 6 0s-6 5-6 0Z" /></>,
    lotus: <><path d="M12 3C8 8 7 13 12 19c5-6 4-11 0-16Z" /><path d="M8 10 3 8c0 8 3 12 9 13 6-1 9-5 9-13l-5 2M3 16l-2-1c1 5 5 7 11 6 6 1 10-1 11-6l-2 1" /></>,
    star: <path d="m12 2 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z" />,
    shield: <><path d="M12 3c3 2 5 3 9 3 1 8-2 13-9 16C5 19 2 14 3 6c4 0 6-1 9-3Z" /><path d="m8 12 3 3 5-6" /></>,
    warning: <><path d="M10 4 2 19c-.5 1 .2 2 1 2h18c1 0 1.5-1 1-2L14 4c-1-2-3-2-4 0ZM12 9v4m0 4h.01" /></>,
    nfc: <><path d="M2 8c5.5-5.5 14.5-5.5 20 0M5 12c4-4 10-4 14 0m-11 4c2-2 6-2 8 0" /><circle cx="12" cy="20" r=".6" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function SectionHeading({ id, children }) {
  return <h2 id={id} className="gn-section-heading">{children}</h2>;
}

export function NfcSectionNav({ prefix }) {
  const sections = [['story', 'Câu chuyện'], ['craft', 'Chế tác'], ['wishes', 'Ý nghĩa'], ['care', 'Chăm sóc']];
  return <nav className="gn-mobile-nav" aria-label="Chuyển nhanh giữa các phần">{sections.map(([section, label]) => <a href={`#${prefix}-${section}-title`} key={section}>{label}</a>)}</nav>;
}

export function PageMotif({ motif, placement, opacity = .14 }) {
  return <div className={`gn-ornament gn-ornament--${placement}`} aria-hidden="true">
    <DecorativeMotif motif={motif} placement="canvas" size="100%" sizes="(max-width: 560px) 180px, 340px" opacity={opacity} breakpoint="mobile" />
  </div>;
}

export function SectionWave({ tone = 'cream', reverse = false }) {
  const curve = 'M0 34 C150 108 280 4 470 38 S810 112 1000 56 S1130 10 1200 28';
  return <svg className={`gn-wave gn-wave--${tone}${reverse ? ' gn-wave--reverse' : ''}`} preserveAspectRatio="none" viewBox="0 0 1200 120" aria-hidden="true" focusable="false">
    <path d={`${curve} V120 H0 Z`} fill="var(--gn-gold)" />
    <path d={`${curve} V120 H0 Z`} fill="currentColor" transform="translate(0 7)" />
    <path d={curve} fill="none" stroke="var(--gn-gold-light)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" transform="translate(0 -8)" opacity=".8" />
  </svg>;
}

