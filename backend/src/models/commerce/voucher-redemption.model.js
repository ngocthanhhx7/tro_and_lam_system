import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  voucherId: { type: mongoose.Schema.Types.ObjectId, required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  redeemedAt: { type: Date, required: true },
  releasedAt: { type: Date },
}, { collection: 'voucher_redemptions', timestamps: true });
schema.index({ orderId: 1 }, { unique: true, name: 'voucher_redemption_per_order' });
export const VoucherRedemption = mongoose.models.VoucherRedemption || mongoose.model('VoucherRedemption', schema);
