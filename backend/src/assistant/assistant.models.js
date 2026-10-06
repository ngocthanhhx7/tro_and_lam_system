import mongoose from 'mongoose';

const { Schema } = mongoose;

const messageSchema = new Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true, maxlength: 5000 },
  createdAt: { type: Date, required: true },
}, { _id: false, strict: 'throw' });

const conversationSchema = new Schema({
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  guestHash: { type: String, match: /^[a-f\d]{64}$/i, required: false },
  messagesRedacted: { type: [messageSchema], default: [] },
  expiresAt: { type: Date, required: true },
  consentAt: { type: Date, required: false },
}, {
  collection: 'ai_conversations',
  timestamps: true,
  strict: 'throw',
  minimize: false,
});

conversationSchema.pre('validate', function validateOwner() {
  const hasUserOwner = this.ownerUserId !== undefined && this.ownerUserId !== null;
  const hasGuestOwner = typeof this.guestHash === 'string' && this.guestHash.length > 0;
  if (hasUserOwner === hasGuestOwner) this.invalidate('ownerUserId', 'Exactly one conversation owner is required');
});

conversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ai_conversations_expiry_ttl' });
conversationSchema.index({ ownerUserId: 1, expiresAt: 1 }, { name: 'ai_conversations_owner_expiry' });
conversationSchema.index({ guestHash: 1, expiresAt: 1 }, { name: 'ai_conversations_guest_expiry' });

export const AiConversation = mongoose.models.AiConversation
  || mongoose.model('AiConversation', conversationSchema, 'ai_conversations');
