import { Router } from 'express';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

export const IMAGE_WIDTHS = [160, 320, 640, 960, 1280];
const IMAGE_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp)$/u;

export function createProductImageRouter(storageDir) {
  const router = Router();
  const pending = new Map();
  let active = 0;
  const waiting = [];
  async function generate(source, destination, width) {
    if (active >= 2) await new Promise(resolve => waiting.push(resolve));
    active += 1;
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      await mkdir(join(storageDir, 'thumbs', 'v1', String(width)), { recursive: true });
      await sharp(source, { limitInputPixels: 24_000_000, failOn: 'warning' })
        .rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toFile(temporary);
      await rename(temporary, destination);
    } finally {
      await unlink(temporary).catch(() => {});
      active -= 1;
      waiting.shift()?.();
    }
  }
  router.get('/thumbs/v1/:width/:file', async (req, res) => {
    const width = Number(req.params.width);
    const file = req.params.file;
    if (!IMAGE_WIDTHS.includes(width) || String(width) !== req.params.width || !IMAGE_KEY.test(file)) return res.sendStatus(404);
    const source = join(storageDir, file);
    const destination = join(storageDir, 'thumbs', 'v1', String(width), `${file}.webp`);
    try {
      const original = await stat(source);
      if (!original.isFile() || original.size > 5 * 1024 * 1024) return res.sendStatus(404);
      try { await stat(destination); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        let job = pending.get(destination);
        if (!job) {
          if (pending.size >= 32) return res.set('Retry-After', '5').sendStatus(503);
          job = generate(source, destination, width).finally(() => pending.delete(destination));
          pending.set(destination, job);
        }
        await job;
      }
      // A removed original must not leave a separately accessible derivative.
      await stat(source);
      return res.sendFile(destination, { immutable: true, maxAge: '1y' });
    } catch (error) {
      return res.sendStatus(error.code === 'ENOENT' ? 404 : 503);
    }
  });
  return router;
}
