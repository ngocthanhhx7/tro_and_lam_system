import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountService } from '../../src/services/account/account.service.js';

const USER_A = '111111111111111111111111';
const USER_B = '222222222222222222222222';
const PRODUCT_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const PRODUCT_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';

class MemoryAccountRepository {
  addresses = [];
  carts = [];
  nextId = 1;
  tail = Promise.resolve();

  async transaction(callback) {
    let release;
    const previous = this.tail;
    this.tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try { return await callback({ transaction: true }); }
    finally { release(); }
  }

  async listAddresses(userId) {
    return this.addresses.filter((item) => item.userId === String(userId)).sort((a, b) => a.createdAt - b.createdAt);
  }

  async countAddresses(userId) { return (await this.listAddresses(userId)).length; }

  async createAddress(data) {
    const now = new Date();
    const row = { id: String(this.nextId++).padStart(24, '0'), ...structuredClone(data), createdAt: now, updatedAt: now, version: 0 };
    this.addresses.push(row);
    return row;
  }

  async findAddressByOwner(userId, id) {
    return this.addresses.find((item) => item.userId === String(userId) && item.id === String(id)) || null;
  }

  async updateAddress(userId, id, expectedVersion, patch) {
    const row = await this.findAddressByOwner(userId, id);
    if (!row || row.version !== expectedVersion) return null;
    Object.assign(row, structuredClone(patch), { version: row.version + 1, updatedAt: new Date() });
    return row;
  }

  async clearDefaultAddresses(userId, exceptAddressId) {
    for (const row of this.addresses) {
      if (row.userId === String(userId) && row.id !== exceptAddressId && row.isDefault) {
        row.isDefault = false;
        row.version += 1;
      }
    }
  }

  async deleteAddress(userId, id, expectedVersion) {
    const index = this.addresses.findIndex((item) => item.userId === String(userId) && item.id === String(id) && item.version === expectedVersion);
    return index < 0 ? null : this.addresses.splice(index, 1)[0];
  }

  async findDefaultAddress(userId) {
    return this.addresses.find((item) => item.userId === String(userId) && item.isDefault) || null;
  }

  async findOldestAddress(userId) {
    return (await this.listAddresses(userId))[0] || null;
  }

  async promoteAddressDefault(userId, id) {
    await this.clearDefaultAddresses(userId, id);
    const row = await this.findAddressByOwner(userId, id);
    if (row) { row.isDefault = true; row.version += 1; }
    return row;
  }

  async getOwnedAddress(userId, addressId) { return this.findAddressByOwner(userId, addressId); }

  async findUserCart(userId) { return this.carts.find((item) => item.userId === String(userId)) || null; }
  async findGuestCart(tokenHash) { return this.carts.find((item) => item.guestTokenHash === tokenHash) || null; }

  async createCart(data) {
    const now = new Date();
    const cart = { id: String(this.nextId++).padStart(24, '0'), items: [], version: 0, createdAt: now, updatedAt: now, ...structuredClone(data) };
    this.carts.push(cart);
    return cart;
  }

  async saveCart(cart, expectedVersion) {
    const current = this.carts.find((item) => item.id === cart.id);
    if (!current || current.version !== expectedVersion) return null;
    Object.assign(current, structuredClone(cart), { version: expectedVersion + 1, updatedAt: new Date() });
    return current;
  }
}

const addressInput = (label = 'Nhà riêng') => ({
  label,
  recipientName: 'Nguyễn An',
  phone: '0900000000',
  line1: 'Số 12, phố Gốm',
  province: 'Hà Nội',
  countryCode: 'VN',
  formattedAddress: 'Số 12, phố Gốm, Hà Nội',
});

function makeService({ repository = new MemoryAccountRepository(), products, geocoder } = {}) {
  const catalog = {
    async getCheckoutProducts(ids) {
      const allowed = products || [
        { productId: PRODUCT_A, sku: 'TL-A', name: 'Bình men lam', line: 'lifestyle', saleMode: 'buy', priceVnd: 100000, imageUrl: '/assets/binh.jpg' },
        { productId: PRODUCT_B, sku: 'TL-B', name: 'Hũ trà', line: 'lifestyle', saleMode: 'buy', priceVnd: 250000 },
      ];
      return allowed.filter((item) => ids.includes(item.productId));
    },
  };
  return { repository, service: createAccountService({ ports: { accountRepository: repository, catalogService: catalog, geocoder } }) };
}

test('address ownership is scoped to the authenticated user', async () => {
  const { service } = makeService();
  const ownerAddress = await service.createAddress({ id: USER_A }, addressInput());
  await assert.rejects(service.updateAddress({ id: USER_B }, ownerAddress.id, { expectedVersion: 0, label: 'Sửa địa chỉ' }), { status: 404, code: 'NOT_FOUND' });
  await assert.rejects(service.getOwnedAddress(USER_B, ownerAddress.id), { status: 404, code: 'NOT_FOUND' });
});

test('first address becomes default and deleting a default promotes the oldest remaining address', async () => {
  const { service } = makeService();
  const first = await service.createAddress({ id: USER_A }, addressInput());
  const second = await service.createAddress({ id: USER_A }, addressInput('Văn phòng'));
  assert.equal(first.isDefault, true);
  assert.equal(second.isDefault, false);
  await service.deleteAddress({ id: USER_A }, first.id, 0);
  const remaining = await service.listAddresses({ id: USER_A });
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, second.id);
  assert.equal(remaining[0].isDefault, true);
});

test('manual address saves without ward, province, dataset lookup or stored coordinates', async () => {
  const { service } = makeService();
  const address = await service.createAddress({ id: USER_A }, {
    recipientName: 'Nguyễn An', phone: '0900000000', line1: 'Số 12, phố Gốm',
    countryCode: 'VN', formattedAddress: 'Số 12, phố Gốm, địa chỉ nhập thủ công',
  });
  assert.equal(address.isDefault, true);
  assert.equal(address.location, undefined);
  assert.equal(address.ward, undefined);
  assert.equal(address.province, undefined);
});

test('concurrent default selection serializes to one default address', async () => {
  const { service } = makeService();
  const first = await service.createAddress({ id: USER_A }, addressInput());
  const second = await service.createAddress({ id: USER_A }, addressInput('Văn phòng'));
  const results = await Promise.allSettled([
    service.setDefaultAddress({ id: USER_A }, first.id, 0),
    service.setDefaultAddress({ id: USER_A }, second.id, 0),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 2);
  const addresses = await service.listAddresses({ id: USER_A });
  assert.equal(addresses.filter((item) => item.isDefault).length, 1);
});

test('guest carts use distinct ownership keys and do not expose another guest cart', async () => {
  const { service } = makeService();
  const guestA = { kind: 'guest', guestTokenHash: 'a'.repeat(64) };
  const guestB = { kind: 'guest', guestTokenHash: 'b'.repeat(64) };
  await service.setCartItemQuantity(guestA, PRODUCT_A, 2, 0);
  await service.setCartItemQuantity(guestB, PRODUCT_B, 1, 0);
  const cartA = await service.getCart(guestA);
  const cartB = await service.getCart(guestB);
  assert.deepEqual(cartA.items.map((item) => [item.productId, item.quantity]), [[PRODUCT_A, 2]]);
  assert.deepEqual(cartB.items.map((item) => [item.productId, item.quantity]), [[PRODUCT_B, 1]]);
});

test('repeating login merge cannot double quantities and keeps a consumed guest token tombstone', async () => {
  const { repository, service } = makeService();
  const guest = { kind: 'guest', guestTokenHash: 'c'.repeat(64) };
  const account = { id: USER_A, role: 'customer' };
  await service.setCartItemQuantity(guest, PRODUCT_A, 3, 0);
  await service.setCartItemQuantity(account, PRODUCT_A, 2, 0);
  const merged = await service.mergeGuestCart(account, guest.guestTokenHash, 1);
  const retry = await service.mergeGuestCart(account, guest.guestTokenHash, 1);
  assert.equal(merged.items[0].quantity, 5);
  assert.equal(retry.items[0].quantity, 5);
  assert.equal(await service.guestCartWasMerged(guest.guestTokenHash), true);
  assert.deepEqual((await repository.findGuestCart(guest.guestTokenHash)).items, []);
});

test('merge clamps combined quantity to 99 and returns a visible adjustment', async () => {
  const { service } = makeService();
  const guest = { kind: 'guest', guestTokenHash: 'd'.repeat(64) };
  const account = { id: USER_A, role: 'customer' };
  await service.setCartItemQuantity(guest, PRODUCT_A, 80, 0);
  await service.setCartItemQuantity(account, PRODUCT_A, 30, 0);
  const merged = await service.mergeGuestCart(account, guest.guestTokenHash, 1);
  assert.equal(merged.items[0].quantity, 99);
  assert.deepEqual(merged.adjustments, [{ productId: PRODUCT_A, code: 'QUANTITY_CLAMPED', requestedQuantity: 110, retainedQuantity: 99 }]);
});

test('unpublished or quote-only catalog items remain removable but cannot be newly added', async () => {
  const { service } = makeService({ products: [] });
  await assert.rejects(service.setCartItemQuantity({ kind: 'guest', guestTokenHash: 'e'.repeat(64) }, PRODUCT_A, 1, 0), { status: 422, code: 'CHECKOUT_NOT_ALLOWED' });
});

test('a catalog item removed from the checkout port remains visible for removal', async () => {
  const repository = new MemoryAccountRepository();
  const guest = { kind: 'guest', guestTokenHash: 'f'.repeat(64) };
  await repository.createCart({ guestTokenHash: guest.guestTokenHash, items: [{ productId: PRODUCT_A, quantity: 1 }], version: 0, expiresAt: new Date(Date.now() + 60000) });
  const { service } = makeService({ repository, products: [] });
  const cart = await service.getCart(guest);
  assert.equal(cart.items[0].product, null);
  assert.equal(cart.items[0].checkoutEligible, false);
  assert.deepEqual(cart.warnings, [{ productId: PRODUCT_A, code: 'PRODUCT_UNAVAILABLE' }]);
  const emptied = await service.removeCartItem(guest, PRODUCT_A, 0);
  assert.equal(emptied.items.length, 0);
});

test('reverse geocoding reports unavailable until a real provider adapter is configured', async () => {
  const { service } = makeService();
  await assert.rejects(service.reverseGeocode({ lat: 21, lng: 105 }), { status: 503, code: 'GEO_UNAVAILABLE' });
  const configured = makeService({ geocoder: { configured: true, async reverse() { return { suggestedAddress: { line1: 'Số 1', formattedAddress: 'Số 1, Hà Nội' }, provider: 'configured-adapter' }; } } }).service;
  assert.deepEqual(await configured.reverseGeocode({ lat: 21, lng: 105 }), {
    suggestedAddress: { line1: 'Số 1', formattedAddress: 'Số 1, Hà Nội' }, provider: 'configured-adapter', accuracy: 'approximate',
  });
});
