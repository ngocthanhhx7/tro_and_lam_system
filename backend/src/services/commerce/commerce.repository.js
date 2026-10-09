import mongoose from 'mongoose';
import { IdempotencyRecord } from '../../models/commerce/idempotency-record.model.js';
import { CodCollection } from '../../models/commerce/cod-collection.model.js';
import { Inventory } from '../../models/commerce/inventory.model.js';
import { InventoryMovement } from '../../models/commerce/inventory-movement.model.js';
import { OrderAccessChallenge } from '../../models/commerce/order-access-challenge.model.js';
import { Order } from '../../models/commerce/order.model.js';
import { StockReservation } from '../../models/commerce/stock-reservation.model.js';

const idOf = (value) => value?._id ?? value?.id ?? value;

export class CommerceRepository {
  constructor(models = {}) {
    this.models = {
      IdempotencyRecord: models.IdempotencyRecord || IdempotencyRecord,
      CodCollection: models.CodCollection || CodCollection,
      Inventory: models.Inventory || Inventory,
      InventoryMovement: models.InventoryMovement || InventoryMovement,
      OrderAccessChallenge: models.OrderAccessChallenge || OrderAccessChallenge,
      Order: models.Order || Order,
      StockReservation: models.StockReservation || StockReservation,
    };
  }

  transaction(callback) {
    return mongoose.connection.transaction(callback);
  }

  newId() {
    return new mongoose.Types.ObjectId();
  }

  async createOrder(data, { session } = {}) {
    const [order] = await this.models.Order.create([data], { session });
    return order;
  }

  async findOrderById(id, { session, includeGuestProofHash = false } = {}) {
    let query = this.models.Order.findById(id);
    if (!includeGuestProofHash) query = query.select('-guestAccessTokenHash');
    if (session) query = query.session(session);
    return query.exec();
  }

  async findOrderByCodeAndEmail(code, email, { session } = {}) {
    let query = this.models.Order.findOne({ code, 'recipientSnapshot.email': email });
    if (session) query = query.session(session);
    return query.exec();
  }

  async findOrderByCode(code, { session } = {}) {
    let query = this.models.Order.findOne({ code });
    if (session) query = query.session(session);
    return query.exec();
  }

  async findOwnedOrder(actorId, id, { session } = {}) {
    let query = this.models.Order.findOne({ _id: id, userId: actorId });
    if (session) query = query.session(session);
    return query.exec();
  }

  async findStaffOrder(id, { session } = {}) {
    let query = this.models.Order.findById(id).select('+internalNote +paymentReview');
    if (session) query = query.session(session);
    return query.exec();
  }

  async listOwnedOrders(actorId, { status, page, limit }) {
    const filter = { userId: actorId, ...(status ? { status } : {}) };
    const [items, total] = await Promise.all([
      this.models.Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.models.Order.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async listStaffOrders({ status, paymentStatus, queue, from, to, q, page, limit, sort = 'oldest' }) {
    const queueStatus = queue || undefined;
    const conflictingStatus = status && queueStatus && status !== queueStatus;
    if (conflictingStatus) return { items: [], total: 0 };
    const filter = {
      ...(status || queueStatus ? { status: status || queueStatus } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(from || to ? { createdAt: { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) } } : {}),
      ...(q ? { $or: [
        { code: { $regex: escapeRegex(q), $options: 'i' } },
        { 'recipientSnapshot.recipientName': { $regex: escapeRegex(q), $options: 'i' } },
      ] } : {}),
    };
    const [items, total] = await Promise.all([
      this.models.Order.find(filter).sort({ createdAt: sort === 'newest' ? -1 : 1, _id: sort === 'newest' ? -1 : 1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.models.Order.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async countPendingCodOrders(actor, email, { session } = {}) {
    const owner = actor?.id ? { userId: actor.id } : { 'recipientSnapshot.email': email };
    return this.models.Order.countDocuments({
      ...owner, paymentMethod: 'cod', paymentStatus: 'pending', status: { $nin: ['cancelled', 'returned'] },
    }).session(session || null).exec();
  }

  async updateOrder(id, expectedVersion, changes, { session } = {}) {
    const set = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
    const unset = Object.fromEntries(Object.entries(changes).filter(([, value]) => value === undefined).map(([key]) => [key, 1]));
    const update = { $inc: { version: 1 } };
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    return this.models.Order.findOneAndUpdate(
      { _id: id, version: expectedVersion }, update, { returnDocument: 'after', runValidators: true, session },
    ).exec();
  }

  async insertIdempotency(data, { session } = {}) {
    const [record] = await this.models.IdempotencyRecord.create([data], { session });
    return record;
  }

  async findIdempotency({ scope, actorKey, keyHash }, { session } = {}) {
    let query = this.models.IdempotencyRecord.findOne({ scope, actorKey, keyHash });
    if (session) query = query.session(session);
    return query.exec();
  }

  async finishIdempotency(id, { resourceId, responseStatus, safeResponse }, { session } = {}) {
    return this.models.IdempotencyRecord.findOneAndUpdate(
      { _id: id, state: 'processing' },
      { $set: { state: 'succeeded', resourceId, responseStatus, safeResponse } },
      { returnDocument: 'after', session },
    ).exec();
  }

  async createOrderAccessChallenge(data, { session } = {}) {
    const [challenge] = await this.models.OrderAccessChallenge.create([data], { session });
    return challenge;
  }

  async findOrderAccessChallenge(challengeIdHash, { session } = {}) {
    let query = this.models.OrderAccessChallenge.findOne({ challengeIdHash });
    if (session) query = query.session(session);
    return query.exec();
  }

  async incrementOrderAccessAttempts(id, { session } = {}) {
    return this.models.OrderAccessChallenge.updateOne(
      { _id: id, consumedAt: null, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } }, { session },
    ).exec();
  }

  async consumeOrderAccessChallenge(id, now, { session } = {}) {
    const result = await this.models.OrderAccessChallenge.updateOne(
      { _id: id, consumedAt: null, expiresAt: { $gt: now }, attempts: { $lt: 5 } },
      { $set: { consumedAt: now } }, { session },
    ).exec();
    return result.modifiedCount === 1;
  }

  async createCodCollection(data, { session } = {}) {
    const [collection] = await this.models.CodCollection.create([data], { session });
    return collection;
  }

  async findCodCollectionByIdempotencyKey(idempotencyKey, { session } = {}) {
    let query = this.models.CodCollection.findOne({ idempotencyKey });
    if (session) query = query.session(session);
    return query.exec();
  }

  async findCodCollectionByOrder(orderId, { session } = {}) {
    let query = this.models.CodCollection.findOne({ orderId });
    if (session) query = query.session(session);
    return query.exec();
  }

  async getInventory(productIds, { session } = {}) {
    let query = this.models.Inventory.find({ productId: { $in: productIds } });
    if (session) query = query.session(session);
    return query.exec();
  }

  async getAvailability(productIds) {
    const rows = await this.models.Inventory.find({ productId: { $in: productIds } }).lean().exec();
    const byProduct = new Map(rows.map((row) => [String(row.productId), Math.max(0, row.onHand - row.reserved)]));
    return productIds.map((productId) => ({ productId: String(productId), available: byProduct.get(String(productId)) || 0 }));
  }

  async reserve(items, orderId, { session, expiresAt } = {}) {
    const orderedItems = [...items].sort((left, right) => String(left.productId).localeCompare(String(right.productId)));
    const existing = await this.models.StockReservation.findOne({ orderId }).session(session || null).exec();
    if (existing) {
      const matches = existing.status === 'held'
        && JSON.stringify(normalizedReservationItems(existing.items)) === JSON.stringify(normalizedReservationItems(orderedItems));
      if (!matches) throw Object.assign(new Error('Reservation đã tồn tại với trạng thái không tương thích'), { code: 'RESERVATION_CONFLICT' });
      return existing;
    }

    for (const item of orderedItems) {
      const productId = idOf(item.productId);
      const changed = await this.models.Inventory.findOneAndUpdate({
        productId,
        $expr: { $gte: [{ $subtract: ['$onHand', '$reserved'] }, item.quantity] },
      }, { $inc: { reserved: item.quantity, version: 1 } }, { returnDocument: 'after', session }).exec();
      if (!changed) throw Object.assign(new Error('Một hoặc nhiều sản phẩm đã hết hàng'), { code: 'OUT_OF_STOCK' });
      await this.models.InventoryMovement.create([{
        productId, orderId, eventKey: `${orderId}:reserve:${productId}`, kind: 'reserve',
        onHandDelta: 0, reservedDelta: item.quantity,
      }], { session });
    }

    const [reservation] = await this.models.StockReservation.create([{
      orderId,
      items: orderedItems.map((item) => ({ productId: idOf(item.productId), quantity: item.quantity })),
      status: 'held',
      ...(expiresAt ? { expiresAt } : {}),
      version: 0,
    }], { session });
    return reservation;
  }

  async release(orderId, { session, reason }) {
    const reservation = await this.models.StockReservation.findOneAndUpdate(
      { orderId, status: 'held' },
      { $set: { status: 'released', releaseReason: reason }, $unset: { expiresAt: 1 }, $inc: { version: 1 } },
      { returnDocument: 'after', session },
    ).exec();
    if (!reservation) return false;
    for (const item of reservation.items) {
      const productId = idOf(item.productId);
      const changed = await this.models.Inventory.findOneAndUpdate(
        { productId, reserved: { $gte: item.quantity }, onHand: { $gte: item.quantity } },
        { $inc: { reserved: -item.quantity, version: 1 } }, { returnDocument: 'after', session },
      ).exec();
      if (!changed) throw new Error('Inventory invariant violated while releasing reservation');
      await this.models.InventoryMovement.create([{
        productId, orderId, eventKey: `${orderId}:release:${productId}`, kind: 'release',
        onHandDelta: 0, reservedDelta: -item.quantity, reason,
      }], { session });
    }
    return true;
  }

  async commitShipment(orderId, { session, actorId }) {
    const reservation = await this.models.StockReservation.findOneAndUpdate(
      { orderId, status: 'held' },
      { $set: { status: 'committed' }, $unset: { expiresAt: 1 }, $inc: { version: 1 } },
      { returnDocument: 'after', session },
    ).exec();
    if (!reservation) {
      const current = await this.models.StockReservation.findOne({ orderId }).session(session || null).exec();
      if (current?.status === 'committed') return false;
      throw new Error('Cannot ship an order without a held stock reservation');
    }
    for (const item of reservation.items) {
      const productId = idOf(item.productId);
      const changed = await this.models.Inventory.findOneAndUpdate(
        { productId, onHand: { $gte: item.quantity }, reserved: { $gte: item.quantity } },
        { $inc: { onHand: -item.quantity, reserved: -item.quantity, version: 1 } },
        { returnDocument: 'after', session },
      ).exec();
      if (!changed) throw new Error('Inventory invariant violated while shipping reservation');
      await this.models.InventoryMovement.create([{
        productId, orderId, eventKey: `${orderId}:ship:${productId}`, kind: 'ship',
        onHandDelta: -item.quantity, reservedDelta: -item.quantity, actorId,
      }], { session });
    }
    return true;
  }

  async adjustInventory(productId, delta, { session, actorId, reason, eventKey }) {
    const current = await this.models.Inventory.findOne({ productId }).session(session || null).exec();
    if (!current) {
      if (delta < 1) throw Object.assign(new Error('Không thể giảm tồn kho chưa được khởi tạo'), { code: 'OUT_OF_STOCK' });
      const [created] = await this.models.Inventory.create([{
        productId, onHand: delta, reserved: 0, version: 0,
      }], { session });
      await this.models.InventoryMovement.create([{
        productId, eventKey, kind: 'restock', onHandDelta: delta, reservedDelta: 0, actorId, reason,
      }], { session });
      return created;
    }
    const changed = await this.models.Inventory.findOneAndUpdate(
      { productId, $expr: { $gte: [{ $add: ['$onHand', delta] }, '$reserved'] } },
      { $inc: { onHand: delta, version: 1 } }, { returnDocument: 'after', session, runValidators: true },
    ).exec();
    if (!changed) throw Object.assign(new Error('Điều chỉnh sẽ làm tồn khả dụng âm'), { code: 'OUT_OF_STOCK' });
    await this.models.InventoryMovement.create([{
      productId, eventKey, kind: delta >= 0 ? 'restock' : 'adjust',
      onHandDelta: delta, reservedDelta: 0, actorId, reason,
    }], { session });
    return changed;
  }
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizedReservationItems(items) {
  return items.map((item) => ({ productId: String(idOf(item.productId)), quantity: item.quantity }))
    .sort((left, right) => left.productId.localeCompare(right.productId));
}
