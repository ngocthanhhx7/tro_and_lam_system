import { randomUUID, createHash } from 'node:crypto';
import { Notification as DefaultNotification } from '../../models/operations/notification.model.js';
import { OutboxEvent as DefaultOutboxEvent } from '../../models/operations/outbox-event.model.js';
import { AuditLog as DefaultAuditLog } from '../../models/operations/audit-log.model.js';
import { createAuditService } from '../../services/operations/audit.service.js';
import { createNotificationService } from '../../services/operations/notification.service.js';
import { unavailable } from '../../utils/serviceError.js';

export const RETRY_DELAY_MS = Object.freeze([60_000, 300_000, 900_000, 3_600_000, 21_600_000]);

export function retryDelayMs(attempt, random = Math.random) {
  if (!Number.isSafeInteger(attempt) || attempt < 1 || attempt > RETRY_DELAY_MS.length) return null;
  const jitterSource = Number(random());
  const jitter = 0.75 + Math.min(1, Math.max(0, Number.isFinite(jitterSource) ? jitterSource : 0.5)) * 0.5;
  return Math.round(RETRY_DELAY_MS[attempt - 1] * jitter);
}

/** Start one serial polling loop; stop() waits for the current database/provider operation. */
export function startOutboxWorker(worker, { idlePollMs = 5_000, handledPollMs = 100, onError = () => {} } = {}) {
  if (!worker || typeof worker.runOnce !== 'function') throw new TypeError('Outbox worker requires a runOnce function');
  for (const [name, value] of Object.entries({ idlePollMs, handledPollMs })) {
    if (!Number.isSafeInteger(value) || value < 10 || value > 60_000) throw new TypeError(`${name} must be between 10 and 60000 milliseconds`);
  }

  let timer;
  let activeRun;
  let stopping = false;

  function schedule(delay) {
    if (stopping) return;
    timer = setTimeout(() => { void poll(); }, delay);
    timer.unref?.();
  }

  async function poll() {
    if (stopping) return;
    try {
      activeRun = Promise.resolve(worker.runOnce());
      const result = await activeRun;
      schedule(result?.claimed ? handledPollMs : idlePollMs);
    } catch (error) {
      const candidate = typeof error?.code === 'string' ? error.code : '';
      const code = /^[A-Z][A-Z0-9_]{0,79}$/.test(candidate) ? candidate : 'WORKER_ERROR';
      try { onError({ code }); } catch { /* Keep polling even if the logger is unavailable. */ }
      schedule(idlePollMs);
    } finally {
      activeRun = null;
    }
  }

  void poll();
  return Object.freeze({
    async stop() {
      stopping = true;
      if (timer) clearTimeout(timer);
      if (activeRun) await activeRun.catch(() => {});
    },
  });
}

function plain(row) {
  return typeof row?.toObject === 'function' ? row.toObject() : row;
}

function failureCode(error) {
  return ['MAIL_UNAVAILABLE', 'OUTBOX_HANDLER_UNAVAILABLE'].includes(error?.code) ? error.code : 'DELIVERY_FAILED';
}

export function createOutboxWorker({
  OutboxEvent = DefaultOutboxEvent,
  Notification = DefaultNotification,
  AuditLog = DefaultAuditLog,
  notificationService = createNotificationService({ Notification }),
  auditService = createAuditService({ AuditLog }),
  mailProvider,
  decryptMailPayload,
  alertOperationsAdmins,
  workerId = randomUUID(),
  eventTypes = ['operations.delivery'],
  leaseMs = 60_000,
  now = () => new Date(),
  random = Math.random,
  onFailure = () => {},
} = {}) {
  if (!Array.isArray(eventTypes) || eventTypes.length === 0) throw new TypeError('At least one outbox event type is required');

  async function claimNext() {
    const instant = now();
    const result = await OutboxEvent.findOneAndUpdate({
      type: { $in: eventTypes },
      $or: [
        { state: 'pending', nextAttemptAt: { $lte: instant } },
        { state: 'processing', leaseUntil: { $lte: instant } },
      ],
    }, {
      $set: {
        state: 'processing',
        lockedBy: workerId,
        leaseUntil: new Date(instant.getTime() + leaseMs),
        lastErrorCode: null,
      },
      $inc: { attempts: 1 },
    }, { sort: { nextAttemptAt: 1, _id: 1 }, new: true });
    return result ? plain(result) : null;
  }

  async function deliver(event) {
    if (event.type !== 'operations.delivery' || !Array.isArray(event.payload?.deliveries)) {
      throw unavailable('OUTBOX_HANDLER_UNAVAILABLE', 'Outbox event chưa có consumer được đăng ký');
    }
    let delivered = false;
    for (let index = 0; index < event.payload.deliveries.length; index += 1) {
      const item = event.payload.deliveries[index];
      if (item?.notification) {
        await notificationService.appendForDelivery({ ...item.notification, recipients: item.notification.recipients.map(String) }, event.eventKey);
        delivered = true;
      }
      if (item?.encryptedMail) {
        if (typeof decryptMailPayload !== 'function' || !mailProvider?.send) {
          throw unavailable('MAIL_UNAVAILABLE', 'Outbox mail adapter chưa được cấu hình');
        }
        const message = await decryptMailPayload(item.encryptedMail);
        await mailProvider.send({
          eventId: `${event.eventKey}:${index}`,
          to: message.recipient,
          templateKey: message.template,
          variables: message.data,
        });
        delivered = true;
      }
      if (!item?.notification && !item?.encryptedMail) {
        throw unavailable('OUTBOX_HANDLER_UNAVAILABLE', 'Outbox delivery không có handler được hỗ trợ');
      }
    }
    if (!delivered) throw unavailable('OUTBOX_HANDLER_UNAVAILABLE', 'Outbox delivery không có nội dung được xử lý');
  }

  async function markSent(event) {
    const instant = now();
    const result = await OutboxEvent.updateOne({
      _id: event._id,
      state: 'processing',
      lockedBy: workerId,
      leaseUntil: { $gt: instant },
    }, { $set: { state: 'sent', processedAt: instant, leaseUntil: null, lockedBy: null, lastErrorCode: null } });
    return (result.modifiedCount ?? result.nModified ?? 0) === 1;
  }

  async function retry(event, errorCode) {
    const delay = retryDelayMs(event.attempts, random);
    const lease = { leaseUntil: { $gt: now() } };
    if (delay !== null) {
      const nextAttemptAt = new Date(now().getTime() + delay);
      const updated = await OutboxEvent.updateOne({ _id: event._id, state: 'processing', lockedBy: workerId, ...lease }, {
        $set: { state: 'pending', nextAttemptAt, leaseUntil: null, lockedBy: null, lastErrorCode: errorCode },
      });
      if ((updated.modifiedCount ?? updated.nModified ?? 0) !== 1) return { eventKey: event.eventKey, state: 'lease_lost', nextAttemptAt: null };
      return { eventKey: event.eventKey, state: 'pending', nextAttemptAt };
    }
    const deadLettered = await deadLetter(event, errorCode);
    return { eventKey: event.eventKey, state: deadLettered ? 'failed' : 'lease_lost', nextAttemptAt: null };
  }

  async function deadLetter(event, errorCode) {
    const dbSession = await OutboxEvent.db.startSession();
    try {
      return await dbSession.withTransaction(async () => {
        const result = await OutboxEvent.updateOne({
          _id: event._id, state: 'processing', lockedBy: workerId, leaseUntil: { $gt: now() },
        }, {
          $set: { state: 'failed', processedAt: now(), leaseUntil: null, lockedBy: null, lastErrorCode: errorCode },
        }, { session: dbSession });
        if ((result.modifiedCount ?? result.nModified ?? 0) !== 1) return false;
        await auditService.append({
          actorRole: 'system',
          requestId: `worker:${String(event._id)}`,
          action: 'outbox.dead_letter',
          targetType: 'outbox_event',
          targetId: String(event._id),
          outcome: 'failure',
          reasonCode: 'OUTBOX_DEAD_LETTER',
          changesRedacted: { eventType: event.type, attempts: event.attempts, errorCode },
        }, { session: dbSession });
        if (alertOperationsAdmins) {
          await alertOperationsAdmins({
            eventKey: `system:outbox-dead-letter:${createHash('sha256').update(String(event.eventKey)).digest('hex').slice(0, 40)}`,
            category: 'system',
            title: 'Email vận hành cần xử lý',
            body: 'Một email đã hết số lần thử tự động. Kiểm tra nhật ký vận hành.',
            href: '/admin/logs',
          }, { session: dbSession });
        }
        return true;
      });
    } finally {
      await dbSession.endSession();
    }
  }

  async function runOnce() {
    const event = await claimNext();
    if (!event) return { claimed: false };
    try {
      await deliver(event);
      const acknowledged = await markSent(event);
      return { claimed: true, eventKey: event.eventKey, state: acknowledged ? 'sent' : 'lease_lost' };
    } catch (error) {
      const errorCode = failureCode(error);
      try {
        const outcome = await retry(event, errorCode);
        onFailure({ eventKey: event.eventKey, errorCode, state: outcome.state });
        return { claimed: true, ...outcome };
      } catch (stateError) {
        onFailure({
          eventKey: event.eventKey,
          errorCode: 'OUTBOX_STATE_UPDATE_FAILED',
          state: 'processing',
          causeCode: typeof stateError?.code === 'string' ? stateError.code : stateError?.name || 'UNKNOWN',
        });
        throw unavailable('DATABASE_UNAVAILABLE', 'Không thể lưu trạng thái outbox');
      }
    }
  }

  return Object.freeze({ claimNext, runOnce });
}
