import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  paymentAttemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentAttempt' },
  amountVnd: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  status: { type: String, required: true, enum: ['requested', 'approved', 'rejected', 'processing', 'completed', 'failed'], default: 'requested' },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  requestedBy: { type: mongoose.Schema.Types.ObjectId },
  requesterType: { type: String, required: true, enum: ['customer', 'staff', 'admin', 'guest'], default: 'staff' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId },
  requestKey: { type: String, required: true, trim: true, maxlength: 200 },
  requestPayloadHash: { type: String, required: true, match: /^[a-f0-9]{64}$/u },
  externalReference: { type: String, trim: true, maxlength: 500 },
  evidenceReference: { type: String, trim: true, maxlength: 500 },
  outcomeReason: { type: String, trim: true, maxlength: 1000 },
  outcomeReasonCode: { type: String, trim: true, maxlength: 80 },
  version: { type: Number, required: true, default: 0, min: 0, validate: Number.isSafeInteger },
}, { timestamps: true, collection: 'refunds' });

refundSchema.index({ orderId: 1, requestKey: 1 }, { unique: true });
refundSchema.index({ orderId: 1 }, {
  unique: true,
  partialFilterExpression: { $or: [{ status: 'requested' }, { status: 'approved' }, { status: 'processing' }] },
  name: 'refund_one_open_per_order',
});
refundSchema.index({ externalReference: 1 }, {
  unique: true,
  partialFilterExpression: { externalReference: { $type: 'string' } },
});
refundSchema.index({ status: 1, createdAt: -1 });
refundSchema.index({ orderId: 1, status: 1 });

export const Refund = mongoose.models.Refund || mongoose.model('Refund', refundSchema);
