import mongoose from 'mongoose';

const paymentEventSchema = new mongoose.Schema({
  provider: { type: String, required: true, enum: ['payos'], default: 'payos' },
  dedupeKey: { type: String, required: true, trim: true, maxlength: 160 },
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentAttempt' },
  orderId: { type: mongoose.Schema.Types.ObjectId },
  providerOrderCode: { type: Number, min: 1, validate: Number.isSafeInteger },
  paymentLinkId: { type: String, trim: true, maxlength: 120 },
  payloadDigest: { type: String, required: true, match: /^[a-f0-9]{64}$/u },
  receivedAt: { type: Date, required: true, default: Date.now },
  verifiedAt: { type: Date },
  processingState: { type: String, required: true, enum: ['received', 'applied', 'review', 'rejected'], default: 'received' },
  amountVnd: { type: Number, min: 1, validate: Number.isSafeInteger },
  reasonCode: { type: String, trim: true, maxlength: 80 },
}, { timestamps: true, collection: 'payment_events' });

paymentEventSchema.index({ provider: 1, dedupeKey: 1 }, { unique: true });
paymentEventSchema.index({ processingState: 1, receivedAt: 1 });
paymentEventSchema.index({ orderId: 1, receivedAt: -1 });

export const PaymentEvent = mongoose.models.PaymentEvent
  || mongoose.model('PaymentEvent', paymentEventSchema);
