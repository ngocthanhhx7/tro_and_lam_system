import mongoose from 'mongoose';

const reservationItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true, min: 1, max: 99 },
}, { _id: false });

const stockReservationSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  items: { type: [reservationItemSchema], required: true, validate: (items) => items.length > 0 },
  status: { type: String, enum: ['held', 'committed', 'released'], required: true },
  expiresAt: { type: Date },
  releaseReason: { type: String, maxlength: 100 },
  version: { type: Number, required: true, default: 0, min: 0 },
}, { timestamps: true, collection: 'stock_reservations' });

stockReservationSchema.index({ orderId: 1 }, { unique: true });
stockReservationSchema.index({ status: 1, expiresAt: 1 });

export const StockReservation = mongoose.models.StockReservation
  || mongoose.model('StockReservation', stockReservationSchema);
