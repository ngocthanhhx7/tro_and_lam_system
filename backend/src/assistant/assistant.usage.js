import { createHash } from 'node:crypto';
import { ServiceError } from '../utils/serviceError.js';
import { AiDailyUsage } from './assistant.models.js';

export const DEVICE_DAILY_LIMIT = 10;
export function assistantDay(at = new Date()) {
  const day = new Date(at.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  return { day, resetsAt: new Date(Date.parse(`${day}T00:00:00+07:00`) + 86400_000) };
}
function identity(deviceHash, at) {
  if (!/^[a-f\d]{64}$/u.test(deviceHash || '')) throw new ServiceError(401, 'AUTH_REQUIRED', 'Thiếu phiên thiết bị');
  const { day, resetsAt } = assistantDay(at);
  return { key: createHash('sha256').update(`${deviceHash}:${day}`).digest('hex'), day, resetsAt };
}
function snapshot(used, resetsAt) {
  return { limit: DEVICE_DAILY_LIMIT, used, remaining: Math.max(0, DEVICE_DAILY_LIMIT - used), resetsAt: resetsAt.toISOString() };
}
export function createAssistantDailyUsage({ Model = AiDailyUsage } = {}) {
  return {
    async get(deviceHash, at = new Date()) {
      const { key, resetsAt } = identity(deviceHash, at);
      const row = await Model.findById(key).select('used').lean();
      return snapshot(row?.used || 0, resetsAt);
    },
    async consume(deviceHash, at = new Date()) {
      const { key, resetsAt } = identity(deviceHash, at);
      const filter = { _id: key, used: { $lt: DEVICE_DAILY_LIMIT } };
      let row;
      try {
        row = await Model.findOneAndUpdate(filter, {
          $inc: { used: 1 }, $setOnInsert: { expiresAt: new Date(resetsAt.getTime() + 2 * 86400_000) },
        }, { upsert: true, returnDocument: 'after', runValidators: true }).lean();
      } catch (error) {
        if (error.code !== 11000) throw error;
        // A concurrent first insert may also race; retry without upsert.
        row = await Model.findOneAndUpdate(filter, { $inc: { used: 1 } }, { returnDocument: 'after' }).lean();
      }
      if (!row) throw new ServiceError(429, 'AI_DAILY_LIMIT', 'Thiết bị này đã dùng hết 10 câu hỏi hôm nay. Mình hẹn bạn vào ngày mai nhé!');
      return snapshot(row.used, resetsAt);
    },
  };
}

export function createMemoryAssistantDailyUsage() {
  const counts = new Map();
  return {
    async get(deviceHash, at = new Date()) {
      const { key, resetsAt } = identity(deviceHash, at);
      return snapshot(counts.get(key) || 0, resetsAt);
    },
    async consume(deviceHash, at = new Date()) {
      const { key, resetsAt } = identity(deviceHash, at);
      const used = counts.get(key) || 0;
      if (used >= DEVICE_DAILY_LIMIT) throw new ServiceError(429, 'AI_DAILY_LIMIT', 'Đã hết lượt hôm nay');
      counts.set(key, used + 1);
      return snapshot(used + 1, resetsAt);
    },
  };
}
