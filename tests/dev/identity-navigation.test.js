import test from 'node:test';
import assert from 'node:assert/strict';
import { loginDestination } from '../../fondend/src/services/identity/navigation.js';
import { safeAssistantHref } from '../../fondend/src/services/assistant/safeAssistantHref.js';

test('role-specific login destinations keep customers at home and staff in workspaces', () => {
  assert.equal(loginDestination('customer'), '/');
  assert.equal(loginDestination('staff'), '/staff');
  assert.equal(loginDestination('admin'), '/admin');
});
test('assistant source URLs never accept executable or cross-origin schemes', () => {
  for (const value of ['javascript:alert(1)', '//evil.test', '/\\evil.test', 'https://evil.test', '/\n/evil.test']) assert.equal(safeAssistantHref(value), null);
  assert.equal(safeAssistantHref('/san-pham/binh-ty-ba'), '/san-pham/binh-ty-ba');
});
