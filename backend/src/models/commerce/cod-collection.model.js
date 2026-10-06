import mongoose from 'mongoose';

const codCollectionSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  amountVnd: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  evidenceReference: { type: String, required: true, trim: true, maxlength: 500 },
  idempotencyKey: { type: String, required: true, maxlength: 64 },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  recordedAt: { type: Date, required: true },
}, { timestamps: false, collection: 'cod_collections' });

codCollectionSchema.index({ orderId: 1 }, { unique: true });
codCollectionSchema.index({ idempotencyKey: 1 }, { unique: true });

export const CodCollection = mongoose.models.CodCollection
  || mongoose.model('CodCollection', codCollectionSchema);
