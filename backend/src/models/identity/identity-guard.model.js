import mongoose from 'mongoose';

const identityGuardSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  version: { type: Number, required: true, default: 0 },
  lastActionAt: { type: Date },
}, { timestamps: true, collection: 'identity_guards' });

export const IdentityGuard = mongoose.models.IdentityGuard || mongoose.model('IdentityGuard', identityGuardSchema);
