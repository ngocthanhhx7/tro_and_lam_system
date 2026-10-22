// Explicit owner-requested photo import. Default is a read-only preflight.
// Uses the catalog service for validation, version checks, transactions and audit.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { env } from '../../backend/src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../../backend/src/config/database.js';
import { createCatalogService } from '../../backend/src/services/catalog/catalog.service.js';
import { createMongooseCatalogRepository } from '../../backend/src/services/catalog/mongoose-catalog.repository.js';
import { createLocalMediaProvider } from '../../backend/src/services/catalog/media-provider.js';
import { createAuditService } from '../../backend/src/services/operations/audit.service.js';

const [mode = '--preflight', inputDirectory] = process.argv.slice(2);
const allowed = new Set(['binh-ty-ba', 'binh-hoa-lam', 'binh-phuong-hoang', 'binh-thien-nga', 'bo-tra-lac-hong', 'hop-tra-gom', 'bo-do-an']);
const normalizedImages = images => JSON.stringify(images.map(({ url, alt, sortOrder }) => ({ url, alt, sortOrder })).sort((a, b) => a.sortOrder - b.sortOrder));
const requestId = randomUUID();
const actor = { role: 'system', requestId };
let media;
let committed = false;
const uploaded = [];
try {
  if (!['--preflight', '--apply', '--rollback'].includes(mode) || !inputDirectory) throw new Error('INVALID_ARGUMENTS');
  if (env.nodeEnv !== 'production') throw new Error('PRODUCTION_OPERATOR_ONLY');
  await connectDatabase(env.mongoUri);
  const audit = createAuditService({});
  const service = createCatalogService({ productRepository: createMongooseCatalogRepository(), auditPort: { appendAudit: (event, options) => audit.append(event, options) } });
  if (mode === '--rollback') {
    const path = resolve(inputDirectory);
    if (!path.startsWith('/var/lib/tro-lam/runtime/product-photos-') || !/^product-photos-[a-f0-9-]+\.json$/u.test(basename(path))) throw new Error('INVALID_BACKUP_PATH');
    const backup = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(backup.products) || backup.products.length !== 7) throw new Error('INVALID_BACKUP');
    await mongoose.connection.transaction(async session => {
      for (const row of backup.products) {
        if (!allowed.has(row.slug)) throw new Error('UNAPPROVED_PRODUCT');
        const current = await service.getAdminProduct(row.id, { session });
        if (current.slug !== row.slug || current.version !== row.beforeVersion + 1 || normalizedImages(current.images) !== normalizedImages(row.afterImages)) throw new Error('ROLLBACK_CONCURRENT_CHANGE');
        await service.updateProduct(row.id, { images: row.beforeImages, expectedVersion: current.version }, { actor, session });
      }
    });
    committed = true;
    console.log('Restored prior images through catalog service; current price and inventory untouched.');
  } else {
    const directory = resolve(inputDirectory);
    const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
    if (manifest.ownerRequestDate !== '2026-10-22' || manifest.products?.length !== 7 || new Set(manifest.products.map(row => row.slug)).size !== 7) throw new Error('INVALID_APPROVED_MANIFEST');
    const prepared = [];
    for (const row of manifest.products) {
      if (!allowed.has(row.slug) || !/^[a-f0-9]{24}$/u.test(row.id) || !row.sourcePage.startsWith('https://chudauceramic.vn/')) throw new Error('UNAPPROVED_PRODUCT');
      const current = await service.getAdminProduct(row.id);
      if (current.slug !== row.slug || current.status !== 'published' || normalizedImages(current.images) !== normalizedImages(row.expectedImages)) throw new Error('SOURCE_PRODUCT_CHANGED');
      const files = [];
      for (const image of row.images) {
        if (!/^[a-z0-9-]+\.webp$/u.test(image.file) || !image.sourceImage.startsWith('https://bizweb.dktcdn.net/')) throw new Error('INVALID_PHOTO_SOURCE');
        const buffer = await readFile(resolve(directory, image.file));
        if (buffer.length > 5 * 1024 * 1024 || createHash('sha256').update(buffer).digest('hex') !== image.sha256) throw new Error('INVALID_PHOTO_HASH');
        const metadata = await sharp(buffer).metadata();
        if (metadata.format !== 'webp' || !metadata.width || !metadata.height || metadata.width * metadata.height > 24_000_000) throw new Error('INVALID_IMAGE');
        files.push({ buffer, alt: image.alt });
      }
      if (!files.length || files.length > 10) throw new Error('INVALID_PHOTO_COUNT');
      prepared.push({ row, current, files });
    }
    console.log(`Preflight passed: ${prepared.length} approved products; Phu Quy excluded; file hashes, current images and identities verified.`);
    if (mode === '--apply') {
      if (!['filesystem', 'local'].includes(env.mediaStorageDriver)) throw new Error('FILESYSTEM_MEDIA_REQUIRED');
      media = createLocalMediaProvider({ storageDir: env.mediaStoragePath, publicBaseUrl: env.mediaPublicBaseUrl });
      const products = [];
      for (const { row, current, files } of prepared) {
        const afterImages = [];
        for (const [sortOrder, file] of files.entries()) {
          const stored = await media.upload({ buffer: file.buffer, mimeType: 'image/webp' });
          uploaded.push(stored.storageKey);
          afterImages.push({ url: stored.publicUrl, alt: file.alt, sortOrder });
        }
        products.push({ id: row.id, slug: row.slug, sourcePage: row.sourcePage, beforeVersion: current.version, beforeImages: current.images, afterImages, priceVnd: current.priceVnd, saleMode: current.saleMode });
      }
      const backupPath = `/var/lib/tro-lam/runtime/product-photos-${requestId}.json`;
      await writeFile(backupPath, JSON.stringify({ requestId, products }, null, 2), { flag: 'wx', mode: 0o600 });
      await mongoose.connection.transaction(async session => {
        for (const row of products) {
          const updated = await service.updateProduct(row.id, { images: row.afterImages, expectedVersion: row.beforeVersion }, { actor, session });
          if (updated.priceVnd !== row.priceVnd || updated.saleMode !== row.saleMode) throw new Error('UNEXPECTED_BUSINESS_CHANGE');
        }
      });
      committed = true;
      console.log(`Applied ${products.length} image updates atomically; backup: ${backupPath}`);
    }
  }
} catch (error) {
  if (!committed && media) for (const key of uploaded) await media.remove(key).catch(() => {});
  console.error(`Photo import failed: ${error.code || error.name || 'ERROR'}. No credentials or database details emitted.`);
  process.exitCode = 1;
} finally { await disconnectDatabase(); }
