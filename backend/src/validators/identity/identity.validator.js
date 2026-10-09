import { ServiceError } from '../../utils/serviceError.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const ROLES = new Set(['customer', 'staff', 'admin']);
const INVITE_ROLES = new Set(['customer', 'staff']);
const STATUSES = new Set(['active', 'blocked']);
const APPEAL_DECISIONS = new Set(['approved', 'rejected']);
const GENDERS = new Set(['female', 'male', 'other', 'prefer_not_to_say']);

function validationError(details) {
  throw new ServiceError(400, 'VALIDATION_ERROR', 'Dữ liệu chưa hợp lệ', details);
}

function recordBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) validationError([{ field: 'body', code: 'OBJECT_REQUIRED', message: 'Nội dung phải là một đối tượng JSON' }]);
  return body;
}

function strictKeys(body, allowed) {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length) validationError(unknown.map((field) => ({ field, code: 'UNKNOWN_FIELD', message: 'Trường này không được hỗ trợ' })));
}

function required(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined);
  if (missing.length) validationError(missing.map((field) => ({ field, code: 'REQUIRED', message: 'Trường này là bắt buộc' })));
}

function string(body, field, { min = 0, max = 5000, pattern, optional = false } = {}) {
  const value = body[field];
  if (value === undefined && optional) return;
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || (pattern && !pattern.test(value.trim()))) {
    validationError([{ field, code: 'INVALID', message: 'Giá trị trường chưa hợp lệ' }]);
  }
}

function integer(body, field, { min = 0, optional = false } = {}) {
  const value = body[field];
  if (value === undefined && optional) return;
  if (!Number.isSafeInteger(value) || value < min) validationError([{ field, code: 'INVALID', message: 'Giá trị phải là số nguyên hợp lệ' }]);
}

function email(body, field = 'email') {
  string(body, field, { min: 3, max: 254, pattern: EMAIL_PATTERN });
}

function token(body, field = 'token') {
  string(body, field, { min: 20, max: 256, pattern: /^[A-Za-z0-9_-]+$/u });
}

function dateOnly(body, field, { optional = false } = {}) {
  const value = body[field];
  if (value === undefined && optional) return;
  if (value === null) return;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    validationError([{ field, code: 'INVALID', message: 'Ngày chưa đúng định dạng YYYY-MM-DD' }]);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    || value < '1900-01-01' || value > new Date().toISOString().slice(0, 10)) {
    validationError([{ field, code: 'INVALID', message: 'Ngày sinh phải là ngày hợp lệ trong quá khứ' }]);
  }
}

export function validateIdentityBody(schema) {
  return (req, _res, next) => {
    try {
      const body = recordBody(req.body);
      const spec = {
        register: { allowed: ['name', 'email', 'password', 'phone'], required: ['name', 'email', 'password'] },
        invitationAccept: { allowed: ['token', 'password', 'name'], required: ['token', 'password', 'name'] },
        token: { allowed: ['token'], required: ['token'] },
        email: { allowed: ['email'], required: ['email'] },
        login: { allowed: ['email', 'password'], required: ['email', 'password'] },
        reset: { allowed: ['token', 'password'], required: ['token', 'password'] },
        changeEmail: { allowed: ['email', 'currentPassword'], required: ['email', 'currentPassword'] },
        verifyEmailChange: { allowed: ['challengeId', 'verificationCode'], required: ['challengeId', 'verificationCode'] },
        changePassword: { allowed: ['currentPassword', 'newPassword'], required: ['currentPassword', 'newPassword'] },
        appealAccess: { allowed: ['email', 'verificationCode', 'challengeId'], required: ['email', 'verificationCode', 'challengeId'] },
        appealSubmit: { allowed: ['message'], required: ['message'] },
        profile: { allowed: ['name', 'phone', 'birthDate', 'gender'], required: [] },
        invite: { allowed: ['name', 'email', 'role'], required: ['name', 'email', 'role'] },
        adminUser: { allowed: ['name', 'phone', 'expectedVersion'], required: ['expectedVersion'] },
        status: { allowed: ['status', 'reason', 'expectedVersion'], required: ['status', 'reason', 'expectedVersion'] },
        role: { allowed: ['role', 'reason', 'expectedVersion'], required: ['role', 'reason', 'expectedVersion'] },
        adminPasswordReset: { allowed: ['reason'], required: ['reason'] },
        appealDecision: { allowed: ['decision', 'reviewNote', 'expectedVersion'], required: ['decision', 'reviewNote', 'expectedVersion'] },
      }[schema];
      if (!spec) throw new TypeError(`Unknown identity body schema: ${schema}`);
      strictKeys(body, spec.allowed);
      required(body, spec.required);
      switch (schema) {
        case 'register':
          string(body, 'name', { min: 1, max: 120 }); email(body); string(body, 'password', { min: 12, max: 128 }); string(body, 'phone', { max: 30, optional: true });
          break;
        case 'invitationAccept':
          token(body); string(body, 'password', { min: 12, max: 128 }); string(body, 'name', { min: 1, max: 120 });
          break;
        case 'token': token(body); break;
        case 'email': email(body); break;
        case 'login': email(body); string(body, 'password', { min: 1, max: 128 }); break;
        case 'reset': token(body); string(body, 'password', { min: 12, max: 128 }); break;
        case 'changeEmail': email(body); string(body, 'currentPassword', { min: 1, max: 128 }); break;
        case 'verifyEmailChange':
          string(body, 'challengeId', { min: 20, max: 64, pattern: /^[A-Za-z0-9_-]+$/u });
          string(body, 'verificationCode', { min: 6, max: 6, pattern: /^\d{6}$/u });
          break;
        case 'changePassword':
          string(body, 'currentPassword', { min: 1, max: 128 });
          string(body, 'newPassword', { min: 12, max: 128 });
          break;
        case 'appealAccess':
          email(body); string(body, 'verificationCode', { min: 6, max: 6, pattern: /^\d{6}$/u }); string(body, 'challengeId', { min: 20, max: 64, pattern: /^[A-Za-z0-9_-]+$/u });
          break;
        case 'appealSubmit': string(body, 'message', { min: 1, max: 5000 }); break;
        case 'profile':
          if (!Object.keys(body).length) validationError([{ field: 'body', code: 'EMPTY', message: 'Cần ít nhất một trường để cập nhật' }]);
          string(body, 'name', { min: 1, max: 120, optional: true }); string(body, 'phone', { max: 30, optional: true });
          dateOnly(body, 'birthDate', { optional: true });
          if (body.gender !== undefined && body.gender !== null && !GENDERS.has(body.gender)) validationError([{ field: 'gender', code: 'INVALID', message: 'Giá trị giới tính không hợp lệ' }]);
          break;
        case 'invite':
          string(body, 'name', { min: 1, max: 120 }); email(body); if (!INVITE_ROLES.has(body.role)) validationError([{ field: 'role', code: 'INVALID', message: 'Vai trò lời mời không hợp lệ' }]);
          break;
        case 'adminUser':
          integer(body, 'expectedVersion'); string(body, 'name', { min: 1, max: 120, optional: true }); string(body, 'phone', { max: 30, optional: true });
          break;
        case 'status':
          if (!STATUSES.has(body.status)) validationError([{ field: 'status', code: 'INVALID', message: 'Trạng thái không hợp lệ' }]);
          string(body, 'reason', { min: 1, max: 1000 }); integer(body, 'expectedVersion');
          break;
        case 'role':
          if (!ROLES.has(body.role)) validationError([{ field: 'role', code: 'INVALID', message: 'Vai trò không hợp lệ' }]);
          string(body, 'reason', { min: 1, max: 1000 }); integer(body, 'expectedVersion');
          break;
        case 'adminPasswordReset':
          string(body, 'reason', { min: 1, max: 1000 });
          break;
        case 'appealDecision':
          if (!APPEAL_DECISIONS.has(body.decision)) validationError([{ field: 'decision', code: 'INVALID', message: 'Quyết định không hợp lệ' }]);
          string(body, 'reviewNote', { min: 1, max: 1000 }); integer(body, 'expectedVersion');
          break;
        default: break;
      }
      req.validatedBody = body;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateIdentityId(paramName = 'id') {
  return (req, _res, next) => {
    const value = req.params[paramName];
    if (typeof value !== 'string' || !/^[a-f\d]{24}$/iu.test(value)) {
      return next(new ServiceError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên'));
    }
    return next();
  };
}

export function parseIdentityPage(query) {
  const parse = (name, fallback, max) => {
    const raw = query[name];
    if (raw === undefined) return fallback;
    if (!/^\d+$/u.test(String(raw))) validationError([{ field: name, code: 'INVALID', message: 'Giá trị phân trang không hợp lệ' }]);
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > max) validationError([{ field: name, code: 'INVALID', message: 'Giá trị phân trang không hợp lệ' }]);
    return value;
  };
  return { page: parse('page', 1, Number.MAX_SAFE_INTEGER), limit: parse('limit', 20, 100) };
}

export function validateUserFilters(query) {
  const role = query.role === undefined ? undefined : String(query.role);
  const status = query.status === undefined ? undefined : String(query.status);
  if (role !== undefined && !ROLES.has(role)) validationError([{ field: 'role', code: 'INVALID', message: 'Vai trò không hợp lệ' }]);
  if (status !== undefined && !STATUSES.has(status)) validationError([{ field: 'status', code: 'INVALID', message: 'Trạng thái không hợp lệ' }]);
  const q = query.q === undefined ? undefined : String(query.q).trim();
  if (q && q.length > 120) validationError([{ field: 'q', code: 'TOO_LONG', message: 'Từ khóa quá dài' }]);
  return { ...(q ? { q } : {}), ...(role ? { role } : {}), ...(status ? { status } : {}), ...parseIdentityPage(query) };
}

export function validateAppealFilters(query) {
  const status = query.status === undefined ? undefined : String(query.status);
  if (status !== undefined && !['pending', 'approved', 'rejected'].includes(status)) {
    validationError([{ field: 'status', code: 'INVALID', message: 'Trạng thái kháng nghị không hợp lệ' }]);
  }
  return { ...(status ? { status } : {}), ...parseIdentityPage(query) };
}
