import mongoose from 'mongoose';
import { AuditLog } from '../../models/operations/audit-log.model.js';
import { IdentityGuard } from '../../models/identity/identity-guard.model.js';
import { User } from '../../models/identity/user.model.js';
import { hashPassword } from './identity.security.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function bootstrapError(code, message) {
  return Object.assign(new Error(message), { code });
}

function normalizedEmail(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : '';
}

async function ensureAdminGuard(Guard) {
  try {
    await Guard.updateOne(
      { key: 'active-admins' },
      { $setOnInsert: { version: 0 } },
      { upsert: true },
    ).exec();
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
}

export async function bootstrapFirstAdmin({
  name,
  email,
  password,
  confirmedDatabaseName,
  confirmedEmail,
  models = {},
  connection = mongoose.connection,
  now = () => new Date(),
} = {}) {
  const UserModel = models.User || User;
  const GuardModel = models.IdentityGuard || IdentityGuard;
  const AuditModel = models.AuditLog || AuditLog;
  const databaseName = connection.name;
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const emailNormalized = normalizedEmail(email);

  if (!databaseName || confirmedDatabaseName !== databaseName) {
    throw bootstrapError('BOOTSTRAP_CONFIRMATION_REQUIRED', 'Confirm the exact connected database before bootstrapping.');
  }
  if (!cleanName || cleanName.length > 120 || !EMAIL_PATTERN.test(emailNormalized) || emailNormalized.length > 254) {
    throw bootstrapError('BOOTSTRAP_INPUT_INVALID', 'Bootstrap name or email is invalid.');
  }
  if (confirmedEmail !== emailNormalized) {
    throw bootstrapError('BOOTSTRAP_CONFIRMATION_REQUIRED', 'Confirm control of the exact administrator email before bootstrapping.');
  }
  if (typeof password !== 'string' || password.trim().length < 12 || password.length > 128 || /[\r\n]/u.test(password)) {
    throw bootstrapError('BOOTSTRAP_INPUT_INVALID', 'Bootstrap password does not meet the account password requirements.');
  }

  await Promise.all([UserModel.createIndexes(), GuardModel.createIndexes(), AuditModel.createIndexes()]);
  await ensureAdminGuard(GuardModel);

  const passwordHash = await hashPassword(password);
  const timestamp = new Date(now());
  if (!Number.isFinite(timestamp.getTime())) throw new TypeError('Bootstrap clock must return a valid date.');

  return connection.transaction(async (session) => {
    await GuardModel.findOneAndUpdate(
      { key: 'active-admins' },
      { $inc: { version: 1 } },
      { returnDocument: 'after', session },
    ).exec();

    const existingAdmins = await UserModel.countDocuments({ role: 'admin' }).session(session).exec();
    if (existingAdmins > 0) {
      throw bootstrapError('ADMIN_ALREADY_BOOTSTRAPPED', 'An administrator account already exists; use the authenticated admin workflow.');
    }

    const [user] = await UserModel.create([{
      name: cleanName,
      emailNormalized,
      passwordHash,
      role: 'admin',
      status: 'active',
      emailVerifiedAt: timestamp,
      authVersion: 0,
      version: 0,
    }], { session });

    const requestId = `admin-bootstrap:${String(user._id)}`;
    await AuditModel.create([{
      actorId: null,
      actorRole: 'system',
      requestId,
      action: 'identity.admin.bootstrap',
      targetType: 'user',
      targetId: String(user._id),
      outcome: 'success',
      reasonCode: 'OWNER_BOOTSTRAP',
      changesRedacted: { role: { before: null, after: 'admin' }, status: { before: null, after: 'active' } },
    }], { session });

    return Object.freeze({ userId: String(user._id), emailNormalized, role: user.role, status: user.status });
  });
}
