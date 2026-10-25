import { staticImageManifest } from './staticImageManifest.js';

// Only files generated from the allowlist receive a srcset. External/dynamic
// image URLs keep their existing behavior and are never rewritten by this helper.
export function staticImageProps(url, { width = 640, sizes = '(max-width: 639px) calc(100vw - 32px), 50vw' } = {}) {
  return responsiveImageProps(url, staticImageManifest, { width, sizes });
}

export function responsiveImageProps(url, manifest, { width = 640, sizes } = {}) {
  const entry = Object.hasOwn(manifest, url) ? manifest[url] : null;
  if (!entry) return { src: url, decoding: 'async' };
  const selected = entry.variants.find(variant => variant.width >= width) || entry.variants.at(-1);
  return {
    src: selected.url,
    srcSet: entry.variants.map(variant => `${variant.url} ${variant.width}w`).join(', '),
    sizes,
    decoding: 'async',
    onError(event) {
      const image = event.currentTarget;
      image.removeAttribute('srcset');
      if (image.getAttribute('src') !== url) image.src = url;
    },
  };
}
