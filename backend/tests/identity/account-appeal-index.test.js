import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountAppeal } from '../../src/models/identity/account-appeal.model.js';

test('pending appeal guard has a distinct name from the legacy userId_1 lookup index', () => {
  const userIdIndexes = AccountAppeal.schema.indexes().filter(([keys]) => Object.hasOwn(keys, 'userId'));

  assert.deepEqual(userIdIndexes, [[
    { userId: 1 },
    { unique: true, partialFilterExpression: { status: 'pending' }, name: 'account_appeals_one_pending_per_user' },
  ]]);
});
