// Operator migration requested by the owner on 2026-10-22.
// Rename display names only; IDs, slugs and product.line codes remain stable.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../../backend/src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../../backend/src/config/database.js';
import { createCatalogService } from '../../backend/src/services/catalog/catalog.service.js';
import { createMongooseCatalogRepository } from '../../backend/src/services/catalog/mongoose-catalog.repository.js';
import { createAuditService } from '../../backend/src/services/operations/audit.service.js';

const labels = { 'demo-lifestyle': { before: 'Lifestyle', after: 'Dòng gốm đời sống' }, 'demo-diplomacy': { before: 'Diplomacy', after: 'Dòng gốm quà tặng' } };
const [mode = '--preflight', backupArgument] = process.argv.slice(2);
const actor = { role: 'system', requestId: randomUUID() };
try {
  if (env.nodeEnv !== 'production' || !['--preflight', '--apply', '--rollback'].includes(mode)) throw new Error('INVALID_OPERATOR_REQUEST');
  await connectDatabase(env.mongoUri);
  const audit = createAuditService();
  const service = createCatalogService({ productRepository: createMongooseCatalogRepository(), auditPort: { appendAudit: (event, options) => audit.append(event, options) } });
  const categories = await service.listAdminCategories();
  if (mode === '--rollback') {
    const path = resolve(backupArgument || '');
    if (!path.startsWith('/var/lib/tro-lam/runtime/line-labels-') || !/^line-labels-[a-f0-9-]+\.json$/u.test(basename(path))) throw new Error('INVALID_BACKUP');
    const rows = JSON.parse(await readFile(path, 'utf8'));
    if (rows.length !== 2) throw new Error('INVALID_BACKUP');
    await mongoose.connection.transaction(async session => {
      for (const row of rows) {
        const current = categories.find(category => category.id === row.id);
        if (!labels[row.slug] || current?.slug !== row.slug || current.name !== labels[row.slug].after || current.version !== row.version + 1) throw new Error('ROLLBACK_CONCURRENT_CHANGE');
        await service.updateCategory(row.id, { name: row.name, expectedVersion: current.version }, { actor, session });
      }
    });
    console.log('Restored prior line display names through catalog service.');
  } else {
    const rows = Object.entries(labels).map(([slug, label]) => {
      const current = categories.find(category => category.slug === slug);
      if (!current || current.name !== label.before || current.status !== 'published') throw new Error('CATEGORY_CHANGED');
      return { id: current.id, slug, name: current.name, version: current.version, newName: label.after };
    });
    console.log('Preflight passed: two published categories, current names and versions verified.');
    if (mode === '--apply') {
      const path = `/var/lib/tro-lam/runtime/line-labels-${actor.requestId}.json`;
      await writeFile(path, JSON.stringify(rows, null, 2), { flag: 'wx', mode: 0o600 });
      await mongoose.connection.transaction(async session => {
        for (const row of rows) await service.updateCategory(row.id, { name: row.newName, expectedVersion: row.version }, { actor, session });
      });
      console.log(`Applied two line label updates; backup: ${path}`);
    }
  }
} catch (error) {
  const reason = /^[A-Z_]+$/u.test(error.message) ? error.message : error.code || error.name;
  console.error(`Line label migration failed: ${reason}`);
  process.exitCode = 1;
} finally { await disconnectDatabase(); }
