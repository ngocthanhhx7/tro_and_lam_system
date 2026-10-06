import { ServiceError } from '../../utils/serviceError.js';
import { IdentityRepository } from './identity.repository.js';
import {
  challengeCode,
  constantTimeEqual,
  hashPassword,
  hashToken,
  opaqueToken,
  shortChallengeId,
  verifyPassword,
} from './identity.security.js';

const APPEAL_SCOPES = Object.freeze(['appeal.submit', 'appeal.read']);
const GUEST_ORDER_SCOPES = Object.freeze([
  'guest.order.read', 'guest.order.cancel', 'guest.payment.create', 'guest.ticket.create', 'guest.return.request',
]);
const GENERIC_AUTH_ERROR = Object.freeze({ status: 401, code: 'AUTH_REQUIRED', message: 'Email hoặc mật khẩu chưa chính xác' });

const asId = (value) => String(value?._id ?? value?.id ?? value);
const emailNormalized = (email) => email.normalize('NFKC').trim().toLowerCase();
const publicUser = (user) => ({
  id: asId(user),
  name: user.name,
  email: user.emailNormalized,
  ...(user.phone ? { phone: user.phone } : {}),
  role: user.role,
  status: user.status,
  ...(user.emailVerifiedAt ? { emailVerifiedAt: new Date(user.emailVerifiedAt).toISOString() } : {}),
  version: user.version,
});

function safeDate(value) {
  return value ? new Date(value).toISOString() : undefined;
}

function redactReason(value) {
  return value.trim().replace(/\p{Cc}+/gu, ' ').slice(0, 1000)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[email]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/gu, '[phone]');
}

function linkWithFragment(publicWebUrl, path, key, value) {
  let url;
  try {
    url = new URL(path, publicWebUrl);
  } catch {
    throw new ServiceError(503, 'MAIL_UNAVAILABLE', 'Email chưa được cấu hình');
  }
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new ServiceError(503, 'MAIL_UNAVAILABLE', 'Email chưa được cấu hình');
  }
  url.hash = new URLSearchParams({ [key]: value }).toString();
  return url.toString();
}

export function createIdentityService({ ports = {}, config = {} } = {}) {
  const repository = ports.repository || new IdentityRepository(ports.models);
  const now = () => new Date(typeof ports.clock?.now === 'function' ? ports.clock.now() : Date.now());
  const duration = (key, fallback) => Number.isFinite(config[key]) && config[key] > 0 ? config[key] : fallback;
  const sessionTtlMs = duration('sessionTtlMs', 30 * 24 * 60 * 60 * 1000);
  const appealProofTtlMs = duration('appealProofTtlMs', 15 * 60 * 1000);
  const resetTtlMs = duration('resetTtlMs', 60 * 60 * 1000);
  const verifyTtlMs = duration('verifyTtlMs', 24 * 60 * 60 * 1000);
  const inviteTtlMs = duration('inviteTtlMs', 24 * 60 * 60 * 1000);
  const appealChallengeTtlMs = duration('appealChallengeTtlMs', 10 * 60 * 1000);
  const maxChallengeAttempts = 5;

  function requireOutbox() {
    if (typeof ports.outbox?.enqueueMail !== 'function') {
      throw new ServiceError(503, 'MAIL_UNAVAILABLE', 'Email tạm thời chưa sẵn sàng');
    }
  }

  async function queueMail(template, to, variables, session) {
    requireOutbox();
    return ports.outbox.enqueueMail(template, to, variables, { session });
  }

  async function appendAudit(event, session) {
    if (typeof ports.audit?.appendAudit !== 'function') {
      throw new ServiceError(503, 'DATABASE_UNAVAILABLE', 'Dịch vụ ghi nhận thay đổi chưa sẵn sàng');
    }
    return ports.audit.appendAudit(event, { session });
  }

  async function assertAdminActor(actor, session) {
    const current = await repository.findUserById(actor.id, { session });
    if (!current || current.status !== 'active' || current.role !== 'admin' || current.authVersion !== actor.authVersion) {
      throw new ServiceError(403, 'FORBIDDEN', 'Phiên quản trị không còn hiệu lực');
    }
    return current;
  }

  async function createTokenChallenge({ purpose, user, invitedRole, ttlMs, template, templateVariables = {} }, session) {
    const token = opaqueToken();
    const createdAt = now();
    const expiresAt = new Date(createdAt.getTime() + ttlMs);
    await repository.createChallenge({
      purpose,
      ...(user ? { userId: user._id ?? user.id } : {}),
      ...(invitedRole ? { invitedRole } : {}),
      tokenHash: hashToken(token),
      expiresAt,
      attempts: 0,
    }, { session });
    const link = linkWithFragment(config.publicWebUrl, templateVariables.path, 'token', token);
    await queueMail(template, user.emailNormalized, { ...templateVariables, link }, session);
    return { expiresAt };
  }

  async function issueSession(user, session) {
    const token = opaqueToken();
    const createdAt = now();
    const expiresAt = new Date(createdAt.getTime() + sessionTtlMs);
    await repository.createSession({
      userId: user._id ?? user.id,
      tokenHash: hashToken(token),
      authVersion: user.authVersion,
      expiresAt,
      lastSeenAt: createdAt,
    }, { session });
    return { token, expiresAt };
  }

  async function issueAppealProof(user, session) {
    const token = opaqueToken();
    const issuedAt = now();
    const expiresAt = new Date(issuedAt.getTime() + appealProofTtlMs);
    await repository.revokeRestrictedProofs(user._id ?? user.id, 'appeal_access', issuedAt, { session });
    await repository.createRestrictedProof({
      purpose: 'appeal_access',
      scopes: [...APPEAL_SCOPES],
      userId: user._id ?? user.id,
      tokenHash: hashToken(token),
      expiresAt,
      issuedAt,
      identityVerifiedAt: issuedAt,
      authVersion: user.authVersion,
    }, { session });
    return { token, expiresAt };
  }

  async function register(input) {
    requireOutbox();
    const email = emailNormalized(input.email);
    const passwordHash = await hashPassword(input.password);
    try {
      await repository.transaction(async (session) => {
      const exists = await repository.findUserByEmail(email, { session });
      if (exists) return { duplicate: true };
      const user = await repository.createUser({
        name: input.name.trim(),
        emailNormalized: email,
        ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
        passwordHash,
        role: 'customer',
        status: 'active',
        authVersion: 0,
        version: 0,
      }, { session });
      await createTokenChallenge({
        purpose: 'verify_email',
        user,
        ttlMs: verifyTtlMs,
        template: 'verify-email',
        templateVariables: { path: '/xac-minh-email', name: user.name },
      }, session);
      });
    } catch (error) {
      if (error?.code === 11000) return { verificationRequired: true };
      throw error;
    }
    // An email collision races a concurrent registration. Roll back and return the same acknowledgment.
    return { verificationRequired: true };
  }

  async function acceptInvitation(input) {
    const tokenHash = hashToken(input.token);
    const result = await repository.transaction(async (session) => {
      const challenge = await repository.findChallenge(tokenHash, { session });
      const currentTime = now();
      if (!challenge || challenge.purpose !== 'invite_user' || challenge.consumedAt || new Date(challenge.expiresAt) <= currentTime) {
        throw new ServiceError(410, 'LINK_EXPIRED', 'Liên kết mời đã hết hạn hoặc đã được sử dụng');
      }
      const user = await repository.findUserById(challenge.userId, { session });
      if (!user || user.status !== 'active' || user.role !== challenge.invitedRole) {
        throw new ServiceError(410, 'LINK_EXPIRED', 'Liên kết mời đã hết hạn hoặc đã được sử dụng');
      }
      if (!await repository.consumeChallenge(challenge._id ?? challenge.id, currentTime, { session })) {
        throw new ServiceError(410, 'LINK_EXPIRED', 'Liên kết mời đã hết hạn hoặc đã được sử dụng');
      }
      const updated = await repository.updateUser(user._id ?? user.id, user.version, {
        name: input.name.trim(), passwordHash: await hashPassword(input.password),
        emailVerifiedAt: currentTime, authVersion: user.authVersion + 1,
      }, { session });
      if (!updated) throw new ServiceError(409, 'VERSION_CONFLICT', 'Tài khoản đã thay đổi');
      const issued = await issueSession(updated, session);
      return { user: updated, session: issued };
    });
    return { user: publicUser(result.user), sessionToken: result.session.token, sessionExpiresAt: result.session.expiresAt };
  }

  async function verifyEmail(token) {
    const tokenHash = hashToken(token);
    return repository.transaction(async (session) => {
      const challenge = await repository.findChallenge(tokenHash, { session });
      const currentTime = now();
      if (!challenge || challenge.purpose !== 'verify_email') {
        throw new ServiceError(410, 'LINK_EXPIRED', 'Liên kết xác minh đã hết hạn hoặc đã được sử dụng');
      }
      const user = await repository.findUserById(challenge.userId, { session });
      if (!user || user.status !== 'active') throw new ServiceError(410, 'LINK_EXPIRED', 'Liên kết xác minh đã hết hạn');
      if (user.emailVerifiedAt) return { verified: true };
      if (challenge.consumedAt || new Date(challenge.expiresAt) <= currentTime) {
        throw new ServiceError(410, 'LINK_EXPIRED', 'Liên kết xác minh đã hết hạn hoặc đã được sử dụng');
      }
      if (!await repository.consumeChallenge(challenge._id ?? challenge.id, currentTime, { session })) {
        throw new ServiceError(410, 'LINK_EXPIRED', 'Liên kết xác minh đã hết hạn hoặc đã được sử dụng');
      }
      const updated = await repository.updateUser(user._id ?? user.id, user.version, {
        emailVerifiedAt: currentTime,
      }, { session });
      if (!updated) throw new ServiceError(409, 'VERSION_CONFLICT', 'Tài khoản đã thay đổi');
      return { verified: true };
    });
  }

  async function resendVerification(input) {
    requireOutbox();
    const user = await repository.findUserByEmail(emailNormalized(input.email));
    if (user && user.status === 'active' && !user.emailVerifiedAt) {
      await repository.transaction(async (session) => {
        await createTokenChallenge({
          purpose: 'verify_email', user, ttlMs: verifyTtlMs, template: 'verify-email',
          templateVariables: { path: '/xac-minh-email', name: user.name },
        }, session);
      });
    }
    return { accepted: true };
  }

  async function login(input) {
    const email = emailNormalized(input.email);
    const user = await repository.findUserByEmail(email, { includePassword: true });
    if (!user) {
      await hashPassword(input.password);
      throw new ServiceError(GENERIC_AUTH_ERROR.status, GENERIC_AUTH_ERROR.code, GENERIC_AUTH_ERROR.message);
    }
    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid || !user.emailVerifiedAt) {
      throw new ServiceError(GENERIC_AUTH_ERROR.status, GENERIC_AUTH_ERROR.code, GENERIC_AUTH_ERROR.message);
    }
    if (user.status === 'blocked') {
      const proof = await repository.transaction((session) => issueAppealProof(user, session));
      return { blocked: true, appealToken: proof.token, appealExpiresAt: proof.expiresAt };
    }
    const session = await repository.transaction((mongoSession) => issueSession(user, mongoSession));
    return { user: publicUser(user), sessionToken: session.token, sessionExpiresAt: session.expiresAt };
  }

  async function authenticateSession(token) {
    if (!token) throw new ServiceError(401, 'AUTH_REQUIRED', 'Cần đăng nhập để tiếp tục');
    const session = await repository.findSession(hashToken(token));
    const currentTime = now();
    if (!session || session.revokedAt || new Date(session.expiresAt) <= currentTime) {
      throw new ServiceError(401, 'SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn');
    }
    const user = await repository.findUserById(session.userId);
    if (!user || user.status === 'blocked') {
      await repository.updateSession(session._id ?? session.id, { revokedAt: currentTime });
      throw new ServiceError(403, 'ACCOUNT_BLOCKED', 'Tài khoản đang bị khóa');
    }
    if (user.authVersion !== session.authVersion) {
      await repository.updateSession(session._id ?? session.id, { revokedAt: currentTime });
      throw new ServiceError(401, 'SESSION_EXPIRED', 'Phiên đăng nhập không còn hiệu lực');
    }
    const lastSeen = session.lastSeenAt ? new Date(session.lastSeenAt) : new Date(0);
    if (currentTime.getTime() - lastSeen.getTime() > 5 * 60 * 1000) {
      await repository.updateSession(session._id ?? session.id, { lastSeenAt: currentTime });
    }
    return { id: asId(user), role: user.role, status: user.status, authVersion: user.authVersion, user };
  }

  async function authenticateAppealProof(token) {
    if (!token) throw new ServiceError(401, 'AUTH_REQUIRED', 'Cần xác minh để gửi hoặc xem kháng nghị');
    const proof = await repository.findRestrictedProof(hashToken(token));
    const currentTime = now();
    if (!proof || proof.purpose !== 'appeal_access' || proof.revokedAt || new Date(proof.expiresAt) <= currentTime
      || !APPEAL_SCOPES.every((scope) => proof.scopes.includes(scope))) {
      throw new ServiceError(401, 'SESSION_EXPIRED', 'Phiên kháng nghị đã hết hạn');
    }
    const user = await repository.findUserById(proof.userId);
    if (!user || user.status !== 'blocked' || user.authVersion !== proof.authVersion) {
      throw new ServiceError(403, 'ACCOUNT_BLOCKED', 'Phiên kháng nghị không còn hiệu lực');
    }
    return { id: asId(user), user, proof, scopes: proof.scopes };
  }

  async function authenticateGuestOrderProof(token) {
    if (!token) throw new ServiceError(401, 'AUTH_REQUIRED', 'Cần xác minh quyền truy cập đơn hàng');
    const proof = await repository.findRestrictedProof(hashToken(token));
    const currentTime = now();
    if (!proof || proof.purpose !== 'guest_order_access' || !proof.orderId || proof.userId
      || proof.revokedAt || new Date(proof.expiresAt) <= currentTime
      || !Array.isArray(proof.scopes) || proof.scopes.some((scope) => !GUEST_ORDER_SCOPES.includes(scope))
      || !GUEST_ORDER_SCOPES.every((scope) => proof.scopes.includes(scope))) {
      throw new ServiceError(401, 'SESSION_EXPIRED', 'Phiên tra cứu đơn hàng đã hết hạn');
    }
    return { orderId: asId(proof.orderId), proof, scopes: [...proof.scopes] };
  }

  async function requestPasswordReset(input) {
    requireOutbox();
    const user = await repository.findUserByEmail(emailNormalized(input.email));
    if (user && user.emailVerifiedAt) {
      await repository.transaction(async (session) => {
        await createTokenChallenge({
          purpose: 'reset_password', user, ttlMs: resetTtlMs, template: 'reset-password',
          templateVariables: { path: '/dat-lai-mat-khau', name: user.name },
        }, session);
      });
    }
    return { accepted: true };
  }

  async function resetPassword(input) {
    const tokenHash = hashToken(input.token);
    const passwordHash = await hashPassword(input.password);
    return repository.transaction(async (session) => {
      const challenge = await repository.findChallenge(tokenHash, { session });
      const currentTime = now();
      if (!challenge || challenge.purpose !== 'reset_password' || challenge.consumedAt || new Date(challenge.expiresAt) <= currentTime) {
        throw new ServiceError(410, 'LINK_EXPIRED', 'Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng');
      }
      if (!await repository.consumeChallenge(challenge._id ?? challenge.id, currentTime, { session })) {
        throw new ServiceError(410, 'LINK_EXPIRED', 'Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng');
      }
      const user = await repository.updateUserPassword(challenge.userId, passwordHash, { session });
      if (!user) throw new ServiceError(410, 'LINK_EXPIRED', 'Liên kết đặt lại mật khẩu đã hết hạn');
      await repository.revokeSessions(user._id ?? user.id, currentTime, { session });
      await repository.revokeRestrictedProofs(user._id ?? user.id, 'appeal_access', currentTime, { session });
      return { reset: true };
    });
  }

  async function requestAppealChallenge(input) {
    requireOutbox();
    const email = emailNormalized(input.email);
    const user = await repository.findUserByEmail(email);
    const challengeId = shortChallengeId();
    const challengeSecret = config.challengeSecret || config.csrfSecret;
    if (typeof challengeSecret !== 'string' || challengeSecret.length < 32) {
      throw new ServiceError(503, 'MAIL_UNAVAILABLE', 'Email xác minh chưa được cấu hình');
    }
    const code = challengeCode(challengeId, challengeSecret);
    if (user?.status === 'blocked') {
      const createdAt = now();
      const expiresAt = new Date(createdAt.getTime() + appealChallengeTtlMs);
      await repository.transaction(async (session) => {
        await repository.createChallenge({
          purpose: 'appeal_access',
          userId: user._id ?? user.id,
          tokenHash: hashToken(challengeId),
          expiresAt,
          attempts: 0,
        }, { session });
        await queueMail('appeal-access-code', user.emailNormalized, {
          name: user.name, verificationCode: code, expiresAt: expiresAt.toISOString(),
        }, session);
      });
    }
    return { accepted: true, challengeId };
  }

  async function exchangeAppealAccess(input) {
    const tokenHash = hashToken(input.challengeId);
    const rawEmail = emailNormalized(input.email);
    const result = await repository.transaction(async (session) => {
      const challenge = await repository.findChallenge(tokenHash, { session });
      const currentTime = now();
      if (!challenge || challenge.purpose !== 'appeal_access' || challenge.consumedAt
        || new Date(challenge.expiresAt) <= currentTime || challenge.attempts >= maxChallengeAttempts) {
        throw new ServiceError(403, 'FORBIDDEN', 'Thông tin xác minh không hợp lệ hoặc đã hết hạn');
      }
      const expectedCode = challengeCode(input.challengeId, config.challengeSecret || config.csrfSecret);
      if (!constantTimeEqual(expectedCode, input.verificationCode)) {
        await repository.incrementChallengeAttempts(challenge._id ?? challenge.id, { session });
        return { invalid: true };
      }
      const user = await repository.findUserById(challenge.userId, { session });
      if (!user || user.status !== 'blocked' || user.emailNormalized !== rawEmail) {
        await repository.incrementChallengeAttempts(challenge._id ?? challenge.id, { session });
        return { invalid: true };
      }
      if (!await repository.consumeChallenge(challenge._id ?? challenge.id, currentTime, { session })) {
        throw new ServiceError(403, 'FORBIDDEN', 'Thông tin xác minh không hợp lệ hoặc đã hết hạn');
      }
      const proof = await issueAppealProof(user, session);
      return { expiresAt: proof.expiresAt, proofToken: proof.token, invalid: false };
    });
    if (result.invalid) throw new ServiceError(403, 'FORBIDDEN', 'Thông tin xác minh không hợp lệ hoặc đã hết hạn');
    return result;
  }

  async function logout({ sessionToken, appealToken }) {
    const currentTime = now();
    if (sessionToken) {
      const session = await repository.findSession(hashToken(sessionToken));
      if (session && !session.revokedAt) await repository.updateSession(session._id ?? session.id, { revokedAt: currentTime });
    }
    if (appealToken) {
      const proof = await repository.findRestrictedProof(hashToken(appealToken));
      if (proof && !proof.revokedAt) {
        const record = proof.toObject ? proof.toObject() : proof;
        await repository.revokeRestrictedProofs(record.userId, 'appeal_access', currentTime);
      }
    }
  }

  async function updateProfile(actor, input) {
    const changes = {};
    if (Object.hasOwn(input, 'name')) changes.name = input.name.trim();
    if (Object.hasOwn(input, 'phone')) changes.phone = input.phone?.trim() || undefined;
    const user = await repository.updateUser(actor.id, actor.user.version, changes);
    if (!user) throw new ServiceError(409, 'VERSION_CONFLICT', 'Thông tin tài khoản đã thay đổi. Tải lại rồi thử lại');
    return publicUser(user);
  }

  async function listUsers(query) {
    const { items, total } = await repository.listUsers(query);
    return {
      items: items.map((user) => ({
        ...publicUser(user),
        ...(user.blockedReason ? { blockedReason: user.blockedReason } : {}),
        ...(user.createdAt ? { createdAt: safeDate(user.createdAt) } : {}),
      })),
      total,
    };
  }

  async function getUser(id) {
    const user = await repository.findUserById(id);
    if (!user) throw new ServiceError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
    return { ...publicUser(user), ...(user.blockedReason ? { blockedReason: user.blockedReason } : {}) };
  }

  async function inviteUser(actor, input, context = {}) {
    requireOutbox();
    if (emailNormalized(input.email) === emailNormalized(actor.user.emailNormalized)) {
      throw new ServiceError(409, 'BAD_REQUEST', 'Không thể mời tài khoản email đang đăng nhập');
    }
    const email = emailNormalized(input.email);
    const userExists = await repository.findUserByEmail(email);
    if (userExists) throw new ServiceError(409, 'VERSION_CONFLICT', 'Email này đã có tài khoản');
    const randomPassword = opaqueToken();
    const passwordHash = await hashPassword(randomPassword);
    const result = await repository.transaction(async (session) => {
      await assertAdminActor(actor, session);
      let user;
      try {
        user = await repository.createUser({
          name: input.name || 'Tài khoản được mời',
          emailNormalized: email,
          passwordHash,
          role: input.role,
          status: 'active',
          authVersion: 0,
          version: 0,
        }, { session });
      } catch (error) {
        if (error?.code === 11000) throw new ServiceError(409, 'VERSION_CONFLICT', 'Email này đã có tài khoản');
        throw error;
      }
      const { expiresAt } = await createTokenChallenge({
        purpose: 'invite_user', user, invitedRole: input.role, ttlMs: inviteTtlMs, template: 'user-invitation',
        templateVariables: { path: '/chap-nhan-loi-moi', role: input.role, name: input.name || user.name },
      }, session);
      await appendAudit({
        actorId: actor.id, actorRole: actor.role, requestId: context.requestId,
        action: 'identity.user.invite', targetType: 'user', targetId: asId(user), outcome: 'success',
        reasonCode: 'INVITATION_CREATED', changesRedacted: { role: input.role }, createdAt: now(),
      }, session);
      return { user, expiresAt };
    });
    return { user: publicUser(result.user), inviteStatus: 'queued', expiresAt: result.expiresAt.toISOString() };
  }

  async function updateAdminUser(actor, id, input) {
    const changes = {};
    if (Object.hasOwn(input, 'name')) changes.name = input.name.trim();
    if (Object.hasOwn(input, 'phone')) changes.phone = input.phone?.trim() || undefined;
    return repository.transaction(async (session) => {
      await assertAdminActor(actor, session);
      const user = await repository.updateUser(id, input.expectedVersion, changes, { session });
      if (!user) throw new ServiceError(409, 'VERSION_CONFLICT', 'Tài khoản đã thay đổi. Tải lại rồi thử lại');
      return { ...publicUser(user), ...(user.blockedReason ? { blockedReason: user.blockedReason } : {}) };
    });
  }

  async function changeAdminUser(actor, id, input, field, context = {}) {
    const currentTime = now();
    return repository.transaction(async (session) => {
      await repository.lockAdminGuard({ session });
      await assertAdminActor(actor, session);
      const user = await repository.findUserById(id, { session });
      if (!user) throw new ServiceError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
      if (user.version !== input.expectedVersion) throw new ServiceError(409, 'VERSION_CONFLICT', 'Tài khoản đã thay đổi. Tải lại rồi thử lại');
      const actorOwnTarget = actor.id === asId(user);
      const nextRole = field === 'role' ? input.role : user.role;
      const nextStatus = field === 'status' ? input.status : user.status;
      if (actorOwnTarget && user.role === 'admin' && (nextRole !== 'admin' || nextStatus !== 'active')) {
        throw new ServiceError(409, 'VERSION_CONFLICT', 'Không thể tự khóa hoặc hạ quyền quản trị viên đang đăng nhập');
      }
      if (user.role === 'admin' && user.status === 'active' && (nextRole !== 'admin' || nextStatus !== 'active')) {
        const activeAdmins = await repository.countActiveAdmins({ session });
        if (activeAdmins <= 1) throw new ServiceError(409, 'VERSION_CONFLICT', 'Không thể khóa hoặc hạ quyền quản trị viên hoạt động cuối cùng');
      }
      const changes = {
        [field]: input[field],
        authVersion: user.authVersion + 1,
      };
      if (field === 'status') {
        if (input.status === 'blocked') {
          changes.blockedReason = input.reason.trim();
          changes.blockedAt = currentTime;
          changes.blockedBy = actor.id;
        } else {
          changes.blockedReason = undefined;
          changes.blockedAt = undefined;
          changes.blockedBy = undefined;
        }
      }
      const updated = await repository.updateUser(id, input.expectedVersion, changes, { session });
      if (!updated) throw new ServiceError(409, 'VERSION_CONFLICT', 'Tài khoản đã thay đổi. Tải lại rồi thử lại');
      await repository.revokeSessions(id, currentTime, { session });
      await repository.revokeRestrictedProofs(id, 'appeal_access', currentTime, { session });
      await appendAudit({
        actorId: actor.id, actorRole: actor.role, requestId: context.requestId,
        action: field === 'status' ? 'identity.user.status' : 'identity.user.role', targetType: 'user', targetId: asId(user), outcome: 'success',
        reasonCode: field === 'status' ? 'ADMIN_STATUS_CHANGE' : 'ADMIN_ROLE_CHANGE',
        changesRedacted: {
          before: { role: user.role, status: user.status },
          after: { role: updated.role, status: updated.status },
          reason: redactReason(input.reason),
        },
        createdAt: currentTime,
      }, session);
      if (user.emailVerifiedAt) {
        await queueMail('account-status-update', user.emailNormalized, {
          name: user.name, role: updated.role, status: updated.status,
        }, session);
      }
      return { ...publicUser(updated), ...(updated.blockedReason ? { blockedReason: updated.blockedReason } : {}) };
    });
  }

  async function listAppeals(query) {
    const { items, total } = await repository.listAppeals(query);
    const detailed = await Promise.all(items.map(async (appeal) => {
      const user = await repository.findUserById(appeal.userId);
      return {
        id: asId(appeal),
        userId: asId(appeal.userId),
        user: user ? { id: asId(user), name: user.name, email: user.emailNormalized, role: user.role, status: user.status, blockedReason: user.blockedReason } : null,
        message: appeal.message,
        status: appeal.status,
        ...(appeal.reviewNote ? { reviewNote: appeal.reviewNote } : {}),
        submittedAt: safeDate(appeal.createdAt),
        ...(appeal.reviewedAt ? { reviewedAt: safeDate(appeal.reviewedAt) } : {}),
        version: appeal.version,
      };
    }));
    return { items: detailed, total };
  }

  async function currentAppeal(actor) {
    const appeal = await repository.findLatestAppeal(actor.id);
    return {
      status: appeal?.status || 'none',
      ...(appeal?.message ? { message: appeal.message } : {}),
      ...(appeal?.reviewNote ? { reviewNote: appeal.reviewNote } : {}),
      ...(appeal?.createdAt ? { submittedAt: safeDate(appeal.createdAt) } : {}),
      ...(actor.user.blockedReason ? { blockedReason: actor.user.blockedReason } : {}),
      ...(appeal ? { id: asId(appeal), version: appeal.version } : {}),
    };
  }

  async function submitAppeal(actor, input, context = {}) {
    return repository.transaction(async (session) => {
      const user = await repository.findUserById(actor.id, { session });
      if (!user || user.status !== 'blocked' || user.authVersion !== actor.user.authVersion) {
        throw new ServiceError(403, 'ACCOUNT_BLOCKED', 'Phiên kháng nghị không còn hiệu lực');
      }
      if (await repository.findPendingAppeal(actor.id, { session })) {
        throw new ServiceError(409, 'PENDING_APPEAL_EXISTS', 'Bạn đã có kháng nghị đang chờ xem xét');
      }
      const appeal = await repository.createAppeal({ userId: user._id ?? user.id, message: input.message.trim(), status: 'pending', version: 0 }, { session });
      await appendAudit({
        actorId: user._id ?? user.id, actorRole: user.role, requestId: context.requestId,
        action: 'identity.appeal.submit', targetType: 'account_appeal', targetId: asId(appeal), outcome: 'success',
        reasonCode: 'USER_SUBMITTED_APPEAL', changesRedacted: { status: 'pending' }, createdAt: now(),
      }, session);
      return { id: asId(appeal), status: appeal.status, submittedAt: safeDate(appeal.createdAt) || now().toISOString(), version: appeal.version };
    }).catch((error) => {
      if (error?.code === 11000) throw new ServiceError(409, 'PENDING_APPEAL_EXISTS', 'Bạn đã có kháng nghị đang chờ xem xét');
      throw error;
    });
  }

  async function decideAppeal(actor, id, input, context = {}) {
    const currentTime = now();
    return repository.transaction(async (session) => {
      await assertAdminActor(actor, session);
      const appeal = await repository.findAppealById(id, { session });
      if (!appeal) throw new ServiceError(404, 'NOT_FOUND', 'Không tìm thấy kháng nghị');
      if (appeal.status !== 'pending' || appeal.version !== input.expectedVersion) {
        throw new ServiceError(409, 'VERSION_CONFLICT', 'Kháng nghị đã được xử lý hoặc thay đổi');
      }
      const user = await repository.findUserById(appeal.userId, { session });
      if (!user) throw new ServiceError(404, 'NOT_FOUND', 'Không tìm thấy tài khoản kháng nghị');
      const updatedAppeal = await repository.updateAppeal(id, input.expectedVersion, {
        status: input.decision,
        reviewedBy: actor.id,
        reviewNote: input.reviewNote.trim(),
        reviewedAt: currentTime,
      }, { session });
      if (!updatedAppeal) throw new ServiceError(409, 'VERSION_CONFLICT', 'Kháng nghị đã được xử lý hoặc thay đổi');
      let updatedUser = user;
      if (input.decision === 'approved' && user.status === 'blocked') {
        updatedUser = await repository.updateUser(user._id ?? user.id, user.version, {
          status: 'active', blockedReason: undefined, blockedAt: undefined, blockedBy: undefined,
          authVersion: user.authVersion + 1,
        }, { session });
        if (!updatedUser) throw new ServiceError(409, 'VERSION_CONFLICT', 'Tài khoản đã thay đổi');
        await repository.revokeSessions(user._id ?? user.id, currentTime, { session });
      }
      await repository.revokeRestrictedProofs(user._id ?? user.id, 'appeal_access', currentTime, { session });
      await appendAudit({
        actorId: actor.id, actorRole: actor.role, requestId: context.requestId,
        action: 'identity.appeal.decision', targetType: 'account_appeal', targetId: asId(appeal), outcome: 'success',
        reasonCode: input.decision === 'approved' ? 'APPEAL_APPROVED' : 'APPEAL_REJECTED',
        changesRedacted: { decision: input.decision, userStatus: updatedUser.status }, createdAt: currentTime,
      }, session);
      if (user.emailVerifiedAt) {
        await queueMail('appeal-decision', user.emailNormalized, {
          name: user.name, decision: input.decision, reviewNote: input.reviewNote.trim(),
        }, session);
      }
      return {
        id: asId(updatedAppeal), userId: asId(user), status: updatedAppeal.status,
        reviewedBy: actor.id, reviewNote: updatedAppeal.reviewNote,
        reviewedAt: safeDate(updatedAppeal.reviewedAt), version: updatedAppeal.version,
        userStatus: updatedUser.status,
      };
    });
  }

  async function createGuestOrderProof({ orderId, identityVerifiedAt, session }) {
    if (!orderId) throw new TypeError('Guest order proof cần orderId');
    let verifiedAt;
    if (identityVerifiedAt !== undefined) {
      verifiedAt = new Date(identityVerifiedAt);
      if (Number.isNaN(verifiedAt.getTime())) throw new TypeError('identityVerifiedAt phải là thời điểm hợp lệ');
    }
    const token = opaqueToken();
    const issuedAt = now();
    const expiresAt = new Date(issuedAt.getTime() + duration('guestOrderProofTtlMs', 60 * 60 * 1000));
    await repository.createRestrictedProof({
      purpose: 'guest_order_access', orderId, scopes: [...GUEST_ORDER_SCOPES],
      tokenHash: hashToken(token), expiresAt, issuedAt,
      ...(verifiedAt ? { identityVerifiedAt: verifiedAt } : {}),
    }, { session });
    return { token, expiresAt };
  }

  async function revokeGuestOrderProofs(orderId, { session } = {}) {
    if (!orderId) throw new TypeError('Guest order proof revoke cần orderId');
    return repository.revokeGuestOrderProofs(orderId, now(), { session });
  }

  return Object.freeze({
    repository,
    register,
    acceptInvitation,
    verifyEmail,
    resendVerification,
    login,
    authenticateSession,
    authenticateAppealProof,
    requestPasswordReset,
    resetPassword,
    requestAppealChallenge,
    exchangeAppealAccess,
    logout,
    updateProfile,
    listUsers,
    getUser,
    inviteUser,
    updateAdminUser,
    changeAdminUser,
    listAppeals,
    currentAppeal,
    submitAppeal,
    decideAppeal,
    createGuestOrderProof,
    authenticateGuestOrderProof,
    revokeGuestOrderProofs,
    requireActor: authenticateSession,
    requireOwner(actor, resource) {
      const ownerId = resource?.userId?._id ?? resource?.userId?.id ?? resource?.userId;
      if (!actor || !resource || !ownerId || String(ownerId) !== actor.id) {
        throw new ServiceError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên');
      }
      return resource;
    },
  });
}
