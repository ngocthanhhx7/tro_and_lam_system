import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  emailNormalized: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  phone: { type: String, trim: true, maxlength: 30 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'staff', 'admin'], required: true, default: 'customer' },
  status: { type: String, enum: ['active', 'blocked'], required: true, default: 'active' },
  emailVerifiedAt: { type: Date },
  authVersion: { type: Number, required: true, default: 0 },
  blockedReason: { type: String, maxlength: 1000 },
  blockedAt: { type: Date },
  blockedBy: { type: mongoose.Schema.Types.ObjectId },
  version: { type: Number, required: true, default: 0 },
}, { timestamps: true, collection: 'users' });

userSchema.index({ emailNormalized: 1 }, { unique: true });
userSchema.index({ role: 1, status: 1, createdAt: -1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
