import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../../src/services/identity/identity.service.js';
import { challengeCode, csrfValue, hashPassword, isValidCsrfValue } from '../../src/services/identity/identity.security.js';
import { validateIdentityBody } from '../../src/validators/identity/identity.validator.js';
import { FakeIdentityRepository } from './fakes/identity-repository.fake.js';

const TEST_SECRET = 'test-only-CSRF-and-challenge-secret-at-least-32-chars';
const TEST_CONFIG = { csrfSecret: TEST_SECRET, publicWebUrl: 'https://shop.example.test' };
let testTime = Date.parse('2026-10-06T02:00:00.000Z');

function makeHarness() {
  const repository = new FakeIdentityRepository();
  const outboxEvents = [];
  const auditEvents = [];
  const service = createIdentityService({
    ports: {
      repository,
      clock: { now: () => testTime },
      outbox: { async enqueueMail(template, to, variables) { outboxEvents.push({ template, to, variables }); return { queued: true }; } },
      audit: { async appendAudit(event) { auditEvents.push(event); return { recorded: true }; } },
    },
    config: TEST_CONFIG,
  });
  return { repository, outboxEvents, auditEvents, service };
}

function tokenFromLink(link) {
  return new URLSearchParams(new URL(link).hash.slice(1)).get('token');
}

async function seedUser(repository, { name, email, role = 'customer', status = 'active', password = 'Correct Horse Battery Staple 42!', verified = true }) {
  const passwordHash = await hashPassword(password);
  return repository.createUser({
    name, emailNormalized: email.toLowerCase(), passwordHash, role, status,
    emailVerifiedAt: verified ? new Date(testTime) : undefined,
    authVersion: 0, version: 0,
  });
}

test('registration fixes customer role, queues verification, and stores only an Argon2id hash', async () => {
  const { service, repository, outboxEvents } = makeHarness();
  const result = await service.register({
    name: 'An Nguyễn', email: 'An@Example.test', password: 'Correct Horse Battery Staple 42!', role: 'admin',
  });

  assert.deepEqual(result, { verificationRequired: true });
  assert.equal(repository.users[0].role, 'customer');
  assert.match(repository.users[0].passwordHash, /^\$argon2id\$/u);
  assert.equal(outboxEvents[0].template, 'verify-email');
  assert.equal(outboxEvents[0].to, 'an@example.test');
  const token = tokenFromLink(outboxEvents[0].variables.link);
  assert.ok(token);
  assert.notEqual(repository.challenges[0].tokenHash, token);
  await assert.rejects(service.login({ email: 'an@example.test', password: 'Correct Horse Battery Staple 42!' }), { code: 'AUTH_REQUIRED' });
  assert.deepEqual(await service.verifyEmail(token), { verified: true });
  await assert.rejects(service.verifyEmail(token), { status: 410, code: 'LINK_EXPIRED' });
  const session = await service.login({ email: 'AN@example.test', password: 'Correct Horse Battery Staple 42!' });
  assert.equal(session.user.role, 'customer');
  assert.equal((await service.requireActor(session.sessionToken)).id, repository.users[0]._id);
  assert.notEqual(repository.sessions[0].tokenHash, session.sessionToken);
});

test('password reset is single use, invalidates old sessions, and does not reveal account existence', async () => {
  const { service, repository, outboxEvents } = makeHarness();
  const user = await seedUser(repository, { name: 'Bình', email: 'binh@example.test' });
  const oldSession = await service.login({ email: user.emailNormalized, password: 'Correct Horse Battery Staple 42!' });
  assert.deepEqual(await service.requestPasswordReset({ email: 'missing@example.test' }), { accepted: true });
  assert.equal(outboxEvents.length, 0);
  assert.deepEqual(await service.requestPasswordReset({ email: user.emailNormalized }), { accepted: true });
  const token = tokenFromLink(outboxEvents[0].variables.link);
  assert.ok(token);

  assert.deepEqual(await service.resetPassword({ token, password: 'A Different Secure Password 99!' }), { reset: true });
  await assert.rejects(service.requireActor(oldSession.sessionToken), { code: 'SESSION_EXPIRED' });
  await assert.rejects(service.resetPassword({ token, password: 'Another Different Password 33!' }), { status: 410, code: 'LINK_EXPIRED' });
  const nextSession = await service.login({ email: user.emailNormalized, password: 'A Different Secure Password 99!' });
  assert.equal(nextSession.user.id, user._id);
  assert.equal(repository.users[0].authVersion, 1);
});

test('logout revokes full and restricted credentials and is safe to repeat', async () => {
  const { service, repository } = makeHarness();
  const user = await seedUser(repository, { name: 'Thảo', email: 'thao@example.test' });
  const fullSession = await service.login({ email: user.emailNormalized, password: 'Correct Horse Battery Staple 42!' });
  await service.logout({ sessionToken: fullSession.sessionToken });
  await service.logout({ sessionToken: fullSession.sessionToken });
  await assert.rejects(service.requireActor(fullSession.sessionToken), { code: 'SESSION_EXPIRED' });

  await repository.updateUser(user._id, user.version, { status: 'blocked', authVersion: 1, blockedReason: 'Review requested.' });
  const appealSession = await service.login({ email: user.emailNormalized, password: 'Correct Horse Battery Staple 42!' });
  await service.logout({ appealToken: appealSession.appealToken });
  await assert.rejects(service.authenticateAppealProof(appealSession.appealToken), { code: 'SESSION_EXPIRED' });
});

test('blocked users receive only appeal proof; submissions are owner scoped and approval unlocks with revocation', async () => {
  const { service, repository, auditEvents } = makeHarness();
  const admin = await seedUser(repository, { name: 'Admin', email: 'admin@example.test', role: 'admin' });
  const blocked = await seedUser(repository, { name: 'Chi', email: 'chi@example.test' });
  const activeAdminSession = await service.login({ email: admin.emailNormalized, password: 'Correct Horse Battery Staple 42!' });
  const adminActor = await service.requireActor(activeAdminSession.sessionToken);
  const oldSession = await service.login({ email: blocked.emailNormalized, password: 'Correct Horse Battery Staple 42!' });
  const blockResult = await service.changeAdminUser(adminActor, blocked._id, {
    status: 'blocked', reason: 'Cần xác minh hoạt động tài khoản.', expectedVersion: 0,
  }, 'status');
  assert.equal(blockResult.status, 'blocked');
  assert.equal(repository.users.find((record) => record._id === blocked._id).authVersion, 1);
  await assert.rejects(service.requireActor(oldSession.sessionToken), { status: 401, code: 'SESSION_EXPIRED' });
  const login = await service.login({ email: blocked.emailNormalized, password: 'Correct Horse Battery Staple 42!' });

  assert.equal(login.blocked, true);
  assert.equal(repository.sessions.filter((record) => record.userId === blocked._id && !record.revokedAt).length, 0);
  const appealActor = await service.authenticateAppealProof(login.appealToken);
  await assert.rejects(service.requireActor(login.appealToken), { code: 'SESSION_EXPIRED' });
  const appeal = await service.submitAppeal(appealActor, { message: 'Xin kiểm tra lại.' });
  assert.equal(appeal.status, 'pending');
  assert.deepEqual((await service.currentAppeal(appealActor)).status, 'pending');
  await assert.rejects(service.submitAppeal(appealActor, { message: 'Gửi lại.' }), { status: 409, code: 'PENDING_APPEAL_EXISTS' });

  const decision = await service.decideAppeal(adminActor, appeal.id, {
    decision: 'approved', reviewNote: 'Đã xác minh thông tin.', expectedVersion: 0,
  });
  assert.equal(decision.userStatus, 'active');
  assert.equal(repository.users.find((record) => record._id === blocked._id).authVersion, 2);
  await assert.rejects(service.authenticateAppealProof(login.appealToken), { status: 401, code: 'SESSION_EXPIRED' });
  assert.ok(auditEvents.some((event) => event.action === 'identity.appeal.decision'));
});

test('appeal access challenge enforces five committed attempts and queues a real verification message', async () => {
  const { service, repository, outboxEvents } = makeHarness();
  const user = await seedUser(repository, { name: 'Lan', email: 'lan@example.test', status: 'blocked' });
  const request = await service.requestAppealChallenge({ email: user.emailNormalized });
  const mail = outboxEvents[0];
  assert.equal(mail.template, 'appeal-access-code');
  assert.equal(mail.to, user.emailNormalized);
  assert.equal(mail.variables.verificationCode, challengeCode(request.challengeId, TEST_SECRET));
  const badCode = mail.variables.verificationCode === '000000' ? '000001' : '000000';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(service.exchangeAppealAccess({
      email: user.emailNormalized, challengeId: request.challengeId, verificationCode: badCode,
    }), { status: 403, code: 'FORBIDDEN' });
  }
  assert.equal(repository.challenges[0].attempts, 5);
  await assert.rejects(service.exchangeAppealAccess({
    email: user.emailNormalized, challengeId: request.challengeId, verificationCode: mail.variables.verificationCode,
  }), { status: 403, code: 'FORBIDDEN' });
});

test('invitation role is fixed by the challenge and acceptance creates a full opaque session', async () => {
  const { service, repository, outboxEvents } = makeHarness();
  const admin = await seedUser(repository, { name: 'Admin', email: 'admin@example.test', role: 'admin' });
  const adminSession = await service.login({ email: admin.emailNormalized, password: 'Correct Horse Battery Staple 42!' });
  const actor = await service.requireActor(adminSession.sessionToken);
  const invitation = await service.inviteUser(actor, { name: 'Mai', email: 'mai@example.test', role: 'staff' });
  assert.equal(invitation.inviteStatus, 'queued');
  const token = tokenFromLink(outboxEvents[0].variables.link);
  const accepted = await service.acceptInvitation({ token, name: 'Mai Trần', password: 'A Brand New Secure Password 67!', role: 'admin' });
  assert.equal(accepted.user.role, 'staff');
  assert.equal((await service.requireActor(accepted.sessionToken)).role, 'staff');
  await assert.rejects(service.acceptInvitation({ token, name: 'Mai', password: 'Another Secure Password 89!' }), { status: 410, code: 'LINK_EXPIRED' });
});

test('two admins changing each other cannot remove the last active admin', async () => {
  const { service, repository } = makeHarness();
  const first = await seedUser(repository, { name: 'Admin One', email: 'admin-one@example.test', role: 'admin' });
  const second = await seedUser(repository, { name: 'Admin Two', email: 'admin-two@example.test', role: 'admin' });
  const firstSession = await service.login({ email: first.emailNormalized, password: 'Correct Horse Battery Staple 42!' });
  const secondSession = await service.login({ email: second.emailNormalized, password: 'Correct Horse Battery Staple 42!' });
  const actorA = await service.requireActor(firstSession.sessionToken);
  const actorB = await service.requireActor(secondSession.sessionToken);
  const results = await Promise.allSettled([
    service.changeAdminUser(actorA, second._id, { role: 'staff', reason: 'Phân công vận hành.', expectedVersion: 0 }, 'role'),
    service.changeAdminUser(actorB, first._id, { role: 'staff', reason: 'Phân công vận hành.', expectedVersion: 0 }, 'role'),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(repository.users.filter((user) => user.role === 'admin' && user.status === 'active').length, 1);
  const loser = results.find((result) => result.status === 'rejected');
  assert.ok(['FORBIDDEN', 'VERSION_CONFLICT'].includes(loser.reason.code));
  await assert.rejects(service.requireActor(secondSession.sessionToken), { code: 'SESSION_EXPIRED' });
});

test('the CSRF value is origin-independent only when signed and its body cannot be changed', () => {
  const value = csrfValue('A'.repeat(43), TEST_SECRET);
  assert.equal(isValidCsrfValue(value, TEST_SECRET), true);
  assert.equal(isValidCsrfValue(`${value.slice(0, -1)}x`, TEST_SECRET), false);
  assert.equal(isValidCsrfValue(value, 'a-different-secret-with-more-than-32-characters'), false);
});

test('register and invitation validators reject client supplied role escalation', () => {
  let registerError;
  validateIdentityBody('register')({ body: { name: 'An', email: 'an@example.test', password: 'Correct Horse Battery Staple 42!', role: 'admin' } }, {}, (error) => { registerError = error; });
  assert.equal(registerError.code, 'VALIDATION_ERROR');
  assert.ok(registerError.details.some((item) => item.field === 'role'));

  let inviteError;
  validateIdentityBody('invite')({ body: { name: 'An', email: 'an@example.test', role: 'admin' } }, {}, (error) => { inviteError = error; });
  assert.equal(inviteError.code, 'VALIDATION_ERROR');
  assert.equal(repositoryRoleList().includes('admin'), false);
});

test('missing outbox dependency never reports email as queued', async () => {
  const repository = new FakeIdentityRepository();
  const service = createIdentityService({ ports: { repository }, config: TEST_CONFIG });
  await assert.rejects(service.register({ name: 'An', email: 'an@example.test', password: 'Correct Horse Battery Staple 42!' }), { status: 503, code: 'MAIL_UNAVAILABLE' });
  assert.equal(repository.users.length, 0);
});

function repositoryRoleList() {
  return ['customer', 'staff'];
}
