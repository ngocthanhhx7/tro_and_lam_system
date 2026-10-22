import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { Cart } from '../../src/models/account/cart.model.js';
import { createAccountService } from '../../src/services/account/account.service.js';

const uri = process.env.QUERY_TEST_REPLICA_SET_URI;
test('cart deletion remains atomic against writes, merge and transaction rollback', { skip: !uri }, async () => {
  const target = new URL(uri);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
  assert.equal(target.username + target.password + target.search + target.hash, '');
  await mongoose.connect(uri, { dbName: `tro_lam_delete_${randomBytes(12).toString('hex')}` });
  try {
    await Cart.createIndexes();
    const ids = [0, 1].map(() => String(new mongoose.Types.ObjectId()));
    const products = ids.map(productId => ({ productId, name: 'Local fixture', priceVnd: 100000, saleMode: 'buy' }));
    const service = createAccountService({ ports: { catalogService: { async getCheckoutProducts(requested) { return products.filter(p => requested.includes(p.productId)); } } } });
    const guest = { kind: 'guest', guestTokenHash: randomBytes(32).toString('hex') };
    await service.setCartItemQuantity(guest, ids[0], 1, 0);
    await service.setCartItemQuantity(guest, ids[1], 2, 1);
    const snapshot = await service.getGuestCartSnapshot(guest.guestTokenHash);
    const race = await Promise.allSettled([
      service.removeCartItem(guest, ids[0], 2, { guestCartSnapshot: snapshot }),
      service.setCartItemQuantity(guest, ids[1], 3, 2, { guestCartSnapshot: snapshot }),
    ]);
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(race.filter(r => r.status === 'rejected' && r.reason.code === 'VERSION_CONFLICT').length, 1);
    const winner = race.find(r => r.status === 'fulfilled').value;
    assert.equal((await service.getCart(guest)).version, winner.version);
    const owner = { id: String(new mongoose.Types.ObjectId()), role: 'customer' };
    const beforeMerge = await service.getGuestCartSnapshot(guest.guestTokenHash);
    await service.mergeGuestCart(owner, guest.guestTokenHash, 0);
    await assert.rejects(service.removeCartItem(guest, ids[1], beforeMerge.version, { guestCartSnapshot: beforeMerge }), { code: 'VERSION_CONFLICT' });
    const accountCart = await service.getCart(owner);
    await assert.rejects(mongoose.connection.transaction(async session => {
      await service.removeCartItem(owner, ids[1], accountCart.version, { session });
      throw new Error('local rollback');
    }), /local rollback/);
    assert.deepEqual(await service.getCart(owner), accountCart);
    const stranger = { id: String(new mongoose.Types.ObjectId()) };
    assert.equal((await service.removeCartItem(stranger, ids[1], 0)).items.length, 0);
    assert.deepEqual(await service.getCart(owner), accountCart);
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
