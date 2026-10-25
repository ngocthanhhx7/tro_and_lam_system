import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { newsImageProps, newsImageSizes } from '../../fondend/src/services/catalog/newsImage.js';
import { newsImageManifest } from '../../fondend/src/services/catalog/newsImageManifest.js';

test('every published news photo has bounded responsive derivatives and correct intrinsic dimensions', async () => {
  const provided = JSON.parse(await readFile(new URL('../../fondend/src/pages/news/providedNewsArticles.json', import.meta.url), 'utf8'));
  const legacy = await readFile(new URL('../../fondend/src/pages/news/newsData.js', import.meta.url), 'utf8');
  const sources = new Set([
    ...provided.flatMap(article => [article.image, ...article.sections.flatMap(section => section.image ? [section.image.src] : [])]),
    ...[...legacy.matchAll(/image: '([^']+)'/gu)].map(match => match[1]),
    '/assets/editorial/diplomacy-slides/binh-giot-ngoc.webp',
  ]);
  let bytes = 0;
  const files = new Set();
  for (const source of sources) {
    const entry = newsImageManifest[source];
    assert.ok(entry, `Missing news image: ${source}`);
    const original = await sharp(await readFile(new URL(`../../fondend/public${source}`, import.meta.url))).metadata();
    assert.equal(entry.width, original.width);
    assert.equal(entry.height, original.height);
    let previous = 0;
    for (const variant of entry.variants) {
      assert.ok(variant.width > previous && variant.width <= original.width);
      previous = variant.width;
      assert.match(variant.url, /^\/assets\/responsive\/v1\/[a-f\d]{16}\/\d+\.webp$/u);
      const file = new URL(`../../fondend/public${variant.url}`, import.meta.url);
      const metadata = await sharp(await readFile(file)).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, variant.width);
      assert.ok(Math.abs(metadata.height - original.height * variant.width / original.width) <= 1);
      if (!files.has(variant.url)) bytes += (await stat(file)).size;
      files.add(variant.url);
    }
  }
  assert.ok(files.size > sources.size);
  assert.ok(bytes <= 8 * 1024 * 1024, `News derivatives disk budget: ${bytes}`);
});

test('news image fallback retains the original and dimensions without retrying srcset', () => {
  const source = '/assets/news/ikebana-hoa-2026.jpg';
  const props = newsImageProps(source, { width: 320, sizes: newsImageSizes.spotlight });
  assert.match(props.src, /\/320\.webp$/u);
  assert.ok(props.srcSet.includes('160w'));
  assert.equal(props.sizes, newsImageSizes.spotlight);
  assert.equal(props.width, newsImageManifest[source].width);
  const image = { src: props.src, srcset: props.srcSet, removeAttribute(name) { delete this[name]; }, getAttribute() { return this.src; } };
  props.onError({ currentTarget: image });
  assert.equal(image.src, source);
  assert.equal(image.srcset, undefined);
  props.onError({ currentTarget: image });
  assert.equal(image.src, source);
  assert.deepEqual(newsImageProps('__proto__'), { src: '__proto__', decoding: 'async' });
});
