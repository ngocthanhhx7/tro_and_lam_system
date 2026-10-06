import mongoose from 'mongoose';

const recipientSnapshotSchema = new mongoose.Schema({
  recipientName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  line1: { type: String, required: true, trim: true, maxlength: 200 },
  line2: { type: String, trim: true, maxlength: 200 },
  ward: { type: String, trim: true, maxlength: 100 },
  province: { type: String, trim: true, maxlength: 100 },
  countryCode: { type: String, required: true, enum: ['VN'] },
  postalCode: { type: String, trim: true, maxlength: 20 },
  formattedAddress: { type: String, required: true, trim: true, maxlength: 500 },
  location: {
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    accuracyMeters: { type: Number, min: 0 },
    capturedAt: { type: Date },
    source: { type: String, trim: true, maxlength: 80 },
  },
}, { _id: false });

const itemSnapshotSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sku: { type: String, required: true, trim: true, maxlength: 80 },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  imageUrl: { type: String, trim: true, maxlength: 2048 },
  quantity: { type: Number, required: true, min: 1, max: 99, validate: Number.isSafeInteger },
  unitPriceVnd: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
}, { _id: false });

const shippingEventSchema = new mongoose.Schema({
  status: { type: String, required: true, trim: true, maxlength: 80 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  occurredAt: { type: Date, required: true },
  carrier: { type: String, trim: true, maxlength: 120 },
  trackingNumber: { type: String, trim: true, maxlength: 120 },
  actorId: { type: mongoose.Schema.Types.ObjectId },
}, { _id: false });

const shippingSchema = new mongoose.Schema({
  carrier: { type: String, trim: true, maxlength: 120 },
  trackingNumber: { type: String, trim: true, maxlength: 120 },
  events: { type: [shippingEventSchema], default: [] },
}, { _id: false });

const orderStatusHistorySchema = new mongoose.Schema({
  fromStatus: { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'] },
  toStatus: { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'], required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId },
  reason: { type: String, trim: true, maxlength: 1000 },
  createdAt: { type: Date, required: true },
}, { _id: false });

const paymentReviewSchema = new mongoose.Schema({
  required: { type: Boolean, required: true },
  reasonCode: { type: String, required: true, enum: ['PAYMENT_AMOUNT_MISMATCH', 'LATE_PAYMENT_STOCK_REVIEW'] },
  amountVnd: { type: Number, min: 1, validate: Number.isSafeInteger },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 32 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  guestAccessTokenHash: { type: String, select: false },
  recipientSnapshot: { type: recipientSnapshotSchema, required: true },
  itemsSnapshot: { type: [itemSnapshotSchema], required: true, validate: (items) => items.length > 0 },
  subtotalVnd: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  shippingFeeVnd: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  discountVnd: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  totalVnd: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  status: { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'], required: true },
  paymentMethod: { type: String, enum: ['cod', 'payos'], required: true },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'expired', 'cancelled', 'refund_pending', 'refunded', 'partially_refunded'], required: true },
  paidAmountVnd: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  refundedAmountVnd: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  reservationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  shipping: { type: shippingSchema },
  note: { type: String, trim: true, maxlength: 1000 },
  internalNote: { type: String, trim: true, maxlength: 5000, select: false },
  paymentReview: { type: paymentReviewSchema, select: false },
  statusHistory: { type: [orderStatusHistorySchema], required: true, default: [] },
  version: { type: Number, required: true, default: 0, min: 0, validate: Number.isSafeInteger },
}, { timestamps: true, collection: 'orders' });

orderSchema.index({ code: 1 }, { unique: true });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, paymentStatus: 1, createdAt: -1 });

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
