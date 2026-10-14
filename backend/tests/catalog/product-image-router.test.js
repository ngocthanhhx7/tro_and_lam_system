import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createLocalMediaProvider } from '../../src/services/catalog/media-provider.js';

test('responsive images preserve originals, generate once, persist across restart and restrict paths', async t => {
  const storageDir = await mkdtemp(join(tmpdir(), 'tro-lam-thumbnails-'));
  t.after(() => rm(storageDir, { recursive: true, force: true }));
  const original = await sharp({ create: { width: 1122, height: 1402, channels: 3, background: '#123f56' } }).png().toBuffer();
  const provider = createLocalMediaProvider({ storageDir, publicBaseUrl: '/media/products' });
  const stored = await provider.upload({ buffer: original, mimeType: 'image/png' });
  const path = `/media/products/thumbs/v1/320/${stored.storageKey}`;
  const app = createApp({ mediaStaticDirectory: storageDir });
  const responses = await Promise.all(Array.from({ length: 8 }, () => request(app).get(path).expect(200)));
  for (const response of responses) {
    const metadata = await sharp(response.body).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 320);
    assert.ok(Math.abs(metadata.height / metadata.width - 1402 / 1122) < .01);
    assert.match(response.headers['cache-control'], /immutable/u);
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
  }
  assert.deepEqual(await readFile(join(storageDir, stored.storageKey)), original);
  assert.deepEqual(await readdir(join(storageDir, 'thumbs', 'v1', '320')), [`${stored.storageKey}.webp`]);
  const restarted = createApp({ mediaStaticDirectory: storageDir });
  assert.deepEqual((await request(restarted).get(path).expect(200)).body, responses[0].body);
  await request(app).get(path.replace('/320/', '/123/')).expect(404);
  await request(app).get('/media/products/thumbs/v1/320/.env').expect(404);
  await request(app).get(path.replace(stored.storageKey, '00000000-0000-0000-0000-000000000000.png')).expect(404);
  await provider.remove(stored.storageKey);
  await request(app).get(path).expect(404);
});
