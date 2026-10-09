import mongoose from 'mongoose';

const authChallengeSchema = new mongoose.Schema({
  purpose: { type: String, enum: ['verify_email', 'reset_password', 'change_email', 'appeal_access', 'invite_user', 'guest_order_access'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId },
  invitedRole: { type: String, enum: ['customer', 'staff', 'admin'] },
  targetEmail: { type: String, lowercase: true, trim: true, maxlength: 254 },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date },
  attempts: { type: Number, required: true, default: 0 },
}, { timestamps: true, collection: 'auth_challenges' });

authChallengeSchema.pre('validate', function validateChallengeTargets() {
  const needsOrder = this.purpose === 'guest_order_access';
  const needsRole = this.purpose === 'invite_user';
  const needsTargetEmail = this.purpose === 'change_email';
  const validTarget = needsOrder
    ? Boolean(this.orderId) && !this.userId
    : Boolean(this.userId) && !this.orderId;
  if (!validTarget || (needsRole ? !this.invitedRole : Boolean(this.invitedRole))
    || (needsTargetEmail ? !this.targetEmail : Boolean(this.targetEmail))) {
    this.invalidate('purpose', 'Challenge target does not match its purpose');
  }
});

authChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authChallengeSchema.index({ userId: 1, purpose: 1, consumedAt: 1 });

export const AuthChallenge = mongoose.models.AuthChallenge || mongoose.model('AuthChallenge', authChallengeSchema);
