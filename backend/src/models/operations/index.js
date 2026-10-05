export { Notification } from './notification.model.js';
export { OutboxEvent } from './outbox-event.model.js';
export { AuditLog } from './audit-log.model.js';
export { BusinessSetting } from './business-setting.model.js';

import { AuditLog } from './audit-log.model.js';
import { BusinessSetting } from './business-setting.model.js';
import { Notification } from './notification.model.js';
import { OutboxEvent } from './outbox-event.model.js';

export const operationsModels = Object.freeze({ Notification, OutboxEvent, AuditLog, BusinessSetting });

/**
 * Explicit, additive index build for the operations collections. This creates
 * indexes declared by the schemas and never drops or rewrites existing indexes.
 */
export async function ensureOperationsIndexes(models = operationsModels) {
  for (const model of Object.values(models)) await model.createIndexes();
}
