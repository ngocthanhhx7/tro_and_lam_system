import mongoose from 'mongoose';

const businessSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, immutable: true, trim: true, maxlength: 80 },
  values: { type: mongoose.Schema.Types.Mixed, required: true, default: {} },
  version: { type: Number, required: true, default: 0, min: 0, validate: Number.isSafeInteger },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  updatedAt: { type: Date, default: null },
}, { timestamps: true, collection: 'settings', versionKey: false });

businessSettingSchema.index({ key: 1 }, { unique: true, name: 'settings_key_unique' });

export const BusinessSetting = mongoose.models.BusinessSetting || mongoose.model('BusinessSetting', businessSettingSchema);
