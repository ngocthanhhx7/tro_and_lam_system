import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestScope } from '../../fondend/src/services/requestScope.js';

test('late checkout results, errors and voucher resolution cannot overwrite a newer identity load', async () => {
  const scope = createRequestScope();
  const displayed = [];
  let completeOld;
  const old = scope.begin();
  const voucher = scope.capture();
  const pending = new Promise(resolve => { completeOld = resolve; }).then(value => { if (old()) displayed.push(value); });
  scope.invalidate();
  const current = scope.begin();
  if (current()) displayed.push('new account');
  completeOld('private old account');
  await pending;
  assert.deepEqual(displayed, ['new account']);
  assert.equal(voucher(), false);
  assert.equal(current(), true);
  scope.invalidate();
  assert.equal(current(), false, 'unmount invalidates pending updates');
});
