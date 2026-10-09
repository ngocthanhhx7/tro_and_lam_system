import mongoose from 'mongoose';
import { User } from '../models/identity/user.model.js';
import { Review } from '../reviews/review.models.js';
import { Contact, ReturnRequest, SupportAttachment, Ticket, TicketMessage } from './support.models.js';

const asId = (value) => String(value?._id ?? value?.id ?? value);

function withSession(query, session) {
  return session && typeof query?.session === 'function' ? query.session(session) : query;
}

function plain(value) {
  return value && typeof value.toObject === 'function' ? value.toObject({ depopulate: true }) : value;
}

function cursorFilter(cursor) {
  if (!cursor) return {};
  return { $or: [
    { createdAt: { $gt: cursor.createdAt } },
    { createdAt: cursor.createdAt, _id: { $gt: cursor.id } },
  ] };
}

function combineFilter(base, extra) {
  if (!Object.keys(extra).length) return base;
  return Object.keys(base).length ? { $and: [base, extra] } : extra;
}

export class SupportRepository {
  constructor(models = {}, connection = mongoose.connection) {
    this.models = {
      Ticket: models.Ticket || Ticket,
      TicketMessage: models.TicketMessage || TicketMessage,
      Contact: models.Contact || Contact,
      ReturnRequest: models.ReturnRequest || ReturnRequest,
      Attachment: models.Attachment || SupportAttachment,
      User: models.User || User,
    };
    this.connection = connection;
  }

  async transaction(callback) {
    return this.connection.transaction(callback);
  }

  async createContact(data, { session } = {}) {
    const [record] = await this.models.Contact.create([data], { session });
    return plain(record);
  }

  async findContactById(id, { session } = {}) {
    return plain(await withSession(this.models.Contact.findById(id), session).lean().exec());
  }

  async listContacts(filters = {}, { session } = {}) {
    const query = {};
    for (const key of ['status', 'kind']) if (filters[key]) query[key] = filters[key];
    const offset = (filters.page - 1) * filters.limit;
    const [items, total] = await Promise.all([
      withSession(this.models.Contact.find(query).sort({ createdAt: -1, _id: -1 }).skip(offset).limit(filters.limit), session).lean().exec(),
      withSession(this.models.Contact.countDocuments(query), session).exec(),
    ]);
    return { items, total };
  }

  async updateContact(id, expectedVersion, changes, { session } = {}) {
    return plain(await this.models.Contact.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: 'after', runValidators: true, session },
    ).lean().exec());
  }

  async createTicket(data, { session } = {}) {
    const [record] = await this.models.Ticket.create([data], { session });
    return plain(record);
  }

  async findTicketById(id, { session } = {}) {
    return plain(await withSession(this.models.Ticket.findById(id), session).lean().exec());
  }

  async listOwnTickets(userId, filters = {}, { session } = {}) {
    const query = { userId, ...(filters.status ? { status: filters.status } : {}) };
    const [items, total] = await Promise.all([
      withSession(this.models.Ticket.find(query).sort({ updatedAt: -1, _id: -1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit), session).lean().exec(),
      withSession(this.models.Ticket.countDocuments(query), session).exec(),
    ]);
    return { items, total };
  }

  async listStaffTickets(filters = {}, { session } = {}) {
    const query = {};
    for (const key of ['status', 'kind', 'assignedTo']) if (filters[key]) query[key] = filters[key];
    const [items, total] = await Promise.all([
      withSession(this.models.Ticket.find(query).sort({ updatedAt: -1, _id: -1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit), session).lean().exec(),
      withSession(this.models.Ticket.countDocuments(query), session).exec(),
    ]);
    return { items, total };
  }

  async updateTicket(id, expectedVersion, changes, { session } = {}) {
    return plain(await this.models.Ticket.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: 'after', runValidators: true, session },
    ).lean().exec());
  }

  async createTicketMessage(data, { session } = {}) {
    const [record] = await this.models.TicketMessage.create([data], { session });
    return plain(record);
  }

  async listTicketMessages(ticketId, { cursor, limit = 20, includeInternal = false } = {}, { session } = {}) {
    const base = { ticketId, ...(!includeInternal ? { visibility: 'customer' } : {}) };
    const query = combineFilter(base, cursorFilter(cursor));
    const rows = await withSession(this.models.TicketMessage.find(query).sort({ createdAt: 1, _id: 1 }).limit(limit + 1), session).lean().exec();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: String(last._id) })).toString('base64url')
      : null;
    return { items, nextCursor };
  }

  async createReturnRequest(data, { session } = {}) {
    const [record] = await this.models.ReturnRequest.create([data], { session });
    return plain(record);
  }

  async findReturnById(id, { session } = {}) {
    return plain(await withSession(this.models.ReturnRequest.findById(id), session).lean().exec());
  }

  async findActiveReturnByOrder(orderId, { session } = {}) {
    return plain(await withSession(this.models.ReturnRequest.findOne({ orderId, active: true }), session).lean().exec());
  }

  async findReturnByIdempotency(orderId, idempotencyKeyHash, { session } = {}) {
    return plain(await withSession(this.models.ReturnRequest.findOne({ orderId, idempotencyKeyHash }), session).lean().exec());
  }

  async listReturnsForOwner(orderId, userId, { session } = {}) {
    return withSession(this.models.ReturnRequest.find({ orderId, ...(userId ? { userId } : {}) }).sort({ createdAt: -1, _id: -1 }), session).lean().exec();
  }

  async listStaffReturns(filters = {}, { session } = {}) {
    const query = filters.status ? { status: filters.status } : {};
    const [items, total] = await Promise.all([
      withSession(this.models.ReturnRequest.find(query).sort({ createdAt: 1, _id: 1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit), session).lean().exec(),
      withSession(this.models.ReturnRequest.countDocuments(query), session).exec(),
    ]);
    return { items, total };
  }

  async updateReturn(id, expectedVersion, changes, { session } = {}) {
    return plain(await this.models.ReturnRequest.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: 'after', runValidators: true, session },
    ).lean().exec());
  }

  async createAttachment(data, { session } = {}) {
    const [record] = await this.models.Attachment.create([data], { session });
    return plain(record);
  }

  async findAttachmentById(id, { session } = {}) {
    return plain(await withSession(this.models.Attachment.findById(id), session).lean().exec());
  }

  async findAttachmentsByIds(ids, { session } = {}) {
    return withSession(this.models.Attachment.find({ _id: { $in: ids } }), session).lean().exec();
  }

  async updateAttachment(id, expectedVersion, changes, { session } = {}) {
    return plain(await this.models.Attachment.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: 'after', runValidators: true, session },
    ).lean().exec());
  }

  async linkAttachments(ids, ownerFilter, link, { session } = {}) {
    if (!ids.length) return { modifiedCount: 0 };
    return this.models.Attachment.updateMany(
      { _id: { $in: ids }, ...ownerFilter, state: 'ready' },
      { $set: { ...link, state: 'linked' }, $inc: { version: 1 } },
      { session },
    ).exec();
  }

  async hasActiveStaffUser(id, { session } = {}) {
    const query = this.models.User.exists({ _id: id, status: 'active', role: 'staff' });
    const result = await withSession(query, session).exec();
    return Boolean(result);
  }

  async listActiveStaffIds({ session } = {}) {
    const rows = await withSession(this.models.User.find({ status: 'active', role: 'staff' }).select('_id'), session).lean().exec();
    return rows.map((row) => asId(row._id));
  }

  async findUserEmail(id, { session } = {}) {
    const user = await withSession(this.models.User.findById(id).select('emailNormalized'), session).lean().exec();
    return user?.emailNormalized || null;
  }
}

export class ReviewRepository {
  constructor(models = {}, connection = mongoose.connection) {
    this.Review = models.Review || Review;
    this.Attachment = models.Attachment || SupportAttachment;
    this.connection = connection;
  }

  async transaction(callback) { return this.connection.transaction(callback); }

  async create(data, { session } = {}) {
    const [record] = await this.Review.create([data], { session });
    return plain(record);
  }

  async findById(id, { session } = {}) {
    return plain(await withSession(this.Review.findById(id), session).lean().exec());
  }

  async listOwn(userId, filters = {}, { session } = {}) {
    const query = { userId, ...(filters.status ? { moderationStatus: filters.status } : {}) };
    const [items, total] = await Promise.all([
      withSession(this.Review.find(query).sort({ createdAt: -1, _id: -1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit), session).lean().exec(),
      withSession(this.Review.countDocuments(query), session).exec(),
    ]);
    return { items, total };
  }

  async listAdmin(filters = {}, { session } = {}) {
    const query = {};
    if (filters.status) query.moderationStatus = filters.status;
    if (filters.productId) query.productId = filters.productId;
    const [items, total] = await Promise.all([
      withSession(this.Review.find(query).sort({ createdAt: 1, _id: 1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit), session).lean().exec(),
      withSession(this.Review.countDocuments(query), session).exec(),
    ]);
    return { items, total };
  }

  async listPublished(productId, filters = {}, { session } = {}) {
    const query = { productId, moderationStatus: 'published' };
    const [items, total] = await Promise.all([
      withSession(this.Review.find(query).sort({ createdAt: -1, _id: -1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit), session).lean().exec(),
      withSession(this.Review.countDocuments(query), session).exec(),
    ]);
    return { items, total };
  }

  async update(id, expectedVersion, patch, { session } = {}) {
    const set = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined && value !== null));
    const unset = Object.fromEntries(Object.entries(patch).filter(([, value]) => value === null).map(([field]) => [field, 1]));
    const update = { $inc: { version: 1 } };
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    return plain(await this.Review.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      update,
      { returnDocument: 'after', runValidators: true, session },
    ).lean().exec());
  }

  async linkAttachments(ids, userId, reviewId, { session } = {}) {
    if (!ids.length) return { modifiedCount: 0 };
    return this.Attachment.updateMany(
      { _id: { $in: ids }, uploadedByUserId: userId, purpose: 'review', state: 'ready', reviewId: null },
      { $set: { reviewId, state: 'linked' }, $inc: { version: 1 } }, { session },
    ).exec();
  }

  async listReviewAttachments(ids, { session } = {}) {
    if (!ids.length) return [];
    return withSession(this.Attachment.find({ _id: { $in: ids } }), session).lean().exec();
  }
}

export function objectId(value) { return new mongoose.Types.ObjectId(value); }
export function identityId(value) { return asId(value); }
