import mongoose from 'mongoose';

const outboxEventSchema = new mongoose.Schema({
  eventKey: { type: String, required: true, immutable: true, trim: true, maxlength: 200 },
  type: { type: String, required: true, trim: true, maxlength: 120 },
  aggregateType: { type: String, required: true, trim: true, maxlength: 80 },
  aggregateId: { type: String, required: true, trim: true, maxlength: 120 },
  aggregateVersion: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  state: { type: String, required: true, enum: ['pending', 'processing', 'sent', 'failed'], default: 'pending' },
  attempts: { type: Number, required: true, min: 0, default: 0, validate: Number.isSafeInteger },
  nextAttemptAt: { type: Date, required: true, default: Date.now },
  leaseUntil: { type: Date, default: null },
  lockedBy: { type: String, default: null, maxlength: 120 },
  lastErrorCode: { type: String, default: null, maxlength: 80 },
  processedAt: { type: Date, default: null },
}, { timestamps: true, collection: 'outbox_events' });

outboxEventSchema.index({ eventKey: 1 }, { unique: true, name: 'outbox_event_key_unique' });
outboxEventSchema.index({ state: 1, nextAttemptAt: 1, _id: 1 }, { name: 'outbox_claim_pending' });
outboxEventSchema.index({ state: 1, leaseUntil: 1, _id: 1 }, { name: 'outbox_reclaim_expired_lease' });
outboxEventSchema.index({ state: 1, updatedAt: -1 }, { name: 'outbox_state_updated' });

export const OutboxEvent = mongoose.models.OutboxEvent || mongoose.model('OutboxEvent', outboxEventSchema);
