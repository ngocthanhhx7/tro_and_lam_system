import mongoose from 'mongoose';

const { Schema } = mongoose;

const ContentBlockSchema = new Schema({
  type: { type: String, enum: ['paragraph', 'heading', 'quote', 'list', 'image', 'link'], required: true },
  text: { type: String, trim: true },
  items: { type: [String], default: undefined },
  url: { type: String, trim: true },
  alt: { type: String, trim: true },
  caption: { type: String, trim: true },
}, { _id: false, strict: 'throw' });

const StorySectionSchema = new Schema({
  heading: { type: String, trim: true },
  body: { type: [ContentBlockSchema], default: [] },
}, { _id: false, strict: 'throw' });

const StoryMediaSchema = new Schema({
  url: { type: String, required: true, trim: true },
  alt: { type: String, required: true, trim: true },
  caption: { type: String, trim: true },
}, { _id: false, strict: 'throw' });

const storySchema = new Schema({
  slug: { type: String, required: true, trim: true, lowercase: true },
  title: { type: String, required: true, trim: true },
  locale: { type: String, enum: ['vi', 'en'], required: true },
  origin: { type: String, default: '', trim: true },
  artisan: { type: String, trim: true },
  motifs: { type: [String], default: [] },
  sections: { type: [StorySectionSchema], default: [] },
  media: { type: [StoryMediaSchema], default: [] },
  productIds: { type: [{ type: Schema.Types.ObjectId, ref: 'Product' }], default: [] },
  status: { type: String, enum: ['draft', 'published', 'archived'], required: true, default: 'draft' },
  publishedAt: { type: Date },
  version: { type: Number, required: true, default: 0, min: 0 },
}, { timestamps: true, versionKey: false, strict: 'throw', collection: 'stories' });
storySchema.index({ slug: 1, locale: 1 }, { unique: true });
storySchema.index({ status: 1, locale: 1, publishedAt: -1 });

const pageSchema = new Schema({
  slug: { type: String, required: true, trim: true, lowercase: true },
  title: { type: String, required: true, trim: true },
  locale: { type: String, enum: ['vi', 'en'], required: true },
  blocks: { type: [ContentBlockSchema], default: [] },
  status: { type: String, enum: ['draft', 'published', 'archived'], required: true, default: 'draft' },
  version: { type: Number, required: true, default: 0, min: 0 },
}, { timestamps: true, versionKey: false, strict: 'throw', collection: 'pages' });
pageSchema.index({ slug: 1, locale: 1 }, { unique: true });
pageSchema.index({ status: 1, locale: 1, updatedAt: -1 });

const nfcTagSchema = new Schema({
  publicId: { type: String, required: true, immutable: true, match: /^[a-f\d]{32}$/ },
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  storyId: { type: Schema.Types.ObjectId, ref: 'Story', required: true },
  status: { type: String, enum: ['active', 'revoked'], required: true, default: 'active' },
  createdBy: { type: Schema.Types.ObjectId, required: true },
  version: { type: Number, required: true, default: 0, min: 0 },
}, { timestamps: true, versionKey: false, strict: 'throw', collection: 'nfc_tags' });
nfcTagSchema.index({ publicId: 1 }, { unique: true });
nfcTagSchema.index({ storyId: 1, status: 1 });

export const Story = mongoose.models.Story || mongoose.model('Story', storySchema);
export const Page = mongoose.models.Page || mongoose.model('Page', pageSchema);
export const NfcTag = mongoose.models.NfcTag || mongoose.model('NfcTag', nfcTagSchema);

export const contentIndexes = Object.freeze({
  stories: [{ slug: 1, locale: 1, unique: true }, { status: 1, locale: 1, publishedAt: -1 }],
  pages: [{ slug: 1, locale: 1, unique: true }, { status: 1, locale: 1, updatedAt: -1 }],
  nfc_tags: [{ publicId: 1, unique: true }, { storyId: 1, status: 1 }],
});
