import mongoose from 'mongoose';

const orderAccessChallengeSchema = new mongoose.Schema({
  challengeIdHash: { type: String, required: true, unique: true, maxlength: 64 },
  orderId: { type: mongoose.Schema.Types.ObjectId },
  codeHash: { type: String, required: true, maxlength: 64 },
  attempts: { type: Number, required: true, default: 0, min: 0, max: 5 },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date },
}, { timestamps: true, collection: 'order_access_challenges' });

orderAccessChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OrderAccessChallenge = mongoose.models.OrderAccessChallenge
  || mongoose.model('OrderAccessChallenge', orderAccessChallengeSchema);
