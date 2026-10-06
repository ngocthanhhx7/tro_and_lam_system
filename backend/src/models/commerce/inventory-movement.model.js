import mongoose from 'mongoose';

const inventoryMovementSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId },
  eventKey: { type: String, required: true, maxlength: 200 },
  kind: { type: String, enum: ['restock', 'reserve', 'release', 'ship', 'return', 'adjust'], required: true },
  onHandDelta: { type: Number, required: true },
  reservedDelta: { type: Number, required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId },
  reason: { type: String, maxlength: 1000 },
}, { timestamps: true, collection: 'inventory_movements' });

inventoryMovementSchema.index({ eventKey: 1 }, { unique: true });
inventoryMovementSchema.index({ productId: 1, createdAt: -1 });

export const InventoryMovement = mongoose.models.InventoryMovement
  || mongoose.model('InventoryMovement', inventoryMovementSchema);
