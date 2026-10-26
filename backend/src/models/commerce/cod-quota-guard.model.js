import mongoose from 'mongoose';

// A shared write serializes quota checks, not a cached count. Expiry is cleanup
// only: the order collection remains authoritative after a guard is recreated.
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  nonce: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { collection: 'cod_quota_guards', versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CodQuotaGuard = mongoose.models.CodQuotaGuard || mongoose.model('CodQuotaGuard', schema);
