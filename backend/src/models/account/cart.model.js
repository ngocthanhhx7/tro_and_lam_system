import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
  quantity: { type: Number, required: true, min: 1, max: 99, validate: Number.isInteger },
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  guestTokenHash: { type: String, maxlength: 64 },
  items: { type: [cartItemSchema], default: [] },
  version: { type: Number, required: true, default: 0, min: 0 },
  expiresAt: { type: Date, required: true },
  // A consumed guest token stays reserved until expiry so a retry cannot merge it twice.
  mergedAt: { type: Date },
}, {
  timestamps: true,
  collection: 'carts',
  validateBeforeSave: true,
});

cartSchema.pre('validate', function validateCartOwner() {
  const hasUser = Boolean(this.userId);
  const hasGuest = typeof this.guestTokenHash === 'string' && this.guestTokenHash.length > 0;
  if (hasUser === hasGuest) throw new Error('Cart must have exactly one owner');
});

cartSchema.index({ userId: 1 }, {
  unique: true,
  partialFilterExpression: { userId: { $type: 'objectId' } },
  name: 'one_cart_per_user',
});
cartSchema.index({ guestTokenHash: 1 }, {
  unique: true,
  partialFilterExpression: { guestTokenHash: { $type: 'string' } },
  name: 'one_cart_per_guest_token',
});
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'cart_expiry_ttl' });

export const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);
