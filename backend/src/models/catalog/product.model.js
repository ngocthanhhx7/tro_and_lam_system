import mongoose from 'mongoose';

const { Schema } = mongoose;

const productImageSchema = new Schema({
  url: { type: String, required: true, trim: true },
  alt: { type: String, required: true, trim: true, maxlength: 250 },
  sortOrder: { type: Number, min: 0, required: true },
}, { _id: false });

const productSchema = new Schema({
  slug: { type: String, required: true, trim: true, maxlength: 180, unique: true },
  sku: { type: String, required: true, trim: true, maxlength: 80, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 160 },
  line: { type: String, enum: ['lifestyle', 'diplomacy'], required: true, index: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'CatalogCategory', required: true },
  description: { type: String, default: '', maxlength: 12000 },
  material: { type: String, default: '', maxlength: 500 },
  dimensions: { type: String, maxlength: 300 },
  careInstructions: { type: String, maxlength: 3000 },
  images: {
    type: [productImageSchema],
    default: [],
    validate: { validator: (images) => images.length <= 5, message: 'Mỗi sản phẩm có thể có tối đa 5 hình ảnh' },
  },
  storyId: { type: Schema.Types.ObjectId },
  saleMode: { type: String, enum: ['buy', 'quote', 'both'], required: true },
  priceVnd: { type: Number, min: 1, validate: Number.isSafeInteger },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  featured: { type: Boolean, default: false },
  version: { type: Number, min: 0, default: 0 },
}, { timestamps: true, versionKey: false, collection: 'products' });

productSchema.index({ status: 1, line: 1, categoryId: 1, priceVnd: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.pre('validate', function validateDirectPrice() {
  if (this.status === 'published' && this.images.length < 1) {
    this.invalidate('images', 'Sản phẩm công bố cần tối thiểu 1 hình ảnh');
  }
  if (['buy', 'both'].includes(this.saleMode) && !Number.isSafeInteger(this.priceVnd)) {
    this.invalidate('priceVnd', 'Sản phẩm mua trực tiếp cần có giá VND nguyên lớn hơn 0');
  }
});

export const CatalogProduct = mongoose.models.CatalogProduct
  || mongoose.model('CatalogProduct', productSchema);
