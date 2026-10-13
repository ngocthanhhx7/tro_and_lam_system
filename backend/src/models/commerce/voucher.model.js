import mongoose from 'mongoose';

const voucherSchema = new mongoose.Schema({
  scope: { type: String, enum: ['customer', 'public'], default: 'customer', immutable: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required() { return this.scope !== 'public'; }, immutable: true },
  maxRedemptions: { type: Number, min: 1, max: 1000000, default: 1, validate: Number.isSafeInteger, immutable: true },
  redeemedCount: { type: Number, min: 0, default: 0, validate: Number.isSafeInteger },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40, immutable: true },
  title: { type: String, required: true, trim: true, maxlength: 120, immutable: true },
  discountType: { type: String, enum: ['fixed', 'percent'], required: true, immutable: true },
  discountValue: { type: Number, required: true, min: 1, validate: Number.isSafeInteger, immutable: true },
  maxDiscountVnd: { type: Number, min: 1, validate: Number.isSafeInteger, immutable: true },
  minSubtotalVnd: { type: Number, required: true, min: 0, validate: Number.isSafeInteger, immutable: true, default: 0 },
  expiresAt: { type: Date, required: true, immutable: true },
  status: { type: String, enum: ['available', 'redeemed', 'revoked', 'expired'], required: true, default: 'available' },
  redeemedAt: { type: Date },
  redeemedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
}, { timestamps: true, collection: 'vouchers' });

voucherSchema.index({ code: 1 }, { unique: true, name: 'vouchers_code_unique' });
voucherSchema.index({ userId: 1, status: 1, expiresAt: 1, createdAt: -1 }, { name: 'vouchers_customer_wallet' });
voucherSchema.index({ redeemedOrderId: 1 }, { sparse: true, name: 'vouchers_redeemed_order' });

export const Voucher = mongoose.models.Voucher || mongoose.model('Voucher', voucherSchema);
