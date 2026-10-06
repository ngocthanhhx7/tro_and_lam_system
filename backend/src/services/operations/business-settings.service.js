import { BusinessSetting as DefaultBusinessSetting } from '../../models/operations/business-setting.model.js';
import { conflict, unavailable } from '../../utils/serviceError.js';
import { sanitizeBusinessSettingsValues, validateBusinessSettingsWrite } from '../../validators/operations.validator.js';

const SETTINGS_KEY = 'business';

function withSession(query, session) {
  return session && typeof query?.session === 'function' ? query.session(session) : query;
}

function settingDto(row) {
  if (!row) return { values: {}, version: 0, updatedAt: null };
  const value = typeof row.toObject === 'function' ? row.toObject() : row;
  return { values: sanitizeBusinessSettingsValues(value.values || {}), version: value.version || 0, updatedAt: value.updatedAt || null };
}

export function createBusinessSettingsService({
  BusinessSetting = DefaultBusinessSetting,
  auditService,
  startSession = () => BusinessSetting.db.startSession(),
  now = () => new Date(),
} = {}) {
  async function get() {
    const row = await BusinessSetting.findOne({ key: SETTINGS_KEY }).lean();
    return settingDto(row);
  }

  async function update(body, { actorId, requestId, session } = {}) {
    const input = validateBusinessSettingsWrite(body);
    if (!auditService || typeof auditService.append !== 'function') {
      throw unavailable('DATABASE_UNAVAILABLE', 'Audit service chưa được cấu hình');
    }

    let ownSession = null;
    const transactionSession = session || (ownSession = await startSession());
    let result;
    try {
      await transactionSession.withTransaction(async () => {
        const current = await withSession(BusinessSetting.findOne({ key: SETTINGS_KEY }), transactionSession);
        const currentPlain = current ? (typeof current.toObject === 'function' ? current.toObject() : current) : null;
        const currentVersion = currentPlain?.version ?? 0;
        if (currentVersion !== input.expectedVersion) throw conflict('VERSION_CONFLICT', 'Business settings đã được cập nhật. Tải lại rồi thử lại.');
        const currentValues = sanitizeBusinessSettingsValues(currentPlain?.values || {});
        const values = { ...currentValues, ...input.values };
        let updated;
        try {
          updated = await withSession(BusinessSetting.findOneAndUpdate(
            { key: SETTINGS_KEY, version: input.expectedVersion },
            {
              $set: { values, updatedBy: actorId || null, updatedAt: now() },
              $setOnInsert: { key: SETTINGS_KEY },
              $inc: { version: 1 },
            },
            { upsert: input.expectedVersion === 0, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true, session: transactionSession },
          ), transactionSession);
        } catch (error) {
          if (error?.code === 11000) throw conflict('VERSION_CONFLICT', 'Business settings đã được cập nhật. Tải lại rồi thử lại.');
          throw error;
        }
        if (!updated) throw conflict('VERSION_CONFLICT', 'Business settings đã được cập nhật. Tải lại rồi thử lại.');
        const updatedPlain = typeof updated.toObject === 'function' ? updated.toObject() : updated;
        await auditService.append({
          actorId,
          actorRole: 'admin',
          requestId: requestId || `settings:${updatedPlain.version}`,
          action: 'settings.business.update',
          targetType: 'settings',
          targetId: SETTINGS_KEY,
          outcome: 'success',
          reasonCode: 'ADMIN_REASON_RECORDED',
          changesRedacted: {
            before: Object.fromEntries(Object.keys(input.values).map((key) => [key, currentValues[key] ?? null])),
            after: input.values,
            reason: input.reason,
            version: updatedPlain.version,
          },
        }, { session: transactionSession });
        result = settingDto(updatedPlain);
      });
    } finally {
      if (ownSession) await ownSession.endSession();
    }
    return result;
  }

  return Object.freeze({ get, update });
}
