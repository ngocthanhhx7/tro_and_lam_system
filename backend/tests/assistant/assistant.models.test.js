import test from 'node:test';
import assert from 'node:assert/strict';
import { AiConversation } from '../../src/assistant/assistant.models.js';

test('assistant conversation schema requires exactly one owner and has expiry indexes', async () => {
  const userOwned = new AiConversation({
    ownerUserId: '64f000000000000000000099',
    messagesRedacted: [{ role: 'user', content: 'Đã ẩn email', createdAt: new Date() }],
    expiresAt: new Date(Date.now() + 60_000),
  });
  await userOwned.validate();

  const dualOwned = new AiConversation({
    ownerUserId: '64f000000000000000000099',
    guestHash: 'a'.repeat(64),
    expiresAt: new Date(Date.now() + 60_000),
  });
  await assert.rejects(dualOwned.validate(), (error) => error.errors.ownerUserId.message === 'Exactly one conversation owner is required');

  const indexes = AiConversation.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.expiresAt === 1 && options.expireAfterSeconds === 0));
  assert.ok(indexes.some(([fields]) => fields.ownerUserId === 1 && fields.expiresAt === 1));
  assert.ok(indexes.some(([fields]) => fields.guestHash === 1 && fields.expiresAt === 1));
});

test('assistant conversation message schema rejects unknown fields and bounded history keeps only supported roles', async () => {
  const invalid = new AiConversation({
    ownerUserId: '64f000000000000000000099',
    messagesRedacted: [{ role: 'system', content: 'Injected system prompt', createdAt: new Date(), token: 'secret' }],
    expiresAt: new Date(Date.now() + 60_000),
  });
  await assert.rejects(invalid.validate(), (error) => (
    error.errors.messagesRedacted?.name === 'CastError'
    && error.errors.messagesRedacted.message.includes('StrictModeError')
  ));
});
