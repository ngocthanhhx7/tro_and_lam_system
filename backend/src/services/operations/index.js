import { operationsModels } from '../../models/operations/index.js';
import { createAuditService } from './audit.service.js';
import { createOutboxService } from './outbox.service.js';

const IDENTITY_ROLES = new Set(['customer', 'staff', 'admin']);
const IDENTITY_STATUSES = new Set(['active', 'blocked']);
const IDENTITY_DECISIONS = new Set(['approved', 'rejected']);

function requiredMailText(data, key, template) {
  const value = data?.[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Identity mail ${template} requires a valid ${key}`);
  }
  return value;
}

function optionalMailText(data, key, template) {
  const value = data?.[key];
  if (value === undefined) return {};
  if (typeof value !== 'string' || value.length > 120 || /[\r\n]/.test(value)) {
    throw new TypeError(`Identity mail ${template} has an invalid ${key}`);
  }
  return { [key]: value };
}

function identityMail(template, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('Mail data must be an object');
  }
  if (template === 'order-confirmation') {
    return { template: 'order_confirmation', data: { orderCode: requiredMailText(data, 'orderCode', template) } };
  }
  if (template === 'guest-order-access-code') {
    const verificationCode = requiredMailText(data, 'verificationCode', template);
    if (!/^\d{6}$/.test(verificationCode)) throw new TypeError('Commerce order access code is invalid');
    return { template: 'order_access_code', data: { code: verificationCode } };
  }
  if (template === 'verify-email' || template === 'reset-password') {
    const name = optionalMailText(data, 'name', template);
    return {
      template: template === 'verify-email' ? 'verify_email' : 'reset_password',
      data: { actionUrl: requiredMailText(data, 'link', template), ...name },
    };
  }
  if (template === 'user-invitation') {
    const name = optionalMailText(data, 'name', template);
    const role = data.role;
    if (role !== undefined && !IDENTITY_ROLES.has(role)) throw new TypeError('Identity invitation role is invalid');
    return {
      template: 'user_invitation',
      data: { actionUrl: requiredMailText(data, 'link', template), ...name, ...(role === undefined ? {} : { role }) },
    };
  }
  if (template === 'appeal-access-code') {
    const name = optionalMailText(data, 'name', template);
    const verificationCode = requiredMailText(data, 'verificationCode', template);
    const expiresAt = requiredMailText(data, 'expiresAt', template);
    const validExpiry = new Date(expiresAt);
    if (!/^\d{6}$/.test(verificationCode) || !Number.isFinite(validExpiry.getTime()) || validExpiry.toISOString() !== expiresAt) {
      throw new TypeError('Identity appeal access code is invalid');
    }
    return { template: 'appeal_access_code', data: { ...name, verificationCode, expiresAt } };
  }
  if (template === 'appeal-decision') {
    const name = optionalMailText(data, 'name', template);
    const decision = requiredMailText(data, 'decision', template);
    const reviewNote = requiredMailText(data, 'reviewNote', template);
    if (!IDENTITY_DECISIONS.has(decision)) throw new TypeError('Identity appeal decision is invalid');
    return { template: 'appeal_update', data: { ...name, appealStatus: decision, reviewNote } };
  }
  if (template === 'account-status-update') {
    const name = optionalMailText(data, 'name', template);
    const role = requiredMailText(data, 'role', template);
    const status = requiredMailText(data, 'status', template);
    if (!IDENTITY_ROLES.has(role) || !IDENTITY_STATUSES.has(status)) throw new TypeError('Identity account status is invalid');
    return { template: 'account_status_update', data: { ...name, role, status } };
  }
  return { template, data };
}

/** Compose the frozen P09 ports for callers such as P02/P05/P06/P07/P08. */
export function createOperationsPorts({
  models = operationsModels,
  encryptMailPayload,
  now,
  uuid,
} = {}) {
  const audit = createAuditService({ AuditLog: models.AuditLog, now });
  const outbox = createOutboxService({ OutboxEvent: models.OutboxEvent, encryptMailPayload, uuid });
  const auditPort = Object.freeze({ append: audit.append, appendAudit: audit.append });
  const enqueueMail = (template, recipient, data, options) => {
    const mapped = identityMail(template, data);
    return outbox.enqueueMail(mapped.template, recipient, mapped.data, options);
  };
  const outboxPort = Object.freeze({ appendOutbox: outbox.appendOutbox, enqueueMail });
  return Object.freeze({
    appendOutbox: (event, options) => outbox.appendOutbox(event, options),
    appendAudit: (event, options) => audit.append(event, options),
    enqueueMail,
    audit: auditPort,
    outbox: outboxPort,
  });
}

export { createAuditService } from './audit.service.js';
export { createBusinessSettingsService } from './business-settings.service.js';
export { createDashboardService } from './dashboard.service.js';
export { createNotificationService } from './notification.service.js';
export { createOutboxService } from './outbox.service.js';
export { createOutboxPayloadCipher } from './outbox-payload-cipher.js';
