import mongoose from 'mongoose';

const accountAppealSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  message: { type: String, required: true, maxlength: 5000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], required: true, default: 'pending' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId },
  reviewNote: { type: String, maxlength: 1000 },
  reviewedAt: { type: Date },
  version: { type: Number, required: true, default: 0 },
}, { timestamps: true, collection: 'account_appeals' });

accountAppealSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
accountAppealSchema.index({ status: 1, createdAt: -1 });

export const AccountAppeal = mongoose.models.AccountAppeal || mongoose.model('AccountAppeal', accountAppealSchema);
