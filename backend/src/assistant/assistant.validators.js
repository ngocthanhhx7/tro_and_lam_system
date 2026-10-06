import { ServiceError } from '../utils/serviceError.js';

const CONVERSATION_ID = /^[a-f\d]{24}$/i;
const FIELDS = new Set(['conversationId', 'message', 'consent']);

function invalid(field, message = 'Dữ liệu không hợp lệ') {
  return new ServiceError(422, 'VALIDATION_ERROR', message, [{ field, code: 'INVALID_VALUE', message }]);
}

export function validateAssistantMessage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('body');
  const extra = Object.keys(value).find((key) => !FIELDS.has(key));
  if (extra) throw invalid(extra, 'Trường này không được hỗ trợ');
  if (typeof value.message !== 'string') throw invalid('message');
  const message = value.message.normalize('NFKC').trim();
  if (!message || message.length > 5000) throw invalid('message', 'Nội dung cần từ 1 đến 5000 ký tự');
  if (value.consent !== true) throw invalid('consent', 'Bạn cần đồng ý trước khi gửi câu hỏi');
  if (value.conversationId !== undefined
    && (typeof value.conversationId !== 'string' || !CONVERSATION_ID.test(value.conversationId))) {
    throw invalid('conversationId');
  }
  return {
    ...(value.conversationId === undefined ? {} : { conversationId: value.conversationId.toLowerCase() }),
    message,
    consent: true,
  };
}
