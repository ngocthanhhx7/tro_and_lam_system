const mediaImage = /^\/media\/products\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp))$/;
const widths = [160, 320, 640, 960, 1280];

export function productImageProps(url, { width = 640, sizes = '320px' } = {}) {
  const match = typeof url === 'string' && url.match(mediaImage);
  if (!match) return { src: url, decoding: 'async' };
  const path = size => `/media/products/thumbs/v1/${size}/${match[1]}`;
  return {
    src: path(width), srcSet: widths.map(size => `${path(size)} ${size}w`).join(', '), sizes, decoding: 'async',
    onError(event) {
      const image = event.currentTarget;
      image.removeAttribute('srcset');
      if (image.getAttribute('src') !== url) image.src = url;
    },
  };
}
