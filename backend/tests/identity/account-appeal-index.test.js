import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountAppeal } from '../../src/models/identity/account-appeal.model.js';

test('pending account appeals have one partial unique owner index', () => {
  const userIdIndexes = AccountAppeal.schema.indexes().filter(([keys]) => Object.hasOwn(keys, 'userId'));

  assert.deepEqual(userIdIndexes, [[
    { userId: 1 },
    { unique: true, partialFilterExpression: { status: 'pending' } },
  ]]);
});
