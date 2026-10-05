import mongoose from 'mongoose';

const restrictedProofSchema = new mongoose.Schema({
  purpose: { type: String, enum: ['appeal_access', 'guest_order_access'], required: true },
  scopes: { type: [String], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
  issuedAt: { type: Date, required: true },
  identityVerifiedAt: { type: Date, required: true },
  authVersion: { type: Number },
}, { timestamps: true, collection: 'restricted_proofs' });

restrictedProofSchema.pre('validate', function validateProofTarget() {
  const validTarget = this.purpose === 'appeal_access'
    ? Boolean(this.userId) && !this.orderId && this.authVersion !== undefined
    : this.purpose === 'guest_order_access' && Boolean(this.orderId) && !this.userId && this.authVersion === undefined;
  if (!validTarget) this.invalidate('purpose', 'Restricted proof target does not match its purpose');
});

restrictedProofSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
restrictedProofSchema.index({ userId: 1, purpose: 1, revokedAt: 1 });

export const RestrictedProof = mongoose.models.RestrictedProof || mongoose.model('RestrictedProof', restrictedProofSchema);
