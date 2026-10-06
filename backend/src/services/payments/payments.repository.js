import mongoose from 'mongoose';
import { PaymentAttempt } from '../../models/payments/payment-attempt.model.js';
import { PaymentEvent } from '../../models/payments/payment-event.model.js';
import { Refund } from '../../models/payments/refund.model.js';

export class PaymentsRepository {
  constructor(models = {}) {
    this.models = {
      PaymentAttempt: models.PaymentAttempt || PaymentAttempt,
      PaymentEvent: models.PaymentEvent || PaymentEvent,
      Refund: models.Refund || Refund,
    };
  }

  transaction(callback) {
    return mongoose.connection.transaction(callback);
  }

  findAttempt(orderId, requestKey, { session } = {}) {
    let query = this.models.PaymentAttempt.findOne({ orderId, requestKey });
    if (session) query = query.session(session);
    return query.exec();
  }

  findActiveAttempt(orderId, { session } = {}) {
    let query = this.models.PaymentAttempt.findOne({ orderId, active: true }).sort({ createdAt: -1 });
    if (session) query = query.session(session);
    return query.exec();
  }

  findLatestAttempt(orderId, { session } = {}) {
    let query = this.models.PaymentAttempt.findOne({ orderId }).sort({ createdAt: -1, _id: -1 });
    if (session) query = query.session(session);
    return query.exec();
  }

  findAttemptByProviderOrderCode(providerOrderCode, { session } = {}) {
    let query = this.models.PaymentAttempt.findOne({ provider: 'payos', providerOrderCode });
    if (session) query = query.session(session);
    return query.exec();
  }

  findAttemptByLinkId(paymentLinkId, { session } = {}) {
    let query = this.models.PaymentAttempt.findOne({ provider: 'payos', paymentLinkId });
    if (session) query = query.session(session);
    return query.exec();
  }

  createAttempt(input, { session } = {}) {
    return this.models.PaymentAttempt.create([input], { session }).then(([attempt]) => attempt);
  }

  updateAttempt(id, version, changes, { session } = {}) {
    return this.models.PaymentAttempt.findOneAndUpdate(
      { _id: id, version }, { $set: changes, $inc: { version: 1 } }, { returnDocument: 'after', session },
    ).exec();
  }

  async listPendingAttempts({ olderThan, limit = 100 } = {}) {
    return this.models.PaymentAttempt.find({
      status: 'pending',
      active: true,
      $or: [{ lastCheckedAt: { $exists: false } }, { lastCheckedAt: { $lte: olderThan } }],
    }).sort({ updatedAt: 1, _id: 1 }).limit(limit).lean().exec();
  }

  findEvent(provider, dedupeKey, { session } = {}) {
    let query = this.models.PaymentEvent.findOne({ provider, dedupeKey });
    if (session) query = query.session(session);
    return query.exec();
  }

  createEvent(input, { session } = {}) {
    return this.models.PaymentEvent.create([input], { session }).then(([event]) => event);
  }

  updateEvent(id, changes, { session } = {}) {
    return this.models.PaymentEvent.findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after', session }).exec();
  }

  findLatestReviewEvent(orderId) {
    return this.models.PaymentEvent.findOne({ orderId, processingState: 'review' })
      .sort({ receivedAt: -1 }).select('_id').lean().exec();
  }

  findReviewEvent(orderId, { session } = {}) {
    let query = this.models.PaymentEvent.findOne({ orderId, processingState: 'review' }).select('_id');
    if (session) query = query.session(session);
    return query.lean().exec();
  }

  findRefundByKey(orderId, requestKey, { session } = {}) {
    let query = this.models.Refund.findOne({ orderId, requestKey });
    if (session) query = query.session(session);
    return query.exec();
  }

  findRefundById(id, { session } = {}) {
    let query = this.models.Refund.findById(id);
    if (session) query = query.session(session);
    return query.exec();
  }

  createRefund(input, { session } = {}) {
    return this.models.Refund.create([input], { session }).then(([refund]) => refund);
  }

  updateRefund(id, version, statuses, changes, { session } = {}) {
    return this.models.Refund.findOneAndUpdate(
      { _id: id, version, status: { $in: statuses } },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: 'after', session },
    ).exec();
  }

  listRefunds({ status, page = 1, limit = 20 } = {}) {
    const filter = status ? { status } : {};
    return Promise.all([
      this.models.Refund.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.models.Refund.countDocuments(filter).exec(),
    ]).then(([items, total]) => ({ items, total }));
  }

  async refundTotals(orderId, { session } = {}) {
    let query = this.models.Refund.find({ orderId, status: { $in: ['requested', 'approved', 'processing', 'completed'] } })
      .select('amountVnd status');
    if (session) query = query.session(session);
    const rows = await query.lean().exec();
    return rows.reduce((total, refund) => ({
      completedVnd: total.completedVnd + (refund.status === 'completed' ? refund.amountVnd : 0),
      inFlightVnd: total.inFlightVnd + (['approved', 'processing'].includes(refund.status) ? refund.amountVnd : 0),
      requestedVnd: total.requestedVnd + (refund.status === 'requested' ? refund.amountVnd : 0),
      hasInFlightRefund: total.hasInFlightRefund || ['approved', 'processing'].includes(refund.status),
    }), { completedVnd: 0, inFlightVnd: 0, requestedVnd: 0, hasInFlightRefund: false });
  }

  newId() {
    return new mongoose.Types.ObjectId();
  }
}
