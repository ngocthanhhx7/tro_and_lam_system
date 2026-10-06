import mongoose from 'mongoose';

const { Schema } = mongoose;

const ticketSchema = new Schema({
  code: { type: String, required: true, immutable: true, maxlength: 24 },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  orderId: { type: Schema.Types.ObjectId, default: null, immutable: true },
  kind: { type: String, enum: ['support', 'complaint', 'return'], required: true, immutable: true },
  subject: { type: String, required: true, trim: true, maxlength: 200 },
  status: { type: String, enum: ['open', 'assigned', 'in_progress', 'waiting_customer', 'resolved', 'closed'], required: true, default: 'open' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  priority: { type: String, default: 'normal', maxlength: 40 },
  returnRequestId: { type: Schema.Types.ObjectId, default: null },
  latestMessageAt: { type: Date, required: true },
  version: { type: Number, min: 0, required: true, default: 0 },
}, { timestamps: true, versionKey: false, strict: 'throw', collection: 'tickets' });

ticketSchema.index({ code: 1 }, { unique: true, name: 'tickets_code_unique' });
ticketSchema.index({ userId: 1, createdAt: -1, _id: -1 }, { name: 'tickets_owner_created' });
ticketSchema.index({ assignedTo: 1, status: 1, updatedAt: -1 }, { name: 'tickets_assignment_status' });
ticketSchema.index({ status: 1, kind: 1, createdAt: -1, _id: -1 }, { name: 'tickets_queue_status_kind' });

const ticketMessageSchema = new Schema({
  ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, immutable: true },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  authorRole: { type: String, enum: ['customer', 'staff', 'admin', 'guest'], required: true, immutable: true },
  visibility: { type: String, enum: ['customer', 'internal'], required: true, immutable: true },
  body: { type: String, required: true, maxlength: 10000, immutable: true },
  attachmentIds: { type: [{ type: Schema.Types.ObjectId, ref: 'SupportAttachment' }], default: [], immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, strict: 'throw', collection: 'ticket_messages' });

ticketMessageSchema.index({ ticketId: 1, createdAt: 1, _id: 1 }, { name: 'ticket_messages_cursor' });

const contactSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, immutable: true },
  phone: { type: String, trim: true, maxlength: 30 },
  kind: { type: String, enum: ['general', 'corporate', 'quote'], required: true, immutable: true },
  productId: { type: Schema.Types.ObjectId, default: null, immutable: true },
  quantity: { type: Number, min: 1, max: 99, validate: Number.isSafeInteger, immutable: true },
  company: { type: String, trim: true, maxlength: 160 },
  message: { type: String, required: true, maxlength: 5000, immutable: true },
  consentAt: { type: Date, required: true, immutable: true },
  status: { type: String, enum: ['new', 'assigned', 'contacted', 'closed'], required: true, default: 'new' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  note: { type: String, default: '', maxlength: 5000 },
  noteBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  version: { type: Number, min: 0, required: true, default: 0 },
}, { timestamps: true, versionKey: false, strict: 'throw', collection: 'contacts' });

contactSchema.index({ status: 1, createdAt: -1, _id: -1 }, { name: 'contacts_queue_status' });
contactSchema.index({ assignedTo: 1, status: 1, createdAt: -1 }, { name: 'contacts_assignment_status' });

const returnItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, min: 1, validate: Number.isSafeInteger, required: true },
  reason: { type: String, required: true, maxlength: 1000 },
  receivedQuantity: { type: Number, min: 0, validate: Number.isSafeInteger },
  resellableQuantity: { type: Number, min: 0, validate: Number.isSafeInteger },
}, { _id: false, strict: 'throw' });

const returnRequestSchema = new Schema({
  orderId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, immutable: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  items: { type: [returnItemSchema], required: true },
  message: { type: String, required: true, maxlength: 5000, immutable: true },
  status: { type: String, enum: ['requested', 'approved', 'rejected', 'received', 'closed'], required: true, default: 'requested' },
  active: { type: Boolean, required: true, default: true },
  previousFulfillmentStatus: { type: String, enum: ['delivered'], default: 'delivered', immutable: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  decisionReason: { type: String, maxlength: 1000 },
  inspectionEvidence: { type: String, maxlength: 500 },
  idempotencyKeyHash: { type: String, immutable: true, match: /^[a-f\d]{64}$/i },
  requestHash: { type: String, immutable: true, match: /^[a-f\d]{64}$/i },
  version: { type: Number, min: 0, required: true, default: 0 },
}, { timestamps: true, versionKey: false, strict: 'throw', collection: 'return_requests' });

returnRequestSchema.index({ orderId: 1 }, { unique: true, partialFilterExpression: { active: true }, name: 'return_requests_one_active_per_order' });
returnRequestSchema.index({ orderId: 1, idempotencyKeyHash: 1 }, { unique: true, partialFilterExpression: { idempotencyKeyHash: { $type: 'string' } }, name: 'return_requests_idempotency_unique' });
returnRequestSchema.index({ status: 1, createdAt: -1, _id: -1 }, { name: 'return_requests_queue_status' });
returnRequestSchema.index({ userId: 1, createdAt: -1 }, { name: 'return_requests_owner_created' });

const attachmentSchema = new Schema({
  storageKey: { type: String, required: true, immutable: true, maxlength: 500 },
  uploadedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null, immutable: true },
  guestOrderId: { type: Schema.Types.ObjectId, default: null, immutable: true },
  purpose: { type: String, enum: ['ticket', 'refund', 'review'], required: true, immutable: true },
  orderId: { type: Schema.Types.ObjectId, default: null, immutable: true },
  ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', default: null },
  reviewId: { type: Schema.Types.ObjectId, ref: 'Review', default: null },
  mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true, immutable: true },
  bytes: { type: Number, min: 1, max: 5242880, validate: Number.isSafeInteger, required: true, immutable: true },
  hash: { type: String, match: /^[a-f\d]{64}$/i },
  state: { type: String, enum: ['pending_upload', 'ready', 'rejected', 'linked'], required: true, default: 'pending_upload' },
  visibility: { type: String, enum: ['customer', 'internal'], required: true, default: 'customer', immutable: true },
  publicDerivativeUrl: { type: String, maxlength: 2048 },
  consentToPublishAt: { type: Date },
  expiresAt: { type: Date },
  version: { type: Number, min: 0, required: true, default: 0 },
}, { timestamps: true, versionKey: false, strict: 'throw', collection: 'attachments' });

attachmentSchema.index({ storageKey: 1 }, { unique: true, name: 'attachments_storage_key_unique' });
attachmentSchema.index({ uploadedByUserId: 1, createdAt: -1 }, { name: 'attachments_owner_created' });
attachmentSchema.index({ guestOrderId: 1, createdAt: -1 }, { name: 'attachments_guest_order_created' });
attachmentSchema.index({ state: 1, expiresAt: 1 }, { partialFilterExpression: { state: 'pending_upload' }, name: 'attachments_pending_expiry' });

export const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);
export const TicketMessage = mongoose.models.TicketMessage || mongoose.model('TicketMessage', ticketMessageSchema);
export const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);
export const ReturnRequest = mongoose.models.ReturnRequest || mongoose.model('ReturnRequest', returnRequestSchema);
export const SupportAttachment = mongoose.models.SupportAttachment || mongoose.model('SupportAttachment', attachmentSchema);

export const supportIndexes = Object.freeze({
  tickets: ['code_1', 'userId_1_createdAt_-1__id_-1', 'assignedTo_1_status_1_updatedAt_-1', 'status_1_kind_1_createdAt_-1__id_-1'],
  ticket_messages: ['ticketId_1_createdAt_1__id_1'],
  contacts: ['status_1_createdAt_-1__id_-1', 'assignedTo_1_status_1_createdAt_-1'],
  return_requests: ['orderId_1_unique_partial_active', 'orderId_1_idempotencyKeyHash_1_unique', 'status_1_createdAt_-1__id_-1', 'userId_1_createdAt_-1'],
  attachments: ['storageKey_1_unique', 'uploadedByUserId_1_createdAt_-1', 'guestOrderId_1_createdAt_-1', 'state_1_expiresAt_1_pending'],
});
