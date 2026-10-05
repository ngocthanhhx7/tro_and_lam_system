import { createHash } from 'node:crypto';
import { badRequest, conflict, notFound, unavailable, ServiceError } from '../../utils/serviceError.js';
import { AccountRepository } from './account.repository.js';
import { validateAddressId, validateAddressWrite, validateExpectedVersion } from '../../validators/account/account.validator.js';

const CART_MAX = 99;
const ADDRESS_LIMIT = 20;
const DEFAULT_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const asId = (value) => String(value?._id ?? value?.id ?? value);
const isObjectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);

function actorUserId(actor) {
  const value = actor?.id ?? actor?._id;
  if (!value || actor?.status === 'blocked') throw new ServiceError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập lại để tiếp tục');
  return asId(value);
}

function cartOwner(actor) {
  if (actor?.kind === 'guest') {
    if (typeof actor.guestTokenHash !== 'string' || !/^[a-f\d]{64}$/i.test(actor.guestTokenHash)) throw new ServiceError(401, 'AUTH_REQUIRED', 'Giỏ hàng khách không hợp lệ');
    return { kind: 'guest', key: actor.guestTokenHash };
  }
  return { kind: 'user', key: actorUserId(actor) };
}

function addressIdOf(value) { return validateAddressId(typeof value === 'string' ? value : asId(value)); }

function assertVersion(record, expectedVersion) {
  if (!record) throw notFound();
  if (record.version !== expectedVersion) throw conflict('VERSION_CONFLICT');
}

function duplicateDefault(error) {
  return error?.code === 11000 && (error?.keyPattern?.isDefault || error?.message?.includes('one_default_address_per_user'));
}

function toCartRecord(record) {
  if (!record) return null;
  return {
    ...record,
    items: (record.items || []).map((item) => ({ productId: asId(item.productId), quantity: item.quantity })),
  };
}

function productLookup(products) {
  return new Map((Array.isArray(products) ? products : []).map((item) => [asId(item.productId ?? item.id), item]));
}

function toCartDto(cart, products, adjustments = []) {
  const byId = productLookup(products);
  let subtotalVnd = 0;
  const warnings = [];
  const items = cart.items.map(({ productId, quantity }) => {
    const product = byId.get(productId);
    if (!product) {
      warnings.push({ productId, code: 'PRODUCT_UNAVAILABLE' });
      return { productId, quantity, product: null, lineTotalVnd: null, checkoutEligible: false };
    }
    const lineTotalVnd = product.priceVnd * quantity;
    if (!Number.isSafeInteger(lineTotalVnd) || !Number.isSafeInteger(subtotalVnd + lineTotalVnd)) {
      throw new ServiceError(422, 'CHECKOUT_NOT_ALLOWED', 'Tổng giá trị giỏ hàng vượt giới hạn xử lý');
    }
    subtotalVnd += lineTotalVnd;
    return {
      productId,
      quantity,
      product: {
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        line: product.line,
        saleMode: product.saleMode,
        priceVnd: product.priceVnd,
        ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
      },
      lineTotalVnd,
      checkoutEligible: true,
    };
  });
  return { version: cart.version, items, subtotalVnd, warnings, adjustments };
}

function expiredAt(ttlMs) { return new Date(Date.now() + ttlMs); }

export function hashGuestCartToken(token) {
  if (typeof token !== 'string' || token.length < 32) throw badRequest('BAD_REQUEST', 'Giỏ hàng khách không hợp lệ');
  return createHash('sha256').update(token).digest('hex');
}

export function createAccountService({ ports = {}, config = {} } = {}) {
  const repository = ports.accountRepository || new AccountRepository(ports.models);
  const catalog = ports.catalogService || ports.catalog;
  const geocoder = ports.geocoder;
  const now = typeof ports.now === 'function' ? ports.now : () => new Date();
  const cartTtlMs = Number.isSafeInteger(config.cartTtlMs) && config.cartTtlMs > 0 ? config.cartTtlMs : DEFAULT_CART_TTL_MS;

  if (!catalog || typeof catalog.getCheckoutProducts !== 'function') {
    throw new TypeError('P03 cần P04 catalogService.getCheckoutProducts');
  }

  async function loadProducts(ids, { session } = {}) {
    if (ids.length === 0) return [];
    return catalog.getCheckoutProducts(ids, { session });
  }

  async function getOrCreateCart(owner, { session } = {}) {
    const existing = owner.kind === 'user'
      ? await repository.findUserCart(owner.key, { session })
      : await repository.findGuestCart(owner.key, { session });
    if (existing) return toCartRecord(existing);
    try {
      return toCartRecord(await repository.createCart({
        ...(owner.kind === 'user' ? { userId: owner.key } : { guestTokenHash: owner.key }),
        items: [], version: 0, expiresAt: expiredAt(cartTtlMs),
      }, { session }));
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const retried = owner.kind === 'user'
        ? await repository.findUserCart(owner.key, { session })
        : await repository.findGuestCart(owner.key, { session });
      if (retried) return toCartRecord(retried);
      throw error;
    }
  }

  async function cartWithPrices(cart, { session, adjustments = [] } = {}) {
    const products = await loadProducts(cart.items.map((item) => item.productId), { session });
    return toCartDto(cart, products, adjustments);
  }

  async function withDefaultRaceRetry(callback) {
    try { return await repository.transaction(callback); }
    catch (error) {
      if (!duplicateDefault(error)) throw error;
      return repository.transaction(callback);
    }
  }

  async function listAddresses(actor, { session } = {}) {
    return repository.listAddresses(actorUserId(actor), { session });
  }

  async function createAddress(actor, input, { session } = {}) {
    const userId = actorUserId(actor);
    const body = validateAddressWrite(input);
    const create = async (transactionSession) => {
      const count = await repository.countAddresses(userId, { session: transactionSession });
      if (count >= ADDRESS_LIMIT) throw badRequest('BAD_REQUEST', 'Bạn đã lưu tối đa 20 địa chỉ');
      const isDefault = body.isDefault === true || count === 0;
      if (isDefault) await repository.clearDefaultAddresses(userId, undefined, { session: transactionSession });
      const fields = { ...body };
      delete fields.isDefault;
      return repository.createAddress({ ...fields, userId, isDefault }, { session: transactionSession });
    };
    try { return await repository.transaction(create, { session }); }
    catch (error) {
      if (!duplicateDefault(error) || session) throw error;
      return repository.transaction(create);
    }
  }

  async function updateAddress(actor, addressIdValue, input) {
    const userId = actorUserId(actor);
    const addressId = addressIdOf(addressIdValue);
    const body = validateAddressWrite(input, { partial: true });
    return withDefaultRaceRetry(async (transactionSession) => {
      const current = await repository.findAddressByOwner(userId, addressId, { session: transactionSession });
      assertVersion(current, body.expectedVersion);
      const { expectedVersion, isDefault, ...patch } = body;
      if (isDefault === true) await repository.clearDefaultAddresses(userId, addressId, { session: transactionSession });
      const updated = await repository.updateAddress(userId, addressId, expectedVersion, {
        ...patch,
        ...(isDefault === undefined ? {} : { isDefault }),
      }, { session: transactionSession });
      if (!updated) throw conflict('VERSION_CONFLICT');
      return updated;
    });
  }

  async function setDefaultAddress(actor, addressIdValue, expectedVersionValue) {
    const userId = actorUserId(actor);
    const addressId = addressIdOf(addressIdValue);
    const expectedVersion = validateExpectedVersion(expectedVersionValue);
    return withDefaultRaceRetry(async (transactionSession) => {
      const current = await repository.findAddressByOwner(userId, addressId, { session: transactionSession });
      assertVersion(current, expectedVersion);
      await repository.clearDefaultAddresses(userId, addressId, { session: transactionSession });
      const updated = await repository.updateAddress(userId, addressId, expectedVersion, { isDefault: true }, { session: transactionSession });
      if (!updated) throw conflict('VERSION_CONFLICT');
      return updated;
    });
  }

  async function deleteAddress(actor, addressIdValue, expectedVersionValue, { session } = {}) {
    const userId = actorUserId(actor);
    const addressId = addressIdOf(addressIdValue);
    const expectedVersion = validateExpectedVersion(expectedVersionValue);
    return repository.transaction(async (transactionSession) => {
      const current = await repository.findAddressByOwner(userId, addressId, { session: transactionSession });
      assertVersion(current, expectedVersion);
      const deleted = await repository.deleteAddress(userId, addressId, expectedVersion, { session: transactionSession });
      if (!deleted) throw conflict('VERSION_CONFLICT');
      if (current.isDefault) {
        const existingDefault = await repository.findDefaultAddress(userId, { session: transactionSession });
        if (!existingDefault) {
          const fallback = await repository.findOldestAddress(userId, { excludeAddressId: addressId, session: transactionSession });
          if (fallback) await repository.promoteAddressDefault(userId, fallback.id, { session: transactionSession });
        }
      }
      return null;
    }, { session });
  }

  async function getOwnedAddress(userId, addressIdValue, { session } = {}) {
    const addressId = addressIdOf(addressIdValue);
    const address = await repository.getOwnedAddress(asId(userId), addressId, { session });
    if (!address) throw notFound();
    return address;
  }

  async function getCart(actor, { session } = {}) {
    const owner = cartOwner(actor);
    const cart = session
      ? toCartRecord(owner.kind === 'user'
        ? await repository.findUserCart(owner.key, { session })
        : await repository.findGuestCart(owner.key, { session }))
      : await getOrCreateCart(owner);
    const current = cart || { version: 0, items: [] };
    return cartWithPrices(current, { session });
  }

  async function setCartItemQuantity(actor, productId, quantityValue, expectedVersionValue, { session } = {}) {
    const owner = cartOwner(actor);
    if (!isObjectId(productId)) throw badRequest('VALIDATION_ERROR', 'Mã sản phẩm không hợp lệ');
    const quantity = Number(quantityValue);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > CART_MAX) throw badRequest('VALIDATION_ERROR', 'Số lượng phải từ 1 đến 99');
    const expectedVersion = validateExpectedVersion(expectedVersionValue);
    const allowed = await loadProducts([productId], { session });
    if (!productLookup(allowed).has(productId)) {
      throw new ServiceError(422, 'CHECKOUT_NOT_ALLOWED', 'Sản phẩm hiện không thể thêm vào giỏ hàng');
    }
    await getOrCreateCart(owner);
    const updated = await repository.transaction(async (transactionSession) => {
      const current = owner.kind === 'user'
        ? await repository.findUserCart(owner.key, { session: transactionSession })
        : await repository.findGuestCart(owner.key, { session: transactionSession });
      const cart = toCartRecord(current);
      if (!cart) throw conflict('VERSION_CONFLICT');
      assertVersion(cart, expectedVersion);
      const index = cart.items.findIndex((item) => item.productId === productId);
      if (index >= 0 && cart.items[index].quantity === quantity) return cart;
      if (index >= 0) cart.items[index] = { productId, quantity };
      else cart.items.push({ productId, quantity });
      cart.expiresAt = expiredAt(cartTtlMs);
      const saved = await repository.saveCart(cart, expectedVersion, { session: transactionSession });
      if (!saved) throw conflict('VERSION_CONFLICT');
      return toCartRecord(saved);
    }, { session });
    return cartWithPrices(updated, { session });
  }

  async function removeCartItem(actor, productId, expectedVersionValue, { session } = {}) {
    const owner = cartOwner(actor);
    if (!isObjectId(productId)) throw badRequest('VALIDATION_ERROR', 'Mã sản phẩm không hợp lệ');
    const expectedVersion = validateExpectedVersion(expectedVersionValue);
    await getOrCreateCart(owner);
    const updated = await repository.transaction(async (transactionSession) => {
      const current = owner.kind === 'user'
        ? await repository.findUserCart(owner.key, { session: transactionSession })
        : await repository.findGuestCart(owner.key, { session: transactionSession });
      const cart = toCartRecord(current);
      if (!cart) throw conflict('VERSION_CONFLICT');
      assertVersion(cart, expectedVersion);
      const items = cart.items.filter((item) => item.productId !== productId);
      if (items.length === cart.items.length) return cart;
      cart.items = items;
      cart.expiresAt = expiredAt(cartTtlMs);
      const saved = await repository.saveCart(cart, expectedVersion, { session: transactionSession });
      if (!saved) throw conflict('VERSION_CONFLICT');
      return toCartRecord(saved);
    }, { session });
    return cartWithPrices(updated, { session });
  }

  async function guestCartWasMerged(tokenHash, { session } = {}) {
    const guest = await repository.findGuestCart(tokenHash, { session });
    return Boolean(guest?.mergedAt);
  }

  async function mergeGuestCart(actor, guestTokenHash, expectedVersionValue, { session } = {}) {
    const owner = cartOwner(actor);
    if (owner.kind !== 'user') throw new ServiceError(401, 'AUTH_REQUIRED', 'Đăng nhập để gộp giỏ hàng');
    if (typeof guestTokenHash !== 'string' || !/^[a-f\d]{64}$/i.test(guestTokenHash)) throw badRequest('BAD_REQUEST', 'Không tìm thấy giỏ hàng khách');
    const expectedVersion = validateExpectedVersion(expectedVersionValue);
    await getOrCreateCart(owner);
    const result = await repository.transaction(async (transactionSession) => {
      let accountCart = await repository.findUserCart(owner.key, { session: transactionSession });
      const guestCart = await repository.findGuestCart(guestTokenHash, { session: transactionSession });
      accountCart = toCartRecord(accountCart);
      if (!accountCart) throw conflict('VERSION_CONFLICT');

      // Retries after a successful merge are a no-op even though the account version advanced.
      if (!guestCart || guestCart.mergedAt) return { cart: accountCart, adjustments: [] };
      assertVersion(accountCart, expectedVersion);
      const guest = toCartRecord(guestCart);
      const quantities = new Map(accountCart.items.map((item) => [item.productId, item.quantity]));
      const adjustments = [];
      for (const item of guest.items) {
        const requestedQuantity = (quantities.get(item.productId) || 0) + item.quantity;
        const retainedQuantity = Math.min(CART_MAX, requestedQuantity);
        if (requestedQuantity > retainedQuantity) adjustments.push({
          productId: item.productId, code: 'QUANTITY_CLAMPED', requestedQuantity, retainedQuantity,
        });
        quantities.set(item.productId, retainedQuantity);
      }
      const nextItems = [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
      const savedAccount = await repository.saveCart({ ...accountCart, items: nextItems, expiresAt: expiredAt(cartTtlMs) }, accountCart.version, { session: transactionSession });
      if (!savedAccount) throw conflict('VERSION_CONFLICT');
      const consumedGuest = await repository.saveCart({ ...guest, items: [], mergedAt: now(), expiresAt: expiredAt(cartTtlMs) }, guest.version, { session: transactionSession });
      if (!consumedGuest) throw conflict('VERSION_CONFLICT');
      return { cart: toCartRecord(savedAccount), adjustments };
    }, { session });
    const dto = await cartWithPrices(result.cart, { session, adjustments: result.adjustments });
    return dto;
  }

  async function removeCommittedItems(actor, committedItems, { session } = {}) {
    const owner = cartOwner(actor);
    if (!Array.isArray(committedItems)) throw badRequest('BAD_REQUEST', 'Danh sách sản phẩm đã đặt không hợp lệ');
    const productIds = new Set(committedItems.map((item) => typeof item === 'string' ? item : item.productId).filter(isObjectId));
    if (productIds.size === 0) return;
    const cart = owner.kind === 'user'
      ? await repository.findUserCart(owner.key, { session })
      : await repository.findGuestCart(owner.key, { session });
    if (!cart) return;
    const record = toCartRecord(cart);
    const remaining = record.items.filter((item) => !productIds.has(item.productId));
    if (remaining.length === record.items.length) return;
    const saved = await repository.saveCart({ ...record, items: remaining, expiresAt: expiredAt(cartTtlMs) }, record.version, { session });
    if (!saved) throw conflict('VERSION_CONFLICT');
  }

  async function reverseGeocode(input) {
    if (!geocoder || geocoder.configured !== true || typeof geocoder.reverse !== 'function') {
      throw unavailable('GEO_UNAVAILABLE', 'Gợi ý địa chỉ đang tạm ngừng. Bạn vẫn có thể nhập địa chỉ thủ công.');
    }
    try {
      const result = await geocoder.reverse({ lat: input.lat, lng: input.lng, timeoutMs: config.geocodingTimeoutMs });
      if (!result || typeof result.provider !== 'string' || !result.suggestedAddress
        || typeof result.suggestedAddress.line1 !== 'string'
        || typeof result.suggestedAddress.formattedAddress !== 'string') {
        throw new Error('Geocoder response shape is invalid');
      }
      const suggestedAddress = Object.fromEntries(
        ['line1', 'line2', 'ward', 'province', 'postalCode', 'formattedAddress']
          .filter((field) => typeof result.suggestedAddress[field] === 'string')
          .map((field) => [field, result.suggestedAddress[field].slice(0, field === 'formattedAddress' ? 500 : 200)]),
      );
      return { suggestedAddress, provider: result.provider.slice(0, 80), accuracy: 'approximate' };
    } catch {
      throw unavailable('GEO_UNAVAILABLE', 'Không lấy được gợi ý địa chỉ. Bạn vẫn có thể nhập địa chỉ thủ công.');
    }
  }

  return Object.freeze({
    repository,
    listAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getOwnedAddress,
    getCart,
    setCartItemQuantity,
    removeCartItem,
    mergeGuestCart,
    removeCommittedItems,
    guestCartWasMerged,
    reverseGeocode,
  });
}

export { toCartDto };
