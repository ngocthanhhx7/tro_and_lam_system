import mongoose from 'mongoose';

const idempotencyRecordSchema = new mongoose.Schema({
  scope: { type: String, required: true, trim: true, maxlength: 120 },
  actorKey: { type: String, required: true, trim: true, maxlength: 160 },
  keyHash: { type: String, required: true, match: /^[a-f\d]{64}$/iu },
  payloadHash: { type: String, required: true, match: /^[a-f\d]{64}$/iu },
  state: { type: String, enum: ['processing', 'succeeded'], required: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  responseStatus: { type: Number, min: 100, max: 599, validate: Number.isSafeInteger },
  safeResponse: { type: mongoose.Schema.Types.Mixed },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, collection: 'idempotency_records' });

idempotencyRecordSchema.index({ scope: 1, actorKey: 1, keyHash: 1 }, { unique: true });
idempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdempotencyRecord = mongoose.models.IdempotencyRecord
  || mongoose.model('IdempotencyRecord', idempotencyRecordSchema);
