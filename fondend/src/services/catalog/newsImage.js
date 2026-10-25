import { responsiveImageProps } from './staticImage.js';
import { newsImageManifest } from './newsImageManifest.js';

export const newsImageSizes = Object.freeze({
  // The 390px-tall mobile cover crops a 3:2 photo, requiring at least 585px
  // of source width before DPR; using only its CSS width would soften it.
  feature: '(max-width: 639px) max(calc(100vw - 40px), 585px), (max-width: 880px) calc(100vw - 48px), (max-width: 1100px) calc((100vw - 74px) * .583333), (max-width: 1360px) calc((100vw - 118px) * .622642), 774px',
  spotlight: '(max-width: 639px) 88px, (max-width: 880px) calc((100vw - 88px) / 3), (max-width: 1100px) 88px, 112px',
  card: '(max-width: 639px) calc(100vw - 40px), (max-width: 880px) calc((100vw - 72px) / 2), (max-width: 1100px) calc((100vw - 104px) / 3), (max-width: 1360px) calc((100vw - 136px) / 3), 408px',
  related: '(min-width: 1000px) 88px, (max-width: 639px) calc(100vw - 40px), calc((100vw - 72px) / 2)',
  article: '(max-width: 639px) calc(100vw - 40px), (max-width: 999px) calc(100vw - 48px), (max-width: 1100px) calc(100vw - 400px), (max-width: 1360px) calc(100vw - 464px), 896px',
  inline: '(max-width: 639px) calc(100vw - 40px), (max-width: 848px) calc(100vw - 48px), (max-width: 999px) 800px, (max-width: 1100px) calc(100vw - 400px), (max-width: 1264px) calc(100vw - 464px), 800px',
  brand: '(max-width: 639px) calc(100vw - 40px), (max-width: 1100px) calc((100vw - 48px) * .428572), (max-width: 1360px) calc((100vw - 80px) * .428572), 549px',
});

export function newsImageProps(url, options) {
  const entry = Object.hasOwn(newsImageManifest, url) ? newsImageManifest[url] : null;
  return {
    ...responsiveImageProps(url, newsImageManifest, options),
    ...(entry ? { width: entry.width, height: entry.height } : {}),
  };
}
