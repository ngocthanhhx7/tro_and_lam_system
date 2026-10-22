import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { staticImageProps } from '../../fondend/src/services/catalog/staticImage.js';
import { staticImageManifest } from '../../fondend/src/services/catalog/staticImageManifest.js';
import { diplomacySlides, lifestyleSlides } from '../../fondend/src/constants/homepageSlides.js';

test('editorial images use allowlisted responsive files and preserve unknown image URLs', () => {
  const source = diplomacySlides[0].src;
  const props = staticImageProps(source, { width: 640, sizes: '72px' });
  assert.match(props.src, /^\/assets\/responsive\/v1\/[a-f\d]{16}\/640\.webp$/u);
  assert.match(props.srcSet, /320w, .*640w, .*960w/u);
  assert.equal(props.sizes, '72px');
  for (const url of ['/assets/unknown.webp', '/media/products/some-original.png', 'https://images.example.test/photo.jpg', '__proto__']) {
    assert.deepEqual(staticImageProps(url), { src: url, decoding: 'async' });
  }
  const image = { src: props.src, removed: [], removeAttribute(name) { this.removed.push(name); }, getAttribute() { return this.src; } };
  props.onError({ currentTarget: image });
  assert.equal(image.src, source);
  assert.deepEqual(image.removed, ['srcset']);
  props.onError({ currentTarget: image });
  assert.equal(image.src, source);
});

test('published editorial variants exist, match srcset widths, retain motif alpha and fit the transfer budget', async () => {
  let bytes = 0;
  const visited = new Set();
  for (const slide of [...lifestyleSlides, ...diplomacySlides]) {
    assert.ok(Object.hasOwn(staticImageManifest, slide.src), `Missing responsive home photo: ${slide.src}`);
  }
  for (const [source, entry] of Object.entries(staticImageManifest)) {
    assert.ok(entry.width > 0 && entry.height > 0);
    let previous = 0;
    for (const variant of entry.variants) {
      assert.ok(variant.width > previous && variant.width <= entry.width);
      previous = variant.width;
      assert.match(variant.url, /^\/assets\/responsive\/v1\/[a-f\d]{16}\/\d+\.webp$/u);
      const file = new URL(`../../fondend/public${variant.url}`, import.meta.url);
      const metadata = await sharp(await readFile(file)).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, variant.width);
      if (source.startsWith('/assets/motifs/')) assert.equal(metadata.hasAlpha, true);
      if (!visited.has(variant.url)) bytes += (await stat(file)).size;
      visited.add(variant.url);
    }
  }
  assert.ok(visited.size > 0);
  assert.ok(bytes <= 5 * 1024 * 1024, `Generated editorial images: ${bytes} bytes`);
});
