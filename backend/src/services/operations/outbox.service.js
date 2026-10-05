import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { OutboxEvent as DefaultOutboxEvent } from '../../models/operations/outbox-event.model.js';
import { conflict, unavailable } from '../../utils/serviceError.js';
import { MAIL_TEMPLATE_KEYS } from '../integrations/smtp/smtp.provider.js';
import { validateOutboxEvent } from '../../validators/operations.validator.js';

const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

function sameEvent(existing, incoming) {
  return existing.type === incoming.type
    && existing.aggregateType === incoming.aggregateType
    && existing.aggregateId === incoming.aggregateId
    && existing.aggregateVersion === incoming.aggregateVersion
    && payloadEquivalent(existing.payload, incoming.payload);
}

function comparablePayload(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.deliveries)) return payload;
  return {
    ...payload,
    deliveries: payload.deliveries.map((delivery) => delivery?.encryptedMail
      ? { ...delivery, encryptedMail: { fingerprint: delivery.encryptedMail.fingerprint, version: delivery.encryptedMail.version } }
      : delivery),
  };
}

function payloadEquivalent(existing, incoming) {
  return isDeepStrictEqual(comparablePayload(existing), comparablePayload(incoming));
}

function withSession(query, session) {
  return session && typeof query?.session === 'function' ? query.session(session) : query;
}

export function createOutboxService({ OutboxEvent = DefaultOutboxEvent, uuid = randomUUID, encryptMailPayload } = {}) {
  async function appendOutbox(event, { session } = {}) {
    const value = validateOutboxEvent(event);
    let row;
    try {
      const result = OutboxEvent.findOneAndUpdate(
        { eventKey: value.eventKey },
        { $setOnInsert: { ...value, state: 'pending', attempts: 0, nextAttemptAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) },
      );
      row = await withSession(result, session);
    } catch (error) {
      if (error?.code !== 11000) throw error;
      row = await withSession(OutboxEvent.findOne({ eventKey: value.eventKey }), session);
    }
    if (!row) row = await withSession(OutboxEvent.findOne({ eventKey: value.eventKey }), session);
    if (!row) throw new Error('Outbox write did not return its persisted event');
    const plain = typeof row.toObject === 'function' ? row.toObject() : row;
    if (!sameEvent(plain, value)) throw conflict('IDEMPOTENCY_CONFLICT', 'eventKey đã được dùng với nội dung khác');
    return plain;
  }

  async function enqueueMail(template, recipient, data, { session, eventKey } = {}) {
    if (!MAIL_TEMPLATE_KEYS.includes(template)) {
      throw new TypeError('Mail template must be an allowlisted template key');
    }
    if (typeof recipient !== 'string' || recipient.length > 254 || !EMAIL_PATTERN.test(recipient) || /[\r\n]/.test(recipient)) {
      throw new TypeError('Mail recipient must be a validated server-resolved email address');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Mail data must be an object');
    if (typeof encryptMailPayload !== 'function') {
      throw unavailable('MAIL_UNAVAILABLE', 'Outbox encryption chưa được cấu hình');
    }
    const key = eventKey || uuid();
    const encryptedMail = await encryptMailPayload({ template, recipient: recipient.trim(), data });
    return appendOutbox({
      eventKey: key,
      type: 'operations.delivery',
      aggregateType: 'mail',
      aggregateId: key,
      aggregateVersion: 1,
      payload: { deliveries: [{ encryptedMail }] },
    }, { session });
  }

  return Object.freeze({ appendOutbox, enqueueMail });
}
