import './decorative-motif.css';

const motifAssets = {
  craneClouds: '/assets/motifs/crane-clouds.webp',
  birdBlossoms: '/assets/motifs/bird-blossoms.webp',
  bamboo: '/assets/motifs/bamboo.webp',
  lotus: '/assets/motifs/lotus.webp',
  drum: '/assets/motifs/dong-son-drum.webp',
  pavilion: '/assets/motifs/lakeside-pavilion.webp',
  heritageGate: '/assets/motifs/heritage-gate.webp',
  swallowBlossoms: '/assets/motifs/swallow-blossoms.webp',
  riverLotus: '/assets/motifs/river-lotus.webp',
};

const breakpoints = { mobile: 0, tablet: 768, desktop: 1024, wide: 1400 };
const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// A decoration lives in existing whitespace; the source is not downloaded below its breakpoint.
export default function DecorativeMotif({ motif, placement, size, opacity = .12, breakpoint = 'desktop' }) {
  const src = motifAssets[motif];
  if (!src) return null;

  return <picture
    className={`decorative-motif decorative-motif--${placement} decorative-motif--${breakpoint}`}
    aria-hidden="true"
    style={{ '--motif-size': size, '--motif-opacity': opacity }}
  >
    <source
      media={`(min-width: ${breakpoints[breakpoint]}px)`}
      srcSet={`${src.replace('.webp', '-512.webp')} 512w, ${src} 1254w`}
      sizes={size || '160px'}
      type="image/webp"
    />
    <img src={transparentPixel} alt="" width="1254" height="1254" loading="lazy" decoding="async" fetchPriority="low" draggable="false" />
  </picture>;
}
