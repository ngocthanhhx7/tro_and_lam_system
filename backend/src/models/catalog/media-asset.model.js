import mongoose from 'mongoose';

const mediaAssetSchema = new mongoose.Schema({
  storageKey: { type: String, required: true, unique: true },
  publicUrl: { type: String, required: true },
  mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
  bytes: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
  alt: { type: String, required: true, maxlength: 250 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['ready'], default: 'ready' },
  version: { type: Number, min: 0, default: 0 },
}, { timestamps: true, versionKey: false, collection: 'media_assets' });

export const CatalogMediaAsset = mongoose.models.CatalogMediaAsset
  || mongoose.model('CatalogMediaAsset', mediaAssetSchema);
