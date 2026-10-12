import test from 'node:test';
import assert from 'node:assert/strict';
import { createSingleFlightRead } from '../../fondend/src/services/singleFlightRead.js';
test('simultaneous cart reads share work but subsequent reads get fresh data', async () => {
  let count = 0;
  const reader = createSingleFlightRead(async () => ++count);
  assert.deepEqual(await Promise.all([reader.get(), reader.get()]), [1, 1]);
  assert.equal(await reader.get(), 2);
});
test('invalidation isolates new identity reads and late old responses cannot clear new work', async () => {
  const resolvers = [];
  const reader = createSingleFlightRead(() => new Promise(resolve => resolvers.push(resolve)));
  const old = reader.get(); await Promise.resolve();
  reader.invalidate();
  const current = reader.get(); await Promise.resolve();
  resolvers[0]('old actor'); await old;
  assert.equal(reader.get(), current);
  resolvers[1]('new actor');
  assert.equal(await current, 'new actor');
});
test('failed cart reads are not cached', async () => {
  let count = 0;
  const reader = createSingleFlightRead(async () => { if (++count === 1) throw new Error('temporary'); return 'fresh'; });
  await assert.rejects(reader.get(), /temporary/);
  assert.equal(await reader.get(), 'fresh');
});
