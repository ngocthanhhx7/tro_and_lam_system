import mongoose from 'mongoose';

const { Schema } = mongoose;

const categorySchema = new Schema({
  slug: { type: String, required: true, trim: true, maxlength: 180, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 5000 },
  parentId: { type: Schema.Types.ObjectId, ref: 'CatalogCategory' },
  sortOrder: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  version: { type: Number, min: 0, default: 0 },
}, { timestamps: true, versionKey: false, collection: 'categories' });

categorySchema.index({ status: 1, sortOrder: 1, name: 1, _id: 1 });

export const CatalogCategory = mongoose.models.CatalogCategory
  || mongoose.model('CatalogCategory', categorySchema);
