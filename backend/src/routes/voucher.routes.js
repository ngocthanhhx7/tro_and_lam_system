import { Router } from 'express';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { ServiceError } from '../utils/serviceError.js';
import { createVoucherService } from '../services/commerce/voucher.service.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const CODE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/u;
const OBJECT_ID = /^[a-f\d]{24}$/iu;

function validateIssue(body = {}) {
  const allowed = ['scope', 'maxRedemptions', 'email', 'code', 'title', 'discountType', 'discountValue', 'maxDiscountVnd', 'minSubtotalVnd', 'expiresAt'];
  const unknown = Object.keys(body || {}).filter((key) => !allowed.includes(key));
  const errors = unknown.map((field) => ({ field, code: 'UNKNOWN_FIELD', message: 'Trường này không được hỗ trợ' }));
  const invalid = (field, message = 'Giá trị chưa hợp lệ') => errors.push({ field, code: 'INVALID', message });
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ServiceError(400, 'VALIDATION_ERROR', 'Nội dung phải là đối tượng JSON');
  if (body.scope !== undefined && !['customer', 'public'].includes(body.scope)) invalid('scope');
  if (body.scope === 'public') {
    if (body.email !== undefined) invalid('email', 'Mã dùng chung không gắn email khách hàng');
    if (!Number.isSafeInteger(body.maxRedemptions) || body.maxRedemptions < 1 || body.maxRedemptions > 1000000) invalid('maxRedemptions');
  } else {
    if (typeof body.email !== 'string' || !EMAIL.test(body.email.trim()) || body.email.length > 254) invalid('email');
    if (body.maxRedemptions !== undefined) invalid('maxRedemptions', 'Voucher riêng dùng một lần');
  }
  if (typeof body.code !== 'string' || !CODE.test(body.code.trim().toUpperCase())) invalid('code');
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 120) invalid('title');
  if (!['fixed', 'percent'].includes(body.discountType)) invalid('discountType');
  if (!Number.isSafeInteger(body.discountValue) || body.discountValue < 1
    || (body.discountType === 'percent' && body.discountValue > 100)) invalid('discountValue');
  if (body.maxDiscountVnd !== undefined && (!Number.isSafeInteger(body.maxDiscountVnd) || body.maxDiscountVnd < 1)) invalid('maxDiscountVnd');
  if (body.discountType === 'fixed' && body.maxDiscountVnd !== undefined) invalid('maxDiscountVnd', 'Mức giảm tối đa chỉ áp dụng cho voucher phần trăm');
  if (body.minSubtotalVnd !== undefined && (!Number.isSafeInteger(body.minSubtotalVnd) || body.minSubtotalVnd < 0)) invalid('minSubtotalVnd');
  if (typeof body.expiresAt !== 'string' || !Number.isFinite(Date.parse(body.expiresAt))) invalid('expiresAt');
  if (errors.length) throw new ServiceError(400, 'VALIDATION_ERROR', 'Thông tin voucher chưa hợp lệ', errors);
  return body;
}

export function createVoucherRouter({ identity, service, models, auditPort } = {}) {
  if (!identity?.requireActor || !identity?.requireCapability || !identity?.csrfProtection) {
    throw new TypeError('Voucher router requires P02 identity middleware');
  }
  const voucherService = service || createVoucherService({ models, auditPort });
  const router = Router();
  const requireCustomerVoucherAccess = [identity.requireCapability('self.vouchers')];
  const requireVoucherManagement = [identity.requireCapability('vouchers.manage')];

  router.post('/vouchers/resolve', identity.csrfProtection, async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length !== 1
      || typeof req.body.code !== 'string' || !CODE.test(req.body.code.trim().toUpperCase())) {
      throw new ServiceError(400, 'VALIDATION_ERROR', 'Mã voucher cần từ 3–40 ký tự chữ, số, dấu gạch ngang hoặc gạch dưới');
    }
    return sendSuccess(res, await voucherService.resolvePublicCode(req.body.code));
  });

  router.get('/account/vouchers', ...requireCustomerVoucherAccess, async (req, res) => {
    return sendSuccess(res, await voucherService.listMine(req.actor.id));
  });
  router.post('/account/vouchers/resolve', ...requireCustomerVoucherAccess, identity.csrfProtection, async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
      || Object.keys(req.body).length !== 1 || typeof req.body.code !== 'string'
      || !CODE.test(req.body.code.trim().toUpperCase())) {
      throw new ServiceError(400, 'VALIDATION_ERROR', 'Mã voucher cần từ 3–40 ký tự chữ, số, dấu gạch ngang hoặc gạch dưới');
    }
    return sendSuccess(res, await voucherService.resolveCode(req.actor.id, req.body.code));
  });
  router.get('/admin/vouchers', ...requireVoucherManagement, async (_req, res) => {
    return sendSuccess(res, await voucherService.listAdmin());
  });
  router.post('/admin/vouchers', ...requireVoucherManagement, identity.csrfProtection, async (req, res) => {
    return sendCreated(res, await voucherService.issue(req.actor, validateIssue(req.body), { requestId: res.locals.requestId }));
  });
  router.post('/admin/vouchers/:id/revoke', ...requireVoucherManagement, identity.csrfProtection, async (req, res) => {
    if (!OBJECT_ID.test(req.params.id)) throw new ServiceError(404, 'NOT_FOUND', 'Không tìm thấy voucher');
    return sendSuccess(res, await voucherService.revoke(req.actor, req.params.id, { requestId: res.locals.requestId }));
  });

  Object.defineProperty(router, 'voucherService', { value: voucherService, enumerable: false });
  return router;
}
