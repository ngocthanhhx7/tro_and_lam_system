import mongoose from 'mongoose';
import { Voucher as DefaultVoucher } from '../../models/commerce/voucher.model.js';
import { User as DefaultUser } from '../../models/identity/user.model.js';
import { ServiceError } from '../../utils/serviceError.js';

const idOf = (value) => String(value?._id ?? value?.id ?? value);

function fail(status, code, message) {
  throw new ServiceError(status, code, message);
}

function asVoucher(value, { includeCustomer = false } = {}) {
  const row = value?.toObject ? value.toObject() : value;
  const expiresAt = new Date(row.expiresAt);
  const expired = expiresAt <= new Date();
  return {
    id: idOf(row),
    code: row.code,
    title: row.title,
    discountType: row.discountType,
    discountValue: row.discountValue,
    ...(row.maxDiscountVnd ? { maxDiscountVnd: row.maxDiscountVnd } : {}),
    minSubtotalVnd: row.minSubtotalVnd,
    expiresAt: expiresAt.toISOString(),
    status: row.status === 'available' && expired ? 'expired' : row.status,
    ...(row.redeemedAt ? { redeemedAt: new Date(row.redeemedAt).toISOString() } : {}),
    ...(row.redeemedOrderId ? { redeemedOrderId: idOf(row.redeemedOrderId) } : {}),
    ...(includeCustomer ? { customer: row.userId && {
      id: idOf(row.userId), name: row.userId.name, email: row.userId.emailNormalized,
    } } : {}),
  };
}

function calculateDiscount(voucher, subtotalVnd) {
  if (!Number.isSafeInteger(subtotalVnd) || subtotalVnd < voucher.minSubtotalVnd) {
    fail(422, 'VOUCHER_MINIMUM_NOT_MET', 'Đơn hàng chưa đạt giá trị tối thiểu của voucher');
  }
  const amount = voucher.discountType === 'fixed'
    ? voucher.discountValue
    : Math.floor((subtotalVnd * voucher.discountValue) / 100);
  const discount = Math.min(subtotalVnd, voucher.maxDiscountVnd ? Math.min(amount, voucher.maxDiscountVnd) : amount);
  if (discount < 1) fail(422, 'VOUCHER_NOT_APPLICABLE', 'Giá trị đơn hàng quá thấp để áp dụng voucher này');
  return discount;
}

export function createVoucherService({ Voucher = DefaultVoucher, User = DefaultUser, auditPort, notificationService, now = () => new Date() } = {}) {
  async function listMine(userId) {
    const rows = await Voucher.find({ userId }).sort({ createdAt: -1, _id: -1 }).limit(100).lean();
    return rows.map((row) => asVoucher(row));
  }

  async function listAdmin() {
    const rows = await Voucher.find({}).populate({ path: 'userId', select: 'name emailNormalized' })
      .sort({ createdAt: -1, _id: -1 }).limit(200).exec();
    return rows.map((row) => asVoucher(row, { includeCustomer: true }));
  }

  async function issue(actor, input, { requestId } = {}) {
    const email = input.email.normalize('NFKC').trim().toLowerCase();
    const createdAt = now();
    const expiresAt = new Date(input.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= createdAt) {
      fail(400, 'VALIDATION_ERROR', 'Ngày hết hạn phải ở trong tương lai');
    }
    let targetUserId;
    let created;
    try {
      await mongoose.connection.transaction(async (session) => {
        const customer = await User.findOne({ emailNormalized: email, role: 'customer', status: 'active' }).session(session).exec();
        if (!customer) fail(404, 'CUSTOMER_NOT_FOUND', 'Không tìm thấy tài khoản customer đang hoạt động với email này');
        targetUserId = customer._id;
        const [voucher] = await Voucher.create([{
          userId: customer._id,
          code: input.code.trim().toUpperCase(),
          title: input.title.trim(),
          discountType: input.discountType,
          discountValue: input.discountValue,
          ...(input.maxDiscountVnd ? { maxDiscountVnd: input.maxDiscountVnd } : {}),
          minSubtotalVnd: input.minSubtotalVnd ?? 0,
          expiresAt,
          status: 'available',
          createdBy: actor.id,
        }], { session });
        created = voucher;
        if (typeof notificationService?.appendForDelivery === 'function') {
          await notificationService.appendForDelivery({
            recipients: [idOf(customer)], category: 'promotion',
            title: 'Bạn có voucher mới',
            body: 'Voucher mới đã được thêm vào kho ưu đãi của bạn.',
            href: '/tai-khoan/voucher',
          }, `voucher.issued:${idOf(voucher)}`, { session });
        }
        await auditPort?.appendAudit({
          actorId: actor.id, actorRole: actor.role, requestId,
          action: 'voucher.issue', targetType: 'voucher', targetId: idOf(voucher), outcome: 'success',
          changesRedacted: {
            code: voucher.code, discountType: voucher.discountType,
            discountValue: voucher.discountValue, userId: idOf(customer),
          }, createdAt,
        }, { session });
      });
    } catch (error) {
      if (error?.code === 11000) fail(409, 'VOUCHER_CODE_IN_USE', 'Mã voucher đã tồn tại');
      throw error;
    }
    return asVoucher({ ...created.toObject(), userId: { _id: targetUserId, name: undefined, emailNormalized: email } }, { includeCustomer: true });
  }

  async function revoke(actor, id, { requestId } = {}) {
    return mongoose.connection.transaction(async (session) => {
      const voucher = await Voucher.findOneAndUpdate(
        { _id: id, status: 'available' }, { $set: { status: 'revoked' } }, { returnDocument: 'after', session },
      ).exec();
      if (!voucher) fail(404, 'VOUCHER_NOT_AVAILABLE', 'Không tìm thấy voucher còn có thể thu hồi');
      await auditPort?.appendAudit({
        actorId: actor.id, actorRole: actor.role, requestId,
        action: 'voucher.revoke', targetType: 'voucher', targetId: idOf(voucher), outcome: 'success',
        changesRedacted: { code: voucher.code, status: 'revoked' }, createdAt: now(),
      }, { session });
      return asVoucher(voucher);
    });
  }

  async function quote(userId, voucherId, subtotalVnd, { session } = {}) {
    if (!userId || !mongoose.isValidObjectId(voucherId)) fail(404, 'VOUCHER_NOT_AVAILABLE', 'Voucher không khả dụng');
    const voucher = await Voucher.findOne({ _id: voucherId, userId, status: 'available', expiresAt: { $gt: now() } })
      .session(session || null).exec();
    if (!voucher) fail(422, 'VOUCHER_NOT_AVAILABLE', 'Voucher không tồn tại, đã hết hạn hoặc đã được sử dụng');
    return {
      id: idOf(voucher), code: voucher.code, title: voucher.title,
      discountType: voucher.discountType,
      discountVnd: calculateDiscount(voucher, subtotalVnd),
    };
  }

  async function redeem(userId, voucherId, orderId, subtotalVnd, { session } = {}) {
    const details = await quote(userId, voucherId, subtotalVnd, { session });
    const redeemedAt = now();
    const updated = await Voucher.findOneAndUpdate(
      { _id: voucherId, userId, status: 'available', expiresAt: { $gt: redeemedAt } },
      { $set: { status: 'redeemed', redeemedAt, redeemedOrderId: orderId } },
      { returnDocument: 'after', session },
    ).exec();
    if (!updated) fail(409, 'VOUCHER_NOT_AVAILABLE', 'Voucher vừa được sử dụng ở một đơn hàng khác');
    return { ...details, discountType: updated.discountType };
  }

  async function releaseForOrder(orderId, { session } = {}) {
    const voucher = await Voucher.findOne({ redeemedOrderId: orderId, status: 'redeemed' }).session(session || null).exec();
    if (!voucher) return false;
    if (voucher.expiresAt <= now()) {
      voucher.status = 'expired';
      await voucher.save({ session });
      return false;
    }
    voucher.status = 'available';
    voucher.redeemedAt = undefined;
    voucher.redeemedOrderId = undefined;
    await voucher.save({ session });
    return true;
  }

  return Object.freeze({ listMine, listAdmin, issue, revoke, quote, redeem, releaseForOrder });
}
