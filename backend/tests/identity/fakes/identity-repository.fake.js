const keyOf = (value) => String(value?._id ?? value?.id ?? value);
const copy = (value) => structuredClone(value);

export class FakeIdentityRepository {
  constructor() {
    this.users = [];
    this.sessions = [];
    this.challenges = [];
    this.proofs = [];
    this.appeals = [];
    this.sequence = 1;
    this.tail = Promise.resolve();
  }

  nextId() { return (this.sequence++).toString(16).padStart(24, '0'); }

  async transaction(callback) {
    let release;
    const prior = this.tail;
    this.tail = new Promise((resolve) => { release = resolve; });
    await prior;
    const snapshot = copy({ users: this.users, sessions: this.sessions, challenges: this.challenges, proofs: this.proofs, appeals: this.appeals, sequence: this.sequence });
    try {
      return await callback({ fakeSession: true });
    } catch (error) {
      Object.assign(this, snapshot);
      throw error;
    } finally {
      release();
    }
  }

  async findUserByEmail(emailNormalized) {
    const user = this.users.find((item) => item.emailNormalized === emailNormalized);
    return user ? copy(user) : null;
  }

  async findUserById(id) {
    const user = this.users.find((item) => keyOf(item) === keyOf(id));
    return user ? copy(user) : null;
  }

  async createUser(data) {
    if (this.users.some((user) => user.emailNormalized === data.emailNormalized)) throw Object.assign(new Error('duplicate email'), { code: 11000 });
    const now = new Date();
    const user = { _id: this.nextId(), ...copy(data), createdAt: now, updatedAt: now };
    this.users.push(user);
    return copy(user);
  }

  async updateUser(id, expectedVersion, changes) {
    const user = this.users.find((item) => keyOf(item) === keyOf(id));
    if (!user || user.version !== expectedVersion) return null;
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) delete user[key];
      else user[key] = copy(value);
    }
    user.version += 1;
    user.updatedAt = new Date();
    return copy(user);
  }

  async updateUserPassword(id, passwordHash) {
    const user = this.users.find((item) => keyOf(item) === keyOf(id));
    if (!user) return null;
    user.passwordHash = passwordHash;
    user.authVersion += 1;
    user.version += 1;
    return copy(user);
  }

  async createSession(data) {
    const session = { _id: this.nextId(), ...copy(data) };
    this.sessions.push(session);
    return copy(session);
  }

  async findSession(tokenHash) {
    const session = this.sessions.find((item) => item.tokenHash === tokenHash);
    return session ? copy(session) : null;
  }

  async updateSession(id, changes) {
    const session = this.sessions.find((item) => keyOf(item) === keyOf(id));
    if (!session) return null;
    Object.assign(session, copy(changes));
    return copy(session);
  }

  async revokeSessions(userId, now) {
    for (const session of this.sessions) if (keyOf(session.userId) === keyOf(userId) && !session.revokedAt) session.revokedAt = copy(now);
  }

  async createChallenge(data) {
    if (this.challenges.some((item) => item.tokenHash === data.tokenHash)) throw Object.assign(new Error('duplicate challenge'), { code: 11000 });
    const challenge = { _id: this.nextId(), ...copy(data), consumedAt: null };
    this.challenges.push(challenge);
    return copy(challenge);
  }

  async findChallenge(tokenHash) {
    const challenge = this.challenges.find((item) => item.tokenHash === tokenHash);
    return challenge ? copy(challenge) : null;
  }

  async consumeChallenge(id, now) {
    const challenge = this.challenges.find((item) => keyOf(item) === keyOf(id));
    if (!challenge || challenge.consumedAt || new Date(challenge.expiresAt) <= new Date(now) || challenge.attempts >= 5) return false;
    challenge.consumedAt = copy(now);
    return true;
  }

  async incrementChallengeAttempts(id) {
    const challenge = this.challenges.find((item) => keyOf(item) === keyOf(id));
    if (challenge && !challenge.consumedAt) challenge.attempts += 1;
  }

  async createRestrictedProof(data) {
    const proof = { _id: this.nextId(), revokedAt: null, ...copy(data) };
    this.proofs.push(proof);
    return copy(proof);
  }

  async findRestrictedProof(tokenHash) {
    const proof = this.proofs.find((item) => item.tokenHash === tokenHash);
    return proof ? copy(proof) : null;
  }

  async revokeRestrictedProofs(userId, purpose, now) {
    for (const proof of this.proofs) if (keyOf(proof.userId) === keyOf(userId) && proof.purpose === purpose && !proof.revokedAt) proof.revokedAt = copy(now);
  }

  async revokeGuestOrderProofs(orderId, now) {
    for (const proof of this.proofs) {
      if (keyOf(proof.orderId) === keyOf(orderId) && proof.purpose === 'guest_order_access' && !proof.revokedAt) proof.revokedAt = copy(now);
    }
  }

  async findPendingAppeal(userId) {
    const appeal = this.appeals.find((item) => keyOf(item.userId) === keyOf(userId) && item.status === 'pending');
    return appeal ? copy(appeal) : null;
  }

  async findLatestAppeal(userId) {
    const appeal = this.appeals.filter((item) => keyOf(item.userId) === keyOf(userId)).at(-1);
    return appeal ? copy(appeal) : null;
  }

  async findAppealById(id) {
    const appeal = this.appeals.find((item) => keyOf(item) === keyOf(id));
    return appeal ? copy(appeal) : null;
  }

  async createAppeal(data) {
    if (this.appeals.some((item) => keyOf(item.userId) === keyOf(data.userId) && item.status === 'pending')) throw Object.assign(new Error('duplicate pending appeal'), { code: 11000 });
    const now = new Date();
    const appeal = { _id: this.nextId(), ...copy(data), createdAt: now, updatedAt: now };
    this.appeals.push(appeal);
    return copy(appeal);
  }

  async updateAppeal(id, expectedVersion, changes) {
    const appeal = this.appeals.find((item) => keyOf(item) === keyOf(id));
    if (!appeal || appeal.version !== expectedVersion || appeal.status !== 'pending') return null;
    Object.assign(appeal, copy(changes));
    appeal.version += 1;
    return copy(appeal);
  }

  async listAppeals({ status, page = 1, limit = 20 } = {}) {
    const filtered = this.appeals.filter((item) => !status || item.status === status).slice().reverse();
    return { items: copy(filtered.slice((page - 1) * limit, page * limit)), total: filtered.length };
  }

  async listUsers({ q, role, status, page = 1, limit = 20 } = {}) {
    const matcher = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const filtered = this.users.filter((user) => (!role || user.role === role) && (!status || user.status === status)
      && (!matcher || matcher.test(user.name) || matcher.test(user.emailNormalized))).slice().reverse();
    return { items: copy(filtered.slice((page - 1) * limit, page * limit)), total: filtered.length };
  }

  async ensureAdminGuard() {}
  async lockAdminGuard() {}
  async countActiveAdmins() { return this.users.filter((user) => user.role === 'admin' && user.status === 'active').length; }
}
