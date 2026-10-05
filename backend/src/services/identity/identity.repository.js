import mongoose from 'mongoose';
import { AccountAppeal } from '../../models/identity/account-appeal.model.js';
import { AuthChallenge } from '../../models/identity/auth-challenge.model.js';
import { IdentityGuard } from '../../models/identity/identity-guard.model.js';
import { RestrictedProof } from '../../models/identity/restricted-proof.model.js';
import { AuthSession } from '../../models/identity/session.model.js';
import { User } from '../../models/identity/user.model.js';

function publicUserFilter() {
  return '-passwordHash';
}

function safeRegex(value = '') {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

export class IdentityRepository {
  constructor(models = {}) {
    this.models = {
      User: models.User || User,
      AuthSession: models.AuthSession || AuthSession,
      AuthChallenge: models.AuthChallenge || AuthChallenge,
      RestrictedProof: models.RestrictedProof || RestrictedProof,
      AccountAppeal: models.AccountAppeal || AccountAppeal,
      IdentityGuard: models.IdentityGuard || IdentityGuard,
    };
  }

  async transaction(callback) {
    return mongoose.connection.transaction(callback);
  }

  async findUserByEmail(emailNormalized, { session, includePassword = false } = {}) {
    let query = this.models.User.findOne({ emailNormalized });
    if (includePassword) query = query.select('+passwordHash');
    else query = query.select(publicUserFilter());
    if (session) query = query.session(session);
    return query.exec();
  }

  async findUserById(id, { session, includePassword = false } = {}) {
    let query = this.models.User.findById(id);
    if (includePassword) query = query.select('+passwordHash');
    else query = query.select(publicUserFilter());
    if (session) query = query.session(session);
    return query.exec();
  }

  async createUser(data, { session } = {}) {
    const [user] = await this.models.User.create([data], { session });
    return user;
  }

  async updateUser(id, expectedVersion, changes, { session } = {}) {
    const set = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
    const unset = Object.fromEntries(Object.entries(changes).filter(([, value]) => value === undefined).map(([key]) => [key, 1]));
    const update = { $inc: { version: 1 } };
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    return this.models.User.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      update,
      { new: true, runValidators: true, session },
    ).select(publicUserFilter()).exec();
  }

  async updateUserPassword(id, passwordHash, { session } = {}) {
    const user = await this.models.User.findById(id).select('+passwordHash').session(session || null).exec();
    if (!user) return null;
    user.passwordHash = passwordHash;
    user.authVersion += 1;
    user.version += 1;
    await user.save({ session });
    return user;
  }

  async createSession(data, { session } = {}) {
    const [record] = await this.models.AuthSession.create([data], { session });
    return record;
  }

  async findSession(tokenHash, { session } = {}) {
    return this.models.AuthSession.findOne({ tokenHash }).session(session || null).exec();
  }

  async updateSession(id, changes, { session } = {}) {
    return this.models.AuthSession.findByIdAndUpdate(id, { $set: changes }, { new: true, session }).exec();
  }

  async revokeSessions(userId, now, { session } = {}) {
    return this.models.AuthSession.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: now } }, { session }).exec();
  }

  async createChallenge(data, { session } = {}) {
    const [record] = await this.models.AuthChallenge.create([data], { session });
    return record;
  }

  async findChallenge(tokenHash, { session } = {}) {
    return this.models.AuthChallenge.findOne({ tokenHash }).session(session || null).exec();
  }

  async consumeChallenge(id, now, { session } = {}) {
    const result = await this.models.AuthChallenge.updateOne(
      { _id: id, consumedAt: null, expiresAt: { $gt: now }, attempts: { $lt: 5 } },
      { $set: { consumedAt: now } },
      { session },
    ).exec();
    return result.modifiedCount === 1;
  }

  async incrementChallengeAttempts(id, { session } = {}) {
    return this.models.AuthChallenge.updateOne({ _id: id, consumedAt: null }, { $inc: { attempts: 1 } }, { session }).exec();
  }

  async createRestrictedProof(data, { session } = {}) {
    const [record] = await this.models.RestrictedProof.create([data], { session });
    return record;
  }

  async findRestrictedProof(tokenHash, { session } = {}) {
    return this.models.RestrictedProof.findOne({ tokenHash }).session(session || null).exec();
  }

  async revokeRestrictedProofs(userId, purpose, now, { session } = {}) {
    return this.models.RestrictedProof.updateMany(
      { userId, purpose, revokedAt: null },
      { $set: { revokedAt: now } },
      { session },
    ).exec();
  }

  async findPendingAppeal(userId, { session } = {}) {
    return this.models.AccountAppeal.findOne({ userId, status: 'pending' }).session(session || null).exec();
  }

  async findLatestAppeal(userId, { session } = {}) {
    return this.models.AccountAppeal.findOne({ userId }).sort({ createdAt: -1, _id: -1 }).session(session || null).exec();
  }

  async findAppealById(id, { session } = {}) {
    return this.models.AccountAppeal.findById(id).session(session || null).exec();
  }

  async createAppeal(data, { session } = {}) {
    const [record] = await this.models.AccountAppeal.create([data], { session });
    return record;
  }

  async updateAppeal(id, expectedVersion, changes, { session } = {}) {
    return this.models.AccountAppeal.findOneAndUpdate(
      { _id: id, version: expectedVersion, status: 'pending' },
      { $set: changes, $inc: { version: 1 } },
      { new: true, runValidators: true, session },
    ).exec();
  }

  async listAppeals({ status, page = 1, limit = 20 } = {}, { session } = {}) {
    const filter = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.models.AccountAppeal.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).session(session || null).lean().exec(),
      this.models.AccountAppeal.countDocuments(filter).session(session || null).exec(),
    ]);
    return { items, total };
  }

  async listUsers({ q, role, status, page = 1, limit = 20 } = {}, { session } = {}) {
    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (q) {
      const matcher = safeRegex(q);
      filter.$or = [{ name: matcher }, { emailNormalized: matcher }];
    }
    const [items, total] = await Promise.all([
      this.models.User.find(filter).select(publicUserFilter()).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).session(session || null).lean().exec(),
      this.models.User.countDocuments(filter).session(session || null).exec(),
    ]);
    return { items, total };
  }

  async ensureAdminGuard() {
    try {
      await this.models.IdentityGuard.updateOne({ key: 'active-admins' }, { $setOnInsert: { version: 0 } }, { upsert: true });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }

  async lockAdminGuard({ session } = {}) {
    await this.ensureAdminGuard();
    return this.models.IdentityGuard.findOneAndUpdate(
      { key: 'active-admins' },
      { $inc: { version: 1 } },
      { new: true, session },
    ).exec();
  }

  async countActiveAdmins({ session } = {}) {
    return this.models.User.countDocuments({ role: 'admin', status: 'active' }).session(session || null).exec();
  }
}
