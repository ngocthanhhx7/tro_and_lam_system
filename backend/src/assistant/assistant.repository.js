import { AiConversation } from './assistant.models.js';
import { notFound } from '../utils/serviceError.js';

const MAX_MESSAGES = 12;

function ownerFilter(owner) {
  if (owner?.userId) return { ownerUserId: owner.userId, guestHash: { $exists: false } };
  if (owner?.guestHash) return { guestHash: owner.guestHash, ownerUserId: { $exists: false } };
  throw notFound();
}

function ownerFields(owner) {
  if (owner?.userId) return { ownerUserId: owner.userId };
  if (owner?.guestHash) return { guestHash: owner.guestHash };
  throw notFound();
}

function toPlain(document) {
  return document?.toObject ? document.toObject() : document;
}

export function createAssistantRepository({ Conversation = AiConversation } = {}) {
  return Object.freeze({
    async create(owner, { expiresAt, consentAt }) {
      const [created] = await Conversation.create([{
        ...ownerFields(owner),
        messagesRedacted: [],
        expiresAt,
        ...(consentAt ? { consentAt } : {}),
      }]);
      return toPlain(created);
    },

    async findOwned(id, owner, at = new Date()) {
      const document = await Conversation.findOne({
        _id: id,
        ...ownerFilter(owner),
        expiresAt: { $gt: at },
      }).lean();
      return document;
    },

    async append(id, owner, message, { expiresAt, consentAt, at = new Date() }) {
      const document = await Conversation.findOneAndUpdate({
        _id: id,
        ...ownerFilter(owner),
        expiresAt: { $gt: at },
      }, {
        $push: { messagesRedacted: { $each: [message], $slice: -MAX_MESSAGES } },
        $set: { expiresAt, consentAt },
      }, { new: true, runValidators: true }).lean();
      return document;
    },

    async purgeExpired({ before = new Date(), limit = 500 } = {}) {
      const boundedLimit = Math.min(Math.max(Number(limit) || 1, 1), 5000);
      const expired = await Conversation.find({ expiresAt: { $lte: before } })
        .select({ _id: 1 }).limit(boundedLimit).lean();
      if (!expired.length) return 0;
      const result = await Conversation.deleteMany({ _id: { $in: expired.map(({ _id }) => _id) }, expiresAt: { $lte: before } });
      return result.deletedCount || 0;
    },
  });
}
