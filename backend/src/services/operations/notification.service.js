import { Notification as DefaultNotification } from '../../models/operations/notification.model.js';
import { notFound } from '../../utils/serviceError.js';
import { parseBooleanQuery, parsePagination, validateNotificationDelivery } from '../../validators/operations.validator.js';

function asPlain(row) {
  const value = typeof row?.toObject === 'function' ? row.toObject() : row;
  return {
    id: String(value._id),
    eventKey: value.eventKey,
    category: value.category,
    title: value.title,
    body: value.body,
    href: value.href,
    readAt: value.readAt || null,
    createdAt: value.createdAt,
  };
}

export function createNotificationService({ Notification = DefaultNotification, now = () => new Date() } = {}) {
  async function consume({ eventKey, ...notification }, { session } = {}) {
    const value = validateNotificationDelivery(notification);
    if (typeof eventKey !== 'string' || !eventKey.trim() || eventKey.length > 200) {
      throw new TypeError('Notification eventKey must be a stable domain event key');
    }
    const writes = value.recipients.map((userId) => ({
      updateOne: {
        filter: { userId, eventKey },
        update: { $setOnInsert: {
          userId,
          eventKey,
          category: value.category,
          title: value.title,
          body: value.body,
          href: value.href,
          readAt: null,
          createdAt: now(),
        } },
        upsert: true,
      },
    }));
    const options = { ordered: false, ...(session ? { session } : {}) };
    return Notification.bulkWrite(writes, options);
  }

  async function list(userId, filters = {}) {
    const { page, limit } = parsePagination(filters);
    const unreadOnly = parseBooleanQuery(filters.unreadOnly, 'unreadOnly');
    const query = { userId, ...(unreadOnly ? { readAt: null } : {}) };
    const [rows, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Notification.countDocuments(query),
    ]);
    return {
      items: rows.map(asPlain),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async function unreadCount(userId) {
    return { count: await Notification.countDocuments({ userId, readAt: null }) };
  }

  async function markRead(userId, notificationId) {
    const row = await Notification.findOneAndUpdate(
      { _id: notificationId, userId, readAt: null },
      { $set: { readAt: now() } },
      { returnDocument: 'after' },
    );
    if (row) return asPlain(row);
    const existing = await Notification.findOne({ _id: notificationId, userId }).lean();
    if (existing) return asPlain(existing);
    throw notFound();
  }

  async function markAllRead(userId) {
    const result = await Notification.updateMany({ userId, readAt: null }, { $set: { readAt: now() } });
    return { updatedCount: result.modifiedCount ?? result.nModified ?? 0 };
  }

  async function appendForDelivery(delivery, eventKey, { session } = {}) {
    const payload = validateNotificationDelivery(delivery);
    return consume({ eventKey, ...payload }, { session });
  }

  return Object.freeze({ list, unreadCount, markRead, markAllRead, consume, appendForDelivery });
}
