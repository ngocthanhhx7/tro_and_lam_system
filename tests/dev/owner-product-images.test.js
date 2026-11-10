import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import sharp from 'sharp';
import { ownerProductImageManifest } from '../../fondend/src/services/catalog/ownerProductImageManifest.js';
import { ownerLifestyleSlides, ownerDiplomacySlides, ownerAboutProducts } from '../../fondend/src/constants/ownerProductPhotos.js';
import { staticImageProps } from '../../fondend/src/services/catalog/staticImage.js';

test('owner-provided home and about photos are complete, responsive and bounded', async () => {
  assert.equal(ownerLifestyleSlides.length, 3);
  assert.equal(ownerDiplomacySlides.length, 5);
  assert.equal(ownerAboutProducts.length, 9);
  const photos = [...ownerLifestyleSlides, ...ownerDiplomacySlides, ...ownerAboutProducts];
  assert.equal(new Set(photos.map(photo => photo.src)).size, 17);
  let bytes = 0;
  for (const photo of photos) {
    const entry = ownerProductImageManifest[photo.src];
    assert(entry);
    assert.equal(photo.width, entry.width);
    assert.equal(photo.height, entry.height);
    assert.deepEqual(entry.variants.map(row => row.width), [160, 320, 640, 960, 1280, 1600]);
    assert.match(staticImageProps(photo.src).src, /\/640\.webp$/u);
    for (const variant of entry.variants) {
      const file = new URL(`../../fondend/public${variant.url}`, import.meta.url);
      const metadata = await sharp(await readFile(file)).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, variant.width);
      assert(Math.abs(metadata.width / metadata.height - photo.width / photo.height) < 0.01);
      assert.equal(metadata.exif, undefined);
      assert.equal(metadata.xmp, undefined);
      bytes += (await stat(file)).size;
    }
  }
  assert(bytes <= 12 * 1024 * 1024, `Owner photo derivatives exceed budget: ${bytes}`);
});
