import test from 'node:test';
import assert from 'node:assert/strict';
import { productImageProps } from '../../fondend/src/services/catalog/productImage.js';

test('only owned uploaded image paths get responsive derivatives with original fallback', () => {
  const url = '/media/products/cc340a9f-950b-40b7-8713-fe5094ca8e0e.png';
  const props = productImageProps(url, { width: 160, sizes: '52px' });
  assert.equal(props.src, '/media/products/thumbs/v1/160/cc340a9f-950b-40b7-8713-fe5094ca8e0e.png');
  assert.equal(props.sizes, '52px');
  assert.match(props.srcSet, /640w/u);
  const element = { src: props.src, removeAttribute(name) { assert.equal(name, 'srcset'); }, getAttribute() { return this.src; } };
  props.onError({ currentTarget: element });
  assert.equal(element.src, url);
  for (const external of ['https://external.test/image.png', '/assets/owner/image.webp', '/media/products/../private.png']) {
    assert.equal(productImageProps(external).src, external);
    assert.equal(productImageProps(external).srcSet, undefined);
  }
});
