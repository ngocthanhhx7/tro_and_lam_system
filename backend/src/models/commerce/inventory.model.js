import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  onHand: { type: Number, required: true, min: 0 },
  reserved: { type: Number, required: true, min: 0 },
  version: { type: Number, required: true, default: 0, min: 0 },
}, { timestamps: true, collection: 'inventory' });

inventorySchema.index({ productId: 1 }, { unique: true });

export const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);
