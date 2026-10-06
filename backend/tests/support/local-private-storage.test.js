import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalPrivateSupportStorage } from '../../src/support/local-private-storage.js';

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const KEY = 'support/123e4567-e89b-42d3-a456-426614174000';
const SECRET = 'local-only-test-secret-with-more-than-32-bytes';

async function withStorage(run, { now = () => 1_800_000_000_000 } = {}) {
  const storageDir = await mkdtemp(join(tmpdir(), 'tro-lam-support-private-'));
  const storage = createLocalPrivateSupportStorage({ storageDir, secret: SECRET, now });
  try { await run(storage); }
  finally { await rm(storageDir, { recursive: true, force: true }); }
}

test('private support storage accepts one signed bounded upload and issues short-lived private download URLs', async () => {
  await withStorage(async (storage) => {
    const upload = await storage.createUpload({
      storageKey: KEY, mimeType: 'image/png', bytes: PNG.length,
      expiresAt: new Date(1_800_000_060_000),
    });
    assert.match(upload.uploadUrl, /^\/api\/v1\/attachments\/private\/uploads\//u);
    assert.equal(upload.headers['Content-Type'], 'image/png');
    const uploadToken = upload.uploadUrl.split('/').at(-1);
    await storage.acceptUpload(uploadToken, PNG, 'image/png');
    await assert.rejects(storage.acceptUpload(uploadToken, PNG, 'image/png'), { status: 409, code: 'VERSION_CONFLICT' });
    assert.deepEqual(await storage.readPrivateObject(KEY), PNG);

    const downloadUrl = await storage.createDownload(KEY, { expiresInSeconds: 60 });
    assert.match(downloadUrl, /^\/api\/v1\/attachments\/private\/downloads\//u);
    const file = await storage.readDownload(downloadUrl.split('/').at(-1));
    assert.equal(file.mimeType, 'image/png');
    assert.deepEqual(file.buffer, PNG);
  });
});

test('private support storage rejects altered, expired, mismatched, and over-size upload capabilities', async () => {
  let clock = 1_800_000_000_000;
  await withStorage(async (storage) => {
    const upload = await storage.createUpload({
      storageKey: KEY, mimeType: 'image/png', bytes: PNG.length,
      expiresAt: new Date(1_800_000_060_000),
    });
    const token = upload.uploadUrl.split('/').at(-1);
    const altered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
    await assert.rejects(storage.acceptUpload(altered, PNG, 'image/png'), { status: 404, code: 'NOT_FOUND' });
    await assert.rejects(storage.acceptUpload(token, PNG, 'image/jpeg'), { status: 422, code: 'VALIDATION_ERROR' });
    await assert.rejects(storage.acceptUpload(token, Buffer.concat([PNG, Buffer.from([0])]), 'image/png'), { status: 422, code: 'VALIDATION_ERROR' });
  });

  await withStorage(async (storage) => {
    const upload = await storage.createUpload({
      storageKey: KEY, mimeType: 'image/png', bytes: PNG.length,
      expiresAt: new Date(1_800_000_000_001),
    });
    clock = 1_800_000_000_002;
    await assert.rejects(storage.acceptUpload(upload.uploadUrl.split('/').at(-1), PNG, 'image/png'), { status: 410, code: 'LINK_EXPIRED' });
  }, { now: () => clock });
});

test('private support storage never accepts unsafe keys or an invalid signing secret', async () => {
  assert.throws(() => createLocalPrivateSupportStorage({ storageDir: tmpdir(), secret: 'short' }), /32-byte/u);
  await assert.rejects(createLocalPrivateSupportStorage({ storageDir: tmpdir(), secret: SECRET }).createUpload({
    storageKey: 'support/../../public/image.png', mimeType: 'image/png', bytes: PNG.length,
    expiresAt: new Date(Date.now() + 60_000),
  }), /Invalid private attachment/u);
});
