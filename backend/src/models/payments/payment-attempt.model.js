import mongoose from 'mongoose';

const paymentAttemptSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  provider: { type: String, required: true, enum: ['payos'], default: 'payos' },
  providerOrderCode: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  paymentLinkId: { type: String, trim: true, maxlength: 120 },
  status: { type: String, required: true, enum: ['pending', 'paid', 'failed', 'expired', 'cancelled'], default: 'pending' },
  amountVnd: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  checkoutUrl: { type: String, maxlength: 2048 },
  expiresAt: { type: Date, required: true },
  requestKey: { type: String, required: true, trim: true, maxlength: 200 },
  active: { type: Boolean, required: true, default: true },
  providerState: { type: String, required: true, enum: ['unknown', 'pending', 'paid', 'failed', 'expired', 'cancelled'], default: 'unknown' },
  lastCheckedAt: { type: Date },
  version: { type: Number, required: true, default: 0, min: 0, validate: Number.isSafeInteger },
}, { timestamps: true, collection: 'payment_attempts' });

paymentAttemptSchema.index({ providerOrderCode: 1 }, { unique: true });
paymentAttemptSchema.index({ orderId: 1, requestKey: 1 }, { unique: true });
paymentAttemptSchema.index({ paymentLinkId: 1 }, {
  unique: true,
  partialFilterExpression: { paymentLinkId: { $type: 'string' } },
});
paymentAttemptSchema.index({ orderId: 1 }, { unique: true, partialFilterExpression: { active: true } });
paymentAttemptSchema.index({ status: 1, updatedAt: 1 });

export const PaymentAttempt = mongoose.models.PaymentAttempt
  || mongoose.model('PaymentAttempt', paymentAttemptSchema);
