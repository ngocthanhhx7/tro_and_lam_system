import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, default: null, immutable: true },
  actorRole: { type: String, default: null, trim: true, maxlength: 24, immutable: true },
  requestId: { type: String, required: true, trim: true, maxlength: 120, immutable: true },
  action: { type: String, required: true, trim: true, maxlength: 100, immutable: true },
  targetType: { type: String, required: true, trim: true, maxlength: 80, immutable: true },
  targetId: { type: String, default: null, trim: true, maxlength: 120, immutable: true },
  outcome: { type: String, required: true, trim: true, maxlength: 24, immutable: true },
  reasonCode: { type: String, default: null, trim: true, maxlength: 80, immutable: true },
  changesRedacted: { type: mongoose.Schema.Types.Mixed, default: null, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs', versionKey: false });

auditLogSchema.index({ createdAt: -1, _id: -1 }, { name: 'audit_created' });
auditLogSchema.index({ actorId: 1, createdAt: -1, _id: -1 }, { name: 'audit_actor_created' });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1, _id: -1 }, { name: 'audit_target_created' });
auditLogSchema.index({ requestId: 1 }, { name: 'audit_request_id' });

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
