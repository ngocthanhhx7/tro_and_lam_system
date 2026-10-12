import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { env } from '../../backend/src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../../backend/src/config/database.js';
import { CatalogProduct } from '../../backend/src/models/catalog/product.model.js';
import { Inventory } from '../../backend/src/models/commerce/inventory.model.js';
import { AuditLog } from '../../backend/src/models/operations/audit-log.model.js';
import { createAuditService } from '../../backend/src/services/operations/audit.service.js';

const ids = process.argv.slice(2);
const requestId = `catalog-purchase-approval:${randomUUID()}`;
try {
  if (!ids.length || ids.some(id => !/^[a-f0-9]{24}$/i.test(id)) || new Set(ids).size !== ids.length) {
    throw new Error('Pass the exact, distinct product IDs approved by the owner.');
  }
  if (env.nodeEnv !== 'production') throw new Error('This operator migration is for the configured production deployment.');
  await connectDatabase(env.mongoUri);
  const snapshot = await CatalogProduct.find({ _id: { $in: ids } }).lean();
  if (snapshot.length !== ids.length) throw new Error('Some selected products do not exist.');
  const inventory = await Inventory.find({ productId: { $in: ids } }).lean();
  for (const product of snapshot) {
    const stock = inventory.find(row => String(row.productId) === String(product._id));
    if (product.status !== 'published' || !['buy', 'both'].includes(product.saleMode)
      || !Number.isSafeInteger(product.priceVnd) || product.priceVnd <= 0 || !stock || stock.onHand <= stock.reserved) {
      throw new Error('Selected products must already be published, priced for direct purchase, and in stock.');
    }
  }
  const backupPath = `/var/lib/tro-lam/runtime/${requestId.replace(':', '-')}-before.json`;
  await writeFile(backupPath, JSON.stringify({ products: snapshot, inventory }, null, 2), { mode: 0o600, flag: 'wx' });
  const audit = createAuditService({ AuditLog });
  await mongoose.connection.transaction(async session => {
    for (const prior of snapshot) {
      const product = await CatalogProduct.findById(prior._id).session(session);
      if (product.version !== prior.version) throw new Error('Product changed since backup; retry with a fresh snapshot.');
      if (product.purchaseApproved === true) continue;
      product.purchaseApproved = true;
      await product.validate();
      const updated = await CatalogProduct.updateOne({ _id: product._id, version: prior.version }, {
        $set: { purchaseApproved: true }, $inc: { version: 1 },
      }, { session, runValidators: true });
      if (updated.modifiedCount !== 1) throw new Error('Concurrent product update; approval rolled back.');
      await audit.append({ actorRole: 'system', requestId, action: 'catalog.product.purchase_approved',
        targetType: 'catalog_product', targetId: String(product._id), outcome: 'success',
        reasonCode: 'OWNER_REQUEST', changesRedacted: { fields: ['purchaseApproved'] },
      }, { session });
    }
  });
  console.log(`Approved ${ids.length} selected products. Prices, SKUs, stock and reservations unchanged. Backup: ${backupPath}`);
} catch (error) {
  const message = error instanceof mongoose.Error || error?.name?.startsWith('Mongo')
    ? 'Database migration failed; check configuration, permissions and data. No raw database values logged.'
    : error.message;
  console.error(message);
  process.exitCode = 1;
} finally { await disconnectDatabase(); }
