import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  eventKey: { type: String, required: true, immutable: true, trim: true, maxlength: 200 },
  category: { type: String, required: true, enum: ['order', 'support', 'account', 'system', 'promotion'], immutable: true },
  title: { type: String, required: true, trim: true, maxlength: 160, immutable: true },
  body: { type: String, required: true, trim: true, maxlength: 500, immutable: true },
  href: { type: String, required: true, trim: true, maxlength: 500, immutable: true },
  readAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'notifications' });

notificationSchema.index({ userId: 1, eventKey: 1 }, { unique: true, name: 'notifications_user_event_unique' });
notificationSchema.index({ userId: 1, createdAt: -1, _id: -1 }, { name: 'notifications_user_created' });
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 }, { name: 'notifications_user_read_created' });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
