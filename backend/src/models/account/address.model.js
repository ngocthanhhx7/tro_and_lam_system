import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
  accuracyMeters: { type: Number, min: 0 },
  capturedAt: { type: Date, required: true },
  source: { type: String, required: true, trim: true, maxlength: 80 },
}, { _id: false });

const addressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  label: { type: String, trim: true, maxlength: 80 },
  recipientName: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  line1: { type: String, required: true, trim: true, maxlength: 200 },
  line2: { type: String, trim: true, maxlength: 200 },
  ward: { type: String, trim: true, maxlength: 100 },
  province: { type: String, trim: true, maxlength: 100 },
  countryCode: { type: String, required: true, enum: ['VN'], default: 'VN' },
  postalCode: { type: String, trim: true, maxlength: 20 },
  formattedAddress: { type: String, required: true, trim: true, maxlength: 500 },
  location: { type: locationSchema },
  isDefault: { type: Boolean, required: true, default: false },
  version: { type: Number, required: true, default: 0, min: 0 },
}, { timestamps: true, collection: 'addresses' });

addressSchema.index({ userId: 1, createdAt: 1 });
addressSchema.index({ userId: 1, isDefault: 1 }, {
  unique: true,
  partialFilterExpression: { isDefault: true },
  name: 'one_default_address_per_user',
});

export const Address = mongoose.models.Address || mongoose.model('Address', addressSchema);
