import test from 'node:test';
import assert from 'node:assert/strict';
import { Address } from '../../src/models/account/address.model.js';
import { Cart } from '../../src/models/account/cart.model.js';
import {
  validateAddressWrite,
  validateCartItemWrite,
  validateReverseLocation,
} from '../../src/validators/account/account.validator.js';

const USER_ID = '111111111111111111111111';
const PRODUCT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

test('address model allows a manually entered Vietnamese address without optional location fields', async () => {
  const address = new Address({
    userId: USER_ID,
    recipientName: 'Nguyễn An',
    phone: '0900000000',
    line1: 'Số 12, phố Gốm',
    countryCode: 'VN',
    formattedAddress: 'Số 12, phố Gốm, Hà Nội',
  });
  await assert.doesNotReject(address.validate());
  assert.equal(address.location, undefined);
  assert.equal(address.ward, undefined);
  assert.equal(address.province, undefined);
});

test('cart schema requires exactly one authenticated or guest owner and declares unique and TTL indexes', async () => {
  const validGuest = new Cart({ guestTokenHash: 'a'.repeat(64), items: [{ productId: PRODUCT_ID, quantity: 2 }], expiresAt: new Date(Date.now() + 60000) });
  await assert.doesNotReject(validGuest.validate());
  const noOwner = new Cart({ items: [], expiresAt: new Date(Date.now() + 60000) });
  await assert.rejects(noOwner.validate(), /exactly one owner/);
  const bothOwners = new Cart({ userId: USER_ID, guestTokenHash: 'b'.repeat(64), items: [], expiresAt: new Date(Date.now() + 60000) });
  await assert.rejects(bothOwners.validate(), /exactly one owner/);
  const indexes = Cart.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.userId === 1 && options.unique === true));
  assert.ok(indexes.some(([keys, options]) => keys.guestTokenHash === 1 && options.unique === true));
  assert.ok(indexes.some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0));
});

test('validators enforce DTO field allowlists and coordinate ranges', () => {
  assert.throws(() => validateAddressWrite({ recipientName: 'An', phone: '0900000000', line1: 'Số 1', countryCode: 'VN', formattedAddress: 'Số 1', userId: USER_ID }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateCartItemWrite({ quantity: 100, expectedVersion: 0 }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validateReverseLocation({ lat: 91, lng: 105 }), { code: 'VALIDATION_ERROR' });
  assert.deepEqual(validateReverseLocation({ lat: 21, lng: 105 }), { lat: 21, lng: 105 });
});
