import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createLocalMediaProvider } from '../../src/services/catalog/media-provider.js';

test('local media provider stores an image under an opaque key and serves then removes it', async (t) => {
  const storageDir = await mkdtemp(join(tmpdir(), 'tro-lam-media-'));
  t.after(() => rm(storageDir, { recursive: true, force: true }));
  const provider = createLocalMediaProvider({
    storageDir,
    publicBaseUrl: '/media/products/',
  });
  const buffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2]);
  const stored = await provider.upload({ buffer, mimeType: 'image/png' });

  assert.match(stored.storageKey, /^[0-9a-f-]{36}\.png$/u);
  assert.equal(stored.publicUrl, `/media/products/${stored.storageKey}`);
  assert.deepEqual(await readdir(storageDir), [stored.storageKey]);

  const app = createApp({ mediaStaticDirectory: storageDir });
  const response = await request(app).get(stored.publicUrl);
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /^image\/png/u);
  assert.deepEqual(response.body, buffer);

  await provider.remove('../outside.png');
  await provider.remove(stored.storageKey);
  assert.deepEqual(await readdir(storageDir), []);
  assert.equal((await request(app).get(stored.publicUrl)).status, 404);
});

test('local media provider rejects unsupported MIME types before writing files', async (t) => {
  const storageDir = await mkdtemp(join(tmpdir(), 'tro-lam-media-'));
  t.after(() => rm(storageDir, { recursive: true, force: true }));
  const provider = createLocalMediaProvider({ storageDir, publicBaseUrl: '/media/products' });
  await assert.rejects(provider.upload({ buffer: Buffer.from('text'), mimeType: 'text/plain' }), /Unsupported media file/u);
  assert.deepEqual(await readdir(storageDir), []);
});
