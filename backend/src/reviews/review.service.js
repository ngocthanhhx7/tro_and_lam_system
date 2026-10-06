import { ReviewRepository, identityId } from '../support/support.repository.js';
import { validateListQuery, validateObjectId, validateReviewCreate, validateReviewModeration, validateReviewWrite } from '../support/support.validators.js';
import { conflict, notFound, ServiceError, unavailable } from '../utils/serviceError.js';

const idOf = (value) => String(value?._id ?? value?.id ?? value ?? '');
const plain = (value) => value && typeof value.toObject === 'function' ? value.toObject({ depopulate: true }) : value;
const SUPPORT_REVIEW_ERROR = (message) => unavailable('DATABASE_UNAVAILABLE', message);

function iso(value) { return value ? new Date(value).toISOString() : undefined; }

function reviewDto(value, { publicView = false, ownerView = false } = {}) {
  const review = plain(value);
  const dto = {
    id: idOf(review), productId: idOf(review.productId), rating: review.rating, comment: review.comment || '',
    createdAt: iso(review.createdAt), updatedAt: iso(review.updatedAt),
  };
  if (!publicView) Object.assign(dto, {
    orderId: idOf(review.orderId), status: review.moderationStatus,
    attachmentIds: (review.attachmentIds || []).map(idOf),
    consentToPublishAttachments: review.consentToPublishAttachments === true,
    version: review.version,
    ...(ownerView && review.moderationStatus === 'hidden' && review.moderationReason ? { moderationReason: review.moderationReason } : {}),
  });
  return dto;
}

function pageMeta(page, limit, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

function orderItems(order) {
  return (order?.items ?? order?.itemsSnapshot ?? []).map((item) => idOf(item.productId));
}

function isDuplicate(error) { return error?.code === 11000 || error?.code === '11000'; }

function safeAuditId(actor) { return actor?.id ? identityId(actor.id) : null; }

export function createReviewService({ ports = {}, repository, supportRepository } = {}) {
  const repo = repository || ports.reviewRepository || new ReviewRepository(ports.models, ports.connection);
  const attachmentRepo = supportRepository || ports.supportRepository || repo;
  const commerce = ports.commerce || ports.order || ports.commerceService || {};
  const catalog = ports.catalog || ports.catalogService || {};
  const operations = ports.operations || ports.outbox || {};
  const audit = ports.audit || operations;
  const clock = typeof ports.clock?.now === 'function' ? ports.clock : { now: () => Date.now() };
  const now = () => new Date(clock.now());

  function requireActor(actor) {
    if (!actor?.id || !['customer', 'staff', 'admin'].includes(actor.role)) throw new ServiceError(401, 'AUTH_REQUIRED', 'Cần đăng nhập để quản lý đánh giá');
  }

  async function getOrder(actor, orderId) {
    if (typeof commerce.getOwnedOrder !== 'function') throw SUPPORT_REVIEW_ERROR('Xác minh quyền sở hữu đơn hàng chưa sẵn sàng');
    try { return await commerce.getOwnedOrder(actor, orderId); } catch (error) {
      if (error?.status === 404 || error?.code === 'NOT_FOUND') throw notFound();
      throw error;
    }
  }

  async function assertAttachments(actor, ids, orderId) {
    if (!ids.length) return [];
    const rows = await attachmentRepo.listReviewAttachments(ids);
    if (rows.length !== ids.length || rows.some((row) => idOf(row.uploadedByUserId) !== idOf(actor.id)
      || row.purpose !== 'review' || row.state !== 'ready' || idOf(row.orderId) !== idOf(orderId) || row.reviewId)) {
      throw notFound();
    }
    return rows;
  }

  async function appendAudit(actor, context, review, action, changesRedacted) {
    const append = audit.appendAudit || audit.append;
    if (typeof append !== 'function') throw SUPPORT_REVIEW_ERROR('Ghi nhật ký kiểm duyệt chưa sẵn sàng');
    return append.call(audit, {
      actorId: safeAuditId(actor), actorRole: actor.role,
      requestId: context?.requestId || `review:${idOf(review)}`,
      action, targetType: 'review', targetId: idOf(review), outcome: 'success',
      reasonCode: action === 'review.moderated'
        ? (changesRedacted.status === 'hidden' ? 'REVIEW_HIDDEN' : 'REVIEW_PUBLISHED')
        : action === 'review.created' ? 'REVIEW_SUBMITTED' : 'REVIEW_EDITED',
      changesRedacted,
    }, { session: context?.session });
  }

  return Object.freeze({
    async listOwnReviews(actor, filters = {}) {
      requireActor(actor);
      const query = validateListQuery(filters, { statusValues: ['pending', 'published', 'hidden'] });
      const result = await repo.listOwn(actor.id, query);
      return { items: result.items.map((review) => reviewDto(review, { ownerView: true })), pagination: pageMeta(query.page, query.limit, result.total) };
    },

    async createReview(actor, input, context = {}) {
      requireActor(actor);
      const data = validateReviewCreate(input);
      const order = await getOrder(actor, data.orderId);
      if (!order || order.status !== 'delivered' || !orderItems(order).includes(data.productId)) {
        throw new ServiceError(422, 'REVIEW_NOT_ELIGIBLE', 'Chỉ đánh giá sản phẩm trong đơn hàng đã giao');
      }
      const attachments = await assertAttachments(actor, data.attachmentIds, data.orderId);
      if (attachments.some((row) => row.visibility !== 'customer')) throw new ServiceError(403, 'FORBIDDEN', 'Ảnh đánh giá không thể là ghi chú nội bộ');
      const transaction = repo.transaction;
      if (typeof transaction !== 'function') throw SUPPORT_REVIEW_ERROR('Transaction đánh giá chưa sẵn sàng');
      try {
        return await transaction.call(repo, async (session) => {
          const review = await repo.create({
            userId: actor.id, orderId: data.orderId, productId: data.productId,
            rating: data.rating, comment: data.comment, attachmentIds: data.attachmentIds,
            consentToPublishAttachments: data.consentToPublishAttachments,
            moderationStatus: 'pending', version: 0,
          }, { session });
          if (data.attachmentIds.length) {
            const linked = await repo.linkAttachments(data.attachmentIds, actor.id, review._id ?? review.id, { session });
            if (linked.modifiedCount !== data.attachmentIds.length) throw conflict('VERSION_CONFLICT', 'Ảnh đã được gắn vào đánh giá khác');
          }
          await appendAudit(actor, { ...context, session }, review, 'review.created', {
            status: 'pending', attachmentCount: data.attachmentIds.length,
          });
          return reviewDto(review, { ownerView: true });
        });
      } catch (error) {
        if (isDuplicate(error)) throw conflict('ALREADY_REVIEWED', 'Bạn đã đánh giá sản phẩm này trong đơn hàng');
        throw error;
      }
    },

    async updateOwnReview(actor, id, input, context = {}) {
      requireActor(actor);
      const reviewId = validateObjectId(id);
      const patch = validateReviewWrite(input);
      const transaction = repo.transaction;
      if (typeof transaction !== 'function') throw SUPPORT_REVIEW_ERROR('Transaction đánh giá chưa sẵn sàng');
      return transaction.call(repo, async (session) => {
        const review = await repo.findById(reviewId, { session });
        if (!review || idOf(review.userId) !== idOf(actor.id)) throw notFound();
        if (review.version !== patch.expectedVersion) throw conflict('VERSION_CONFLICT');
        const updated = await repo.update(reviewId, patch.expectedVersion, {
          rating: patch.rating, comment: patch.comment, moderationStatus: 'pending',
          moderatedBy: null, moderatedAt: null, moderationReason: null,
        }, { session });
        if (!updated) throw conflict('VERSION_CONFLICT');
        await appendAudit(actor, { ...context, session }, updated, 'review.edited', {
          previousStatus: review.moderationStatus,
          status: 'pending',
          ratingChanged: review.rating !== patch.rating,
          commentChanged: review.comment !== patch.comment,
        });
        return reviewDto(updated, { ownerView: true });
      });
    },

    async listAdminReviews(filters = {}) {
      const query = validateListQuery(filters, { statusValues: ['pending', 'published', 'hidden'] });
      if (filters.productId !== undefined) query.productId = validateObjectId(filters.productId, 'productId');
      const result = await repo.listAdmin(query);
      return { items: result.items.map((review) => reviewDto(review)), pagination: pageMeta(query.page, query.limit, result.total) };
    },

    async moderateReview(actor, id, input, context = {}) {
      const reviewId = validateObjectId(id);
      const data = validateReviewModeration(input);
      if (actor?.role !== 'admin') throw new ServiceError(403, 'FORBIDDEN', 'Chỉ quản trị viên có thể kiểm duyệt đánh giá');
      const transaction = repo.transaction;
      if (typeof transaction !== 'function') throw SUPPORT_REVIEW_ERROR('Transaction kiểm duyệt chưa sẵn sàng');
      return transaction.call(repo, async (session) => {
        const review = await repo.findById(reviewId, { session });
        if (!review) throw notFound();
        if (review.version !== data.expectedVersion) throw conflict('VERSION_CONFLICT');
        const updated = await repo.update(reviewId, data.expectedVersion, {
          moderationStatus: data.status, moderatedBy: actor.id, moderatedAt: now(), moderationReason: data.reason,
        }, { session });
        if (!updated) throw conflict('VERSION_CONFLICT');
        await appendAudit(actor, { ...context, session }, updated, 'review.moderated', {
          status: data.status, reasonPresent: Boolean(data.reason),
        });
        if (updated.userId && typeof operations.appendOutbox === 'function') {
          await operations.appendOutbox({
            eventKey: `review.moderated:${idOf(updated)}:${updated.version}`,
            type: 'operations.delivery', aggregateType: 'review', aggregateId: idOf(updated), aggregateVersion: updated.version,
            payload: { deliveries: [{ notification: {
              recipients: [idOf(updated.userId)], category: 'support', title: 'Đánh giá sản phẩm đã cập nhật',
              body: data.status === 'published' ? 'Đánh giá của bạn đã được duyệt.' : 'Đánh giá của bạn chưa được duyệt.',
              href: '/tai-khoan/danh-gia',
            } }] },
          }, { session });
        }
        return reviewDto(updated);
      });
    },

    async listPublishedProductReviews(productId, filters = {}) {
      const id = validateObjectId(productId, 'productId');
      const query = validateListQuery(filters);
      if (typeof catalog.getPublishedProductsByIds !== 'function') throw SUPPORT_REVIEW_ERROR('Xác minh sản phẩm công khai chưa sẵn sàng');
      const products = await catalog.getPublishedProductsByIds([id]);
      if (!products.some((product) => idOf(product) === id)) throw notFound();
      const result = await repo.listPublished(id, query);
      const reviewIds = result.items.flatMap((review) => review.attachmentIds || []);
      const attachments = reviewIds.length ? await attachmentRepo.listReviewAttachments(reviewIds) : [];
      const byId = new Map(attachments.map((row) => [idOf(row), row]));
      const items = result.items.map((review) => {
        const dto = reviewDto(review, { publicView: true });
        const approvedImages = review.consentToPublishAttachments === true
          ? (review.attachmentIds || []).map((attachmentId) => byId.get(idOf(attachmentId)))
            .filter((attachment) => attachment?.publicDerivativeUrl && attachment.consentToPublishAt)
            .map((attachment) => ({ url: attachment.publicDerivativeUrl }))
          : [];
        return { ...dto, images: approvedImages };
      });
      return { items, pagination: pageMeta(query.page, query.limit, result.total) };
    },
  });
}
