import mongoose from 'mongoose';

const { Schema } = mongoose;

const reviewSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  orderId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  productId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  rating: { type: Number, min: 1, max: 5, validate: Number.isSafeInteger, required: true },
  comment: { type: String, default: '', maxlength: 5000 },
  attachmentIds: { type: [{ type: Schema.Types.ObjectId, ref: 'SupportAttachment' }], default: [] },
  consentToPublishAttachments: { type: Boolean, default: false },
  moderationStatus: { type: String, enum: ['pending', 'published', 'hidden'], required: true, default: 'pending' },
  moderatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  moderationReason: { type: String, maxlength: 1000 },
  moderatedAt: { type: Date },
  version: { type: Number, min: 0, required: true, default: 0 },
}, { timestamps: true, versionKey: false, strict: 'throw', collection: 'reviews' });

reviewSchema.index({ userId: 1, orderId: 1, productId: 1 }, { unique: true, name: 'reviews_buyer_order_product_unique' });
reviewSchema.index({ productId: 1, moderationStatus: 1, createdAt: -1, _id: -1 }, { name: 'reviews_public_product_status' });
reviewSchema.index({ userId: 1, createdAt: -1, _id: -1 }, { name: 'reviews_owner_created' });
reviewSchema.index({ moderationStatus: 1, createdAt: 1, _id: 1 }, { name: 'reviews_admin_queue' });

export const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

export const reviewIndexes = Object.freeze([
  'userId_1_orderId_1_productId_1_unique',
  'productId_1_moderationStatus_1_createdAt_-1__id_-1',
  'userId_1_createdAt_-1__id_-1',
  'moderationStatus_1_createdAt_1__id_1',
]);
