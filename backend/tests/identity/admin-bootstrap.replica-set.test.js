import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { AuditLog } from '../../src/models/operations/audit-log.model.js';
import { AuthSession } from '../../src/models/identity/session.model.js';
import { User } from '../../src/models/identity/user.model.js';
import { bootstrapFirstAdmin } from '../../src/services/identity/admin-bootstrap.service.js';
import { IdentityRepository } from '../../src/services/identity/identity.repository.js';
import { createIdentityService } from '../../src/services/identity/identity.service.js';
import { verifyPassword } from '../../src/services/identity/identity.security.js';

const replicaSetUri = process.env.P02_TEST_REPLICA_SET_URI;

test('replica set: initial admin bootstrap requires owner confirmation and is one-time under concurrency', {
  skip: replicaSetUri ? false : 'Set P02_TEST_REPLICA_SET_URI to a dedicated local MongoDB replica-set URI.',
}, async () => {
  const base = new URL(replicaSetUri);
  const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
  assert.ok(['mongodb:', 'mongodb+srv:'].includes(base.protocol));
  assert.ok(allowedHosts.has(base.hostname), 'P02 bootstrap integration tests may only use loopback MongoDB');
  assert.equal(base.username, '');
  assert.equal(base.password, '');
  assert.equal(base.search, '');
  assert.equal(base.hash, '');

  const dbName = `tro_lam_p02_test_${randomBytes(6).toString('hex')}`;
  const emailA = 'first.admin@example.test';
  const emailB = 'second.admin@example.test';
  const passwordA = 'Local-only Admin Password 44!';
  const passwordB = 'Local-only Admin Password 55!';
  let connected = false;
  let cleanupError;

  try {
    await mongoose.connect(replicaSetUri, { dbName, serverSelectionTimeoutMS: 5000 });
    connected = true;
    assert.equal(mongoose.connection.name, dbName);

    await assert.rejects(bootstrapFirstAdmin({
      name: 'Wrong target', email: emailA, password: passwordA,
      confirmedDatabaseName: 'another-database', confirmedEmail: emailA,
    }), { code: 'BOOTSTRAP_CONFIRMATION_REQUIRED' });
    await assert.rejects(bootstrapFirstAdmin({
      name: 'Wrong owner confirmation', email: emailA, password: passwordA,
      confirmedDatabaseName: dbName, confirmedEmail: emailB,
    }), { code: 'BOOTSTRAP_CONFIRMATION_REQUIRED' });

    const inputs = [
      { name: 'First Admin', email: emailA, password: passwordA, confirmedDatabaseName: dbName, confirmedEmail: emailA },
      { name: 'Second Admin', email: emailB, password: passwordB, confirmedDatabaseName: dbName, confirmedEmail: emailB },
    ];
    const outcomes = await Promise.allSettled(inputs.map((input) => bootstrapFirstAdmin(input)));
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    assert.equal(rejected.reason.code, 'ADMIN_ALREADY_BOOTSTRAPPED');

    const administrators = await User.find({ role: 'admin' }).select('+passwordHash').exec();
    assert.equal(administrators.length, 1);
    assert.equal(administrators[0].status, 'active');
    assert.ok(administrators[0].emailVerifiedAt instanceof Date);
    assert.match(administrators[0].passwordHash, /^\$argon2id\$/u);
    const accountEmail = administrators[0].emailNormalized;
    const accountPassword = accountEmail === emailA ? passwordA : passwordB;
    assert.equal(await verifyPassword(administrators[0].passwordHash, accountPassword), true);
    assert.equal(await verifyPassword(administrators[0].passwordHash, accountEmail === emailA ? passwordB : passwordA), false);

    const audit = await AuditLog.findOne({ action: 'identity.admin.bootstrap' }).lean().exec();
    assert.equal(audit.actorRole, 'system');
    assert.equal(audit.reasonCode, 'OWNER_BOOTSTRAP');
    assert.equal(JSON.stringify(audit).includes(emailA), false);
    assert.equal(JSON.stringify(audit).includes(emailB), false);

    const service = createIdentityService({ ports: { repository: new IdentityRepository() } });
    const session = await service.login({ email: accountEmail, password: accountPassword });
    assert.equal(session.user.role, 'admin');
    assert.ok(session.user.emailVerifiedAt);

    await assert.rejects(bootstrapFirstAdmin({
      name: 'Repeat', email: emailA, password: passwordA,
      confirmedDatabaseName: dbName, confirmedEmail: emailA,
    }), { code: 'ADMIN_ALREADY_BOOTSTRAPPED' });
    assert.equal(await User.countDocuments({ role: 'admin' }).exec(), 1);
    assert.equal(await AuditLog.countDocuments({ action: 'identity.admin.bootstrap' }).exec(), 1);
  } finally {
    if (connected) {
      try {
        if (mongoose.connection.name !== dbName) cleanupError = new Error('Refusing to clean up an unexpected P02 test database.');
        else await mongoose.connection.dropDatabase();
      } catch (error) {
        cleanupError = error;
      } finally {
        await mongoose.disconnect().catch((error) => { cleanupError ||= error; });
      }
    }
  }
  if (cleanupError) throw cleanupError;
});

test('replica set: concurrent role changes cannot remove the final active administrator', {
  skip: replicaSetUri ? false : 'Set P02_TEST_REPLICA_SET_URI to a dedicated local MongoDB replica-set URI.',
}, async () => {
  const base = new URL(replicaSetUri);
  const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
  assert.ok(['mongodb:', 'mongodb+srv:'].includes(base.protocol));
  assert.ok(allowedHosts.has(base.hostname), 'P02 identity integration tests may only use loopback MongoDB');
  assert.equal(base.username, '');
  assert.equal(base.password, '');
  assert.equal(base.search, '');
  assert.equal(base.hash, '');

  const dbName = `tro_lam_p02_test_${randomBytes(6).toString('hex')}`;
  let connected = false;
  let cleanupError;
  try {
    await mongoose.connect(replicaSetUri, { dbName, serverSelectionTimeoutMS: 5000 });
    connected = true;
    assert.equal(mongoose.connection.name, dbName);

    const [first, second] = await User.create([
      {
        name: 'Admin One', emailNormalized: 'first.admin@example.test', passwordHash: 'test-only-placeholder',
        role: 'admin', status: 'active', authVersion: 0, version: 0,
      },
      {
        name: 'Admin Two', emailNormalized: 'second.admin@example.test', passwordHash: 'test-only-placeholder',
        role: 'admin', status: 'active', authVersion: 0, version: 0,
      },
    ]);
    await AuthSession.create([
      { userId: first._id, tokenHash: randomBytes(32).toString('hex'), authVersion: 0, expiresAt: new Date(Date.now() + 60_000) },
      { userId: second._id, tokenHash: randomBytes(32).toString('hex'), authVersion: 0, expiresAt: new Date(Date.now() + 60_000) },
    ]);

    const service = createIdentityService({
      ports: {
        repository: new IdentityRepository(),
        audit: {
          appendAudit: async (event, { session } = {}) => {
            const [record] = await AuditLog.create([event], { session });
            return record;
          },
        },
      },
    });
    const actorA = { id: String(first._id), role: 'admin', authVersion: 0 };
    const actorB = { id: String(second._id), role: 'admin', authVersion: 0 };
    const outcomes = await Promise.allSettled([
      service.changeAdminUser(actorA, String(second._id), {
        role: 'staff', reason: 'Concurrent role reassignment.', expectedVersion: 0,
      }, 'role', { requestId: 'p02-last-admin-race-a' }),
      service.changeAdminUser(actorB, String(first._id), {
        role: 'staff', reason: 'Concurrent role reassignment.', expectedVersion: 0,
      }, 'role', { requestId: 'p02-last-admin-race-b' }),
    ]);

    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    assert.ok(['FORBIDDEN', 'VERSION_CONFLICT'].includes(rejected.reason.code));

    const administrators = await User.find({ role: 'admin', status: 'active' }).lean().exec();
    const demoted = await User.findOne({ role: 'staff', status: 'active' }).lean().exec();
    assert.equal(administrators.length, 1);
    assert.ok(demoted);
    assert.equal(demoted.authVersion, 1);
    assert.equal(demoted.version, 1);

    const sessions = await AuthSession.find({}).lean().exec();
    const revokedSession = sessions.find((session) => String(session.userId) === String(demoted._id));
    const activeSession = sessions.find((session) => String(session.userId) === String(administrators[0]._id));
    assert.ok(revokedSession.revokedAt instanceof Date);
    assert.equal(activeSession.revokedAt, undefined);

    const audits = await AuditLog.find({ action: 'identity.user.role' }).lean().exec();
    assert.equal(audits.length, 1);
    assert.equal(audits[0].targetId, String(demoted._id));
    assert.equal(audits[0].reasonCode, 'ADMIN_ROLE_CHANGE');
    assert.equal(audits[0].outcome, 'success');
  } finally {
    if (connected) {
      try {
        if (mongoose.connection.name !== dbName) cleanupError = new Error('Refusing to clean up an unexpected P02 test database.');
        else await mongoose.connection.dropDatabase();
      } catch (error) {
        cleanupError = error;
      } finally {
        await mongoose.disconnect().catch((error) => { cleanupError ||= error; });
      }
    }
  }
  if (cleanupError) throw cleanupError;
});
