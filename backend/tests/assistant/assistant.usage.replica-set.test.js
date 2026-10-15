import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { AiDailyUsage } from '../../src/assistant/assistant.models.js';
import { assistantDay, createAssistantDailyUsage } from '../../src/assistant/assistant.usage.js';

test('assistant day resets at midnight Vietnam time', () => {
  assert.equal(assistantDay(new Date('2026-10-15T16:59:59Z')).day, '2026-10-15');
  assert.equal(assistantDay(new Date('2026-10-15T17:00:00Z')).day, '2026-10-16');
  assert.equal(assistantDay(new Date('2026-10-15T16:59:59Z')).resetsAt.toISOString(), '2026-10-15T17:00:00.000Z');
});

const uri = process.env.QUERY_TEST_REPLICA_SET_URI;
test('device quota is atomic, durable across service restart and resets without waiting for TTL', { skip: !uri }, async () => {
  const target = new URL(uri);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
  assert.equal(target.username + target.password + target.search + target.hash, '');
  await mongoose.connect(uri, { dbName: `tro_lam_assistant_test_${randomBytes(12).toString('hex')}` });
  try {
    await AiDailyUsage.createIndexes();
    const quota = createAssistantDailyUsage();
    const device = 'c'.repeat(64);
    const at = new Date('2026-10-15T16:59:59Z');
    const attempts = await Promise.allSettled(Array.from({ length: 30 }, () => quota.consume(device, at)));
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 10);
    assert.ok(attempts.filter(result => result.status === 'rejected').every(result => result.reason.code === 'AI_DAILY_LIMIT'));
    const restarted = createAssistantDailyUsage();
    assert.equal((await restarted.get(device, at)).remaining, 0);
    assert.equal((await AiDailyUsage.findOne().lean()).used, 10);
    assert.equal(await AiDailyUsage.countDocuments(), 1);
    assert.equal((await restarted.consume(device, new Date('2026-10-15T17:00:00Z'))).remaining, 9);
    assert.equal((await restarted.consume('d'.repeat(64), at)).remaining, 9);
    await assert.rejects(restarted.consume('client-picked-id', at), error => error.status === 401);
  } finally { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
});
