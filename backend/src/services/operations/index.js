import { operationsModels } from '../../models/operations/index.js';
import { createAuditService } from './audit.service.js';
import { createOutboxService } from './outbox.service.js';

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
  return Object.freeze({
    appendOutbox: (event, options) => outbox.appendOutbox(event, options),
    appendAudit: (event, options) => audit.append(event, options),
    enqueueMail: (template, recipient, data, options) => outbox.enqueueMail(template, recipient, data, options),
    audit: auditPort,
    outbox,
  });
}

export { createAuditService } from './audit.service.js';
export { createBusinessSettingsService } from './business-settings.service.js';
export { createDashboardService } from './dashboard.service.js';
export { createNotificationService } from './notification.service.js';
export { createOutboxService } from './outbox.service.js';
export { createOutboxPayloadCipher } from './outbox-payload-cipher.js';
