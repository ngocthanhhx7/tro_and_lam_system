import { createHash } from 'node:crypto';
import { Order } from '../../models/commerce/order.model.js';
import { IdempotencyRecord } from '../../models/commerce/idempotency-record.model.js';

const legacyFilter = {
  userId: null, paymentMethod: 'cod', paymentStatus: 'pending',
  status: { $nin: ['cancelled', 'returned'] }, guestCheckoutKeyHash: { $exists: false },
};

export async function assertPendingGuestCodAttribution() {
  if (await Order.exists(legacyFilter).maxTimeMS(5000)) {
    throw new Error('Pending guest COD orders need attribution/reconciliation before activation; run the dry-run migration first');
  }
}

// Run with the old API stopped during activation. Dry run never writes. Refuse
// guessed identities: expired/deleted evidence requires owner reconciliation.
export async function backfillPendingGuestCodKeys({ apply = false } = {}) {
  const rows = await Order.find(legacyFilter).select('_id').limit(501).lean();
  if (rows.length > 500) throw new Error('COD_MIGRATION_BATCH_REVIEW_REQUIRED');
  const assignments = [];
  let unresolved = 0;
  for (const row of rows) {
    const records = await IdempotencyRecord.find({ scope: 'orders.create', state: 'succeeded', resourceId: row._id })
      .select('actorKey').limit(2).lean();
    const keys = new Set(records.map(record => record.actorKey));
    const [key] = keys;
    if (records.length !== 1 || keys.size !== 1 || !key?.startsWith('guest:') || key.length < 26 || key.length > 134) {
      unresolved += 1;
      continue;
    }
    assignments.push({ id: row._id, hash: createHash('sha256').update(key).digest('hex') });
  }
  if (unresolved || !apply) return { legacy: rows.length, attributable: assignments.length, unresolved, updated: 0 };
  let updated = 0;
  for (const row of assignments) {
    const result = await Order.updateOne({ ...legacyFilter, _id: row.id }, { $set: { guestCheckoutKeyHash: row.hash } });
    updated += result.modifiedCount;
  }
  const remaining = await Order.countDocuments(legacyFilter);
  return { legacy: rows.length, attributable: assignments.length, unresolved: remaining, updated };
}
