import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { Notification } from '../../src/models/operations/notification.model.js';
import { OutboxEvent } from '../../src/models/operations/outbox-event.model.js';
import { createOutboxWorker } from '../../src/jobs/operations/outbox.worker.js';
import { createNotificationService } from '../../src/services/operations/notification.service.js';
import { createOutboxService } from '../../src/services/operations/outbox.service.js';
import { validateOutboxEvent } from '../../src/validators/operations.validator.js';

const replicaSetUri = process.env.P09_TEST_REPLICA_SET_URI;

test('P09 replica set: delivery outbox projects one durable, owner-scoped notification per recipient across retry', {
  skip: replicaSetUri ? false : 'Set P09_TEST_REPLICA_SET_URI to a dedicated local MongoDB replica set.',
}, async () => {
  const target = new URL(replicaSetUri);
  assert.equal(target.protocol, 'mongodb:');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'P09 integration tests may only use loopback MongoDB');
  assert.equal(target.username, '');
  assert.equal(target.password, '');

  const dbName = `tro_lam_p09_test_${randomBytes(6).toString('hex')}`;
  const fixedNow = new Date('2026-10-07T00:00:00.000Z');
  const userA = new mongoose.Types.ObjectId();
  const userB = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();
  let connected = false;

  try {
    await mongoose.connect(replicaSetUri, { dbName, serverSelectionTimeoutMS: 5000 });
    connected = true;
    assert.equal(mongoose.connection.name, dbName);
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    assert.ok(hello.setName, 'P09 integration requires a MongoDB replica set');
    await Promise.all([Notification.init(), OutboxEvent.init()]);

    const eventKey = `order:${orderId}:status_changed:v1`;
    const event = validateOutboxEvent({
      eventKey,
      type: 'operations.delivery',
      aggregateType: 'order',
      aggregateId: String(orderId),
      aggregateVersion: 1,
      payload: { deliveries: [{ notification: {
        recipients: [String(userA), String(userB)],
        category: 'order',
        title: 'Order status changed',
        body: 'Your order is being prepared.',
        href: `/tai-khoan/don-hang/${orderId}`,
      } }] },
    });
    const outboxService = createOutboxService({ OutboxEvent });
    const persistedEvent = await outboxService.appendOutbox(event);
    await OutboxEvent.updateOne({ _id: persistedEvent._id }, { $set: { nextAttemptAt: fixedNow } });

    let failSentAcknowledgement = true;
    const workerOutbox = {
      db: OutboxEvent.db,
      findOneAndUpdate: (...args) => OutboxEvent.findOneAndUpdate(...args),
      updateOne: (filter, update, options) => {
        if (update.$set?.state === 'sent' && failSentAcknowledgement) {
          failSentAcknowledgement = false;
          return Promise.reject(Object.assign(new Error('simulated lost outbox acknowledgement'), { code: 'TEST_ACK_INTERRUPTED' }));
        }
        return OutboxEvent.updateOne(filter, update, options);
      },
    };
    const notificationService = createNotificationService({ Notification, now: () => fixedNow });
    const worker = createOutboxWorker({
      OutboxEvent: workerOutbox,
      Notification,
      notificationService,
      workerId: 'p09-notification-projection-test',
      now: () => fixedNow,
      random: () => 0,
    });

    const firstAttempt = await worker.runOnce();
    assert.equal(firstAttempt.state, 'pending', 'a failed acknowledgement leaves the delivered event retryable');
    const afterFirstAttempt = await Notification.find({ eventKey }).sort({ userId: 1 }).lean();
    assert.equal(afterFirstAttempt.length, 2);
    assert.deepEqual(afterFirstAttempt.map((row) => String(row.userId)).sort(), [String(userA), String(userB)].sort());
    const notificationIds = afterFirstAttempt.map((row) => String(row._id)).sort();

    const outboxAfterFirstAttempt = await OutboxEvent.findById(persistedEvent._id).lean();
    assert.equal(outboxAfterFirstAttempt.state, 'pending');
    assert.equal(outboxAfterFirstAttempt.attempts, 1);
    await OutboxEvent.updateOne({ _id: persistedEvent._id, state: 'pending' }, { $set: { nextAttemptAt: fixedNow } });

    const retry = await worker.runOnce();
    assert.equal(retry.state, 'sent');
    const afterRetry = await Notification.find({ eventKey }).sort({ userId: 1 }).lean();
    assert.equal(afterRetry.length, 2, 'replaying the same event must not duplicate either recipient row');
    assert.deepEqual(afterRetry.map((row) => String(row._id)).sort(), notificationIds);
    assert.ok(afterRetry.every((row) => row.eventKey === eventKey));
    assert.equal((await OutboxEvent.findById(persistedEvent._id).lean()).state, 'sent');

    const ownerAList = await notificationService.list(String(userA));
    const ownerBList = await notificationService.list(String(userB));
    const unrelatedList = await notificationService.list(String(new mongoose.Types.ObjectId()));
    assert.equal(ownerAList.pagination.total, 1);
    assert.equal(ownerBList.pagination.total, 1);
    assert.equal(unrelatedList.pagination.total, 0);
    const rowForA = afterRetry.find((row) => String(row.userId) === String(userA));
    await assert.rejects(() => notificationService.markRead(String(userB), String(rowForA._id)), { code: 'NOT_FOUND' });
    await notificationService.markRead(String(userA), String(rowForA._id));
    assert.equal((await notificationService.unreadCount(String(userA))).count, 0);
    assert.equal((await notificationService.unreadCount(String(userB))).count, 1);
  } finally {
    if (connected) {
      assert.match(dbName, /^tro_lam_p09_test_[a-f\d]{12}$/);
      await mongoose.connection.db.dropDatabase();
      await mongoose.disconnect();
    }
  }
});
