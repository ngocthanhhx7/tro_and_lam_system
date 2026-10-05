import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  authVersion: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
  lastSeenAt: { type: Date },
}, { timestamps: true, collection: 'sessions' });

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, revokedAt: 1 });

export const AuthSession = mongoose.models.AuthSession || mongoose.model('AuthSession', sessionSchema);
