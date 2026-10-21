import './decorative-motif.css';
import { staticImageProps } from '../../services/catalog/staticImage.js';

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
export default function DecorativeMotif({ motif, placement, size, sizes, opacity = .12, breakpoint = 'desktop' }) {
  const src = motifAssets[motif];
  if (!src) return null;
  // A percentage is valid for CSS width, but not for the HTML sizes attribute.
  const image = staticImageProps(src, { width: 512, sizes: sizes || (size && !size.includes('%') ? size : '(max-width: 639px) 75vw, (max-width: 1023px) 50vw, 640px') });

  return <picture
    className={`decorative-motif decorative-motif--${placement} decorative-motif--${breakpoint}`}
    aria-hidden="true"
    style={{ '--motif-size': size, '--motif-opacity': opacity }}
  >
    <source
      media={`(min-width: ${breakpoints[breakpoint]}px)`}
      srcSet={image.srcSet || image.src}
      sizes={image.sizes}
      type="image/webp"
    />
    <img src={transparentPixel} alt="" width="1254" height="1254" loading="lazy" decoding="async" fetchPriority="low" draggable="false"
      onError={(event) => {
        const target = event.currentTarget;
        const source = target.parentElement?.querySelector('source');
        // Removing the source first prevents picture selection from retrying a
        // failed derivative. The absent srcset also makes this fallback one-shot.
        if (!source?.hasAttribute('srcset')) return;
        source.removeAttribute('srcset');
        // A resize may have hidden the motif while its request was in flight.
        if (window.matchMedia(source.media).matches && target.getAttribute('src') !== src) target.src = src;
      }} />
  </picture>;
}
