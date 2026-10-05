import { createHash } from 'node:crypto';
import { ServiceError } from '../../../utils/serviceError.js';

export const MAIL_TEMPLATE_KEYS = Object.freeze([
  'verify_email', 'reset_password', 'order_access_code', 'order_confirmation',
  'order_update', 'ticket_reply', 'appeal_access_code', 'appeal_update',
  'account_status_update', 'new_lead', 'user_invitation',
]);

const TEMPLATE_COPY = Object.freeze({
  verify_email: { subject: 'Xác minh địa chỉ email', title: 'Xác minh email TRO & LAM', key: 'actionUrl' },
  reset_password: { subject: 'Yêu cầu đặt lại mật khẩu', title: 'Đặt lại mật khẩu', key: 'actionUrl' },
  order_access_code: { subject: 'Mã xác minh tra cứu đơn hàng', title: 'Mã xác minh đơn hàng', key: 'code' },
  order_confirmation: { subject: 'TRO & LAM đã tiếp nhận đơn hàng', title: 'Đã tiếp nhận đơn hàng', key: 'orderCode' },
  order_update: { subject: 'Cập nhật đơn hàng TRO & LAM', title: 'Cập nhật đơn hàng', key: 'orderCode' },
  ticket_reply: { subject: 'Có cập nhật yêu cầu hỗ trợ', title: 'Yêu cầu hỗ trợ có cập nhật', key: 'ticketCode' },
  appeal_access_code: { subject: 'Mã xác minh kháng nghị TRO & LAM', title: 'Xác minh kháng nghị tài khoản', key: 'verificationCode' },
  appeal_update: { subject: 'Cập nhật yêu cầu xem xét tài khoản', title: 'Cập nhật kháng nghị', key: 'appealStatus' },
  account_status_update: { subject: 'Cập nhật tài khoản TRO & LAM', title: 'Cập nhật tài khoản', key: 'status' },
  new_lead: { subject: 'Có yêu cầu tư vấn mới', title: 'Yêu cầu tư vấn mới', key: 'reference' },
  user_invitation: { subject: 'Lời mời tham gia TRO & LAM', title: 'Lời mời tài khoản TRO & LAM', key: 'actionUrl' },
});

const ROLE_COPY = Object.freeze({ customer: 'khách hàng', staff: 'nhân viên', admin: 'quản trị viên' });
const ACCOUNT_STATUS_COPY = Object.freeze({ active: 'đang hoạt động', blocked: 'đã tạm khóa' });
const APPEAL_DECISION_COPY = Object.freeze({ approved: 'đã được chấp thuận', rejected: 'chưa được chấp thuận' });

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function plainValue(value, key, maxLength = 500) {
  if (typeof value !== 'string' || value.length > maxLength || hasHeaderControl(value)) {
    throw new ServiceError(400, 'VALIDATION_ERROR', `Trường thư ${key} không hợp lệ`);
  }
  return value;
}

function bodyValue(value, key, maxLength = 1000) {
  if (typeof value !== 'string' || value.length > maxLength || hasUnsafeBodyControl(value)) {
    throw new ServiceError(400, 'VALIDATION_ERROR', `Trường thư ${key} không hợp lệ`);
  }
  return value.trim();
}

function hasUnsafeBodyControl(value) {
  for (const character of value) {
    const codePoint = character.charCodeAt(0);
    if ((codePoint < 0x20 && ![0x09, 0x0a, 0x0d].includes(codePoint)) || codePoint === 0x7f) return true;
  }
  return false;
}

function hasHeaderControl(value) {
  for (const character of value) {
    const codePoint = character.charCodeAt(0);
    if (codePoint < 0x20 || codePoint === 0x7f) return true;
  }
  return false;
}

function safeEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email) && !/[\r\n]/.test(email);
}

function safeActionUrl(value, publicWebUrl) {
  const url = plainValue(value, 'actionUrl', 1000);
  if (!publicWebUrl) throw new ServiceError(503, 'MAIL_UNAVAILABLE', 'Liên kết thư chưa được cấu hình');
  try {
    const base = new URL(publicWebUrl);
    const parsed = new URL(url, base);
    if (parsed.origin !== base.origin || !['http:', 'https:'].includes(parsed.protocol)) throw new Error('origin');
    return parsed.href;
  } catch {
    throw new ServiceError(400, 'VALIDATION_ERROR', 'Liên kết thư phải cùng origin với website');
  }
}

export function renderMailTemplate(templateKey, variables = {}, { publicWebUrl } = {}) {
  if (!MAIL_TEMPLATE_KEYS.includes(templateKey)) throw new ServiceError(400, 'VALIDATION_ERROR', 'Mail template không được hỗ trợ');
  const template = TEMPLATE_COPY[templateKey];
  let content;
  let actionUrl;

  if (['verify_email', 'reset_password'].includes(templateKey)) {
    actionUrl = safeActionUrl(variables.actionUrl, publicWebUrl);
    content = `Mở liên kết an toàn này để tiếp tục: ${actionUrl}`;
  } else if (templateKey === 'user_invitation') {
    actionUrl = safeActionUrl(variables.actionUrl, publicWebUrl);
    const name = variables.name === undefined ? '' : `Xin chào ${plainValue(variables.name, 'name', 120)}. `;
    const role = variables.role === undefined ? '' : plainValue(variables.role, 'role', 24);
    if (role && !['customer', 'staff', 'admin'].includes(role)) throw new ServiceError(400, 'VALIDATION_ERROR', 'Vai trò trong thư mời không hợp lệ');
    content = `${name}${role ? `Vai trò được mời: ${role}. ` : ''}Mở liên kết an toàn để thiết lập tài khoản.`;
  } else if (templateKey === 'order_access_code') {
    content = `Mã xác minh của bạn: ${plainValue(variables.code, 'code', 20)}`;
  } else if (templateKey === 'order_confirmation') {
    content = `Mã đơn hàng: ${plainValue(variables.orderCode, 'orderCode', 80)}. Đơn hàng đã được tiếp nhận.`;
  } else if (templateKey === 'order_update') {
    content = `Mã đơn hàng: ${plainValue(variables.orderCode, 'orderCode', 80)}. Trạng thái hiện tại: ${plainValue(variables.status, 'status', 80)}.`;
  } else if (templateKey === 'ticket_reply') {
    content = `Mã yêu cầu: ${plainValue(variables.ticketCode, 'ticketCode', 80)}. Nhân viên đã cập nhật yêu cầu của bạn.`;
  } else if (templateKey === 'appeal_access_code') {
    const name = variables.name === undefined ? '' : `Xin chào ${plainValue(variables.name, 'name', 120)}. `;
    const code = plainValue(variables.verificationCode, 'verificationCode', 6);
    const expiry = plainValue(variables.expiresAt, 'expiresAt', 40);
    if (!/^\d{6}$/.test(code)) throw new ServiceError(400, 'VALIDATION_ERROR', 'Mã xác minh kháng nghị không hợp lệ');
    const expiresAt = new Date(expiry);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.toISOString() !== expiry) {
      throw new ServiceError(400, 'VALIDATION_ERROR', 'Thời hạn mã xác minh không hợp lệ');
    }
    const formattedExpiry = new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
    }).format(expiresAt);
    content = `${name}Mã xác minh kháng nghị của bạn: ${code}. Mã có hiệu lực đến ${formattedExpiry}.`;
  } else if (templateKey === 'appeal_update') {
    const reviewNote = variables.reviewNote === undefined ? '' : ` Ghi chú: ${bodyValue(variables.reviewNote, 'reviewNote')}`;
    const appealStatus = plainValue(variables.appealStatus, 'appealStatus', 80);
    const statusCopy = Object.hasOwn(APPEAL_DECISION_COPY, appealStatus) ? APPEAL_DECISION_COPY[appealStatus] : appealStatus;
    const name = variables.name === undefined ? '' : `Xin chào ${plainValue(variables.name, 'name', 120)}. `;
    content = `${name}Trạng thái yêu cầu xem xét: ${statusCopy}.${reviewNote}`;
  } else if (templateKey === 'account_status_update') {
    const name = variables.name === undefined ? '' : `Xin chào ${plainValue(variables.name, 'name', 120)}. `;
    const role = plainValue(variables.role, 'role', 24);
    const status = plainValue(variables.status, 'status', 24);
    const roleCopy = Object.hasOwn(ROLE_COPY, role) ? ROLE_COPY[role] : null;
    const statusCopy = Object.hasOwn(ACCOUNT_STATUS_COPY, status) ? ACCOUNT_STATUS_COPY[status] : null;
    if (!roleCopy || !statusCopy) throw new ServiceError(400, 'VALIDATION_ERROR', 'Vai trò hoặc trạng thái tài khoản không hợp lệ');
    content = `${name}Vai trò tài khoản của bạn: ${roleCopy}. Trạng thái tài khoản: ${statusCopy}.`;
  } else {
    content = `Mã yêu cầu: ${plainValue(variables.reference, 'reference', 80)}. Có yêu cầu mới cần tiếp nhận.`;
  }

  const safeContent = escapeHtml(content);
  const html = `<main lang="vi"><h1>${escapeHtml(template.title)}</h1><p>${safeContent}</p>${actionUrl ? `<p><a href="${escapeHtml(actionUrl)}">Mở trang TRO &amp; LAM</a></p>` : ''}<p>TRO &amp; LAM</p></main>`;
  return { subject: template.subject, text: content, html };
}

function messageIdFor(eventId, fromAddress) {
  const from = String(fromAddress).match(/@([^\s>]+)/)?.[1]?.replace(/[>\s]/g, '');
  if (!from) throw new ServiceError(503, 'MAIL_UNAVAILABLE', 'Địa chỉ gửi thư chưa được cấu hình');
  const digest = createHash('sha256').update(String(eventId)).digest('hex');
  return `<${digest}@${from}>`;
}

export function createSmtpProvider({ transporter, from, publicWebUrl, timeoutMs = 15_000 } = {}) {
  async function send({ eventId, to, templateKey, variables }) {
    if (!transporter || typeof transporter.sendMail !== 'function' || !from || hasHeaderControl(from)) {
      throw new ServiceError(503, 'MAIL_UNAVAILABLE', 'Dịch vụ email chưa được cấu hình');
    }
    if (typeof eventId !== 'string' || !eventId || eventId.length > 240 || /[\r\n]/.test(eventId) || !safeEmail(to)) {
      throw new ServiceError(400, 'VALIDATION_ERROR', 'Thông tin gửi thư không hợp lệ');
    }
    const rendered = renderMailTemplate(templateKey, variables, { publicWebUrl });
    const messageId = messageIdFor(eventId, from);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) {
      throw new TypeError('SMTP timeout must be between 100 and 120000 milliseconds');
    }
    let timeout;
    try {
      const sending = Promise.resolve(transporter.sendMail({ from, to, ...rendered, messageId }));
      const timedOut = new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('SMTP timeout')), timeoutMs);
        timeout.unref?.();
      });
      await Promise.race([sending, timedOut]);
      return { accepted: true, messageId };
    } catch {
      throw new ServiceError(503, 'MAIL_UNAVAILABLE', 'SMTP chưa tiếp nhận email');
    } finally {
      clearTimeout(timeout);
    }
  }

  return Object.freeze({ send });
}
