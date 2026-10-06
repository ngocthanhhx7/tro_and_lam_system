import mongoose from 'mongoose';
import { Address } from '../../models/account/address.model.js';
import { Cart } from '../../models/account/cart.model.js';

function idString(value) { return String(value?._id ?? value?.id ?? value); }

function addressDto(record) {
  if (!record) return null;
  const value = typeof record.toObject === 'function' ? record.toObject() : record;
  const result = {
    id: idString(value),
    recipientName: value.recipientName,
    phone: value.phone,
    line1: value.line1,
    countryCode: value.countryCode,
    formattedAddress: value.formattedAddress,
    isDefault: value.isDefault === true,
    version: value.version,
    createdAt: new Date(value.createdAt).toISOString(),
    updatedAt: new Date(value.updatedAt).toISOString(),
  };
  for (const field of ['label', 'line2', 'ward', 'province', 'postalCode', 'location']) {
    if (value[field] !== undefined && value[field] !== null) result[field] = value[field];
  }
  return result;
}

function cartItemId(item) { return idString(item.productId); }

function cartRecord(record) {
  if (!record) return null;
  const value = typeof record.toObject === 'function' ? record.toObject() : record;
  return {
    id: idString(value),
    ...(value.userId ? { userId: idString(value.userId) } : {}),
    ...(value.guestTokenHash ? { guestTokenHash: value.guestTokenHash } : {}),
    items: (value.items || []).map((item) => ({ productId: cartItemId(item), quantity: item.quantity })),
    version: value.version,
    expiresAt: value.expiresAt,
    ...(value.mergedAt ? { mergedAt: value.mergedAt } : {}),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export class AccountRepository {
  constructor(models = {}) {
    this.models = { Address: models.Address || Address, Cart: models.Cart || Cart };
  }

  async transaction(callback) {
    return mongoose.connection.transaction(callback);
  }

  async listAddresses(userId, { session } = {}) {
    let query = this.models.Address.find({ userId }).sort({ createdAt: 1, _id: 1 });
    if (session) query = query.session(session);
    return (await query.exec()).map(addressDto);
  }

  async countAddresses(userId, { session } = {}) {
    let query = this.models.Address.countDocuments({ userId });
    if (session) query = query.session(session);
    return query.exec();
  }

  async createAddress(data, { session } = {}) {
    const [record] = await this.models.Address.create([data], { session });
    return addressDto(record);
  }

  async findAddressByOwner(userId, addressId, { session } = {}) {
    let query = this.models.Address.findOne({ _id: addressId, userId });
    if (session) query = query.session(session);
    return addressDto(await query.exec());
  }

  async updateAddress(userId, addressId, expectedVersion, patch, { session } = {}) {
    const set = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const unset = Object.fromEntries(Object.entries(patch).filter(([, value]) => value === undefined).map(([field]) => [field, 1]));
    const update = { $inc: { version: 1 }, $set: set };
    if (Object.keys(unset).length) update.$unset = unset;
    const record = await this.models.Address.findOneAndUpdate(
      { _id: addressId, userId, version: expectedVersion }, update,
      { returnDocument: 'after', runValidators: true, session },
    ).exec();
    return addressDto(record);
  }

  async clearDefaultAddresses(userId, exceptAddressId, { session } = {}) {
    const filter = { userId, isDefault: true };
    if (exceptAddressId) filter._id = { $ne: exceptAddressId };
    return this.models.Address.updateMany(filter, { $set: { isDefault: false }, $inc: { version: 1 } }, { session }).exec();
  }

  async deleteAddress(userId, addressId, expectedVersion, { session } = {}) {
    const record = await this.models.Address.findOneAndDelete({ _id: addressId, userId, version: expectedVersion }, { session }).exec();
    return addressDto(record);
  }

  async findDefaultAddress(userId, { session } = {}) {
    let query = this.models.Address.findOne({ userId, isDefault: true });
    if (session) query = query.session(session);
    return addressDto(await query.exec());
  }

  async findOldestAddress(userId, { excludeAddressId, session } = {}) {
    const filter = { userId };
    if (excludeAddressId) filter._id = { $ne: excludeAddressId };
    let query = this.models.Address.findOne(filter).sort({ createdAt: 1, _id: 1 });
    if (session) query = query.session(session);
    return addressDto(await query.exec());
  }

  async promoteAddressDefault(userId, addressId, { session } = {}) {
    const record = await this.models.Address.findOneAndUpdate(
      { _id: addressId, userId }, { $set: { isDefault: true }, $inc: { version: 1 } },
      { returnDocument: 'after', runValidators: true, session },
    ).exec();
    return addressDto(record);
  }

  async getOwnedAddress(userId, addressId, { session } = {}) {
    return this.findAddressByOwner(userId, addressId, { session });
  }

  async findUserCart(userId, { session } = {}) {
    let query = this.models.Cart.findOne({ userId });
    if (session) query = query.session(session);
    return cartRecord(await query.exec());
  }

  async findGuestCart(guestTokenHash, { session } = {}) {
    let query = this.models.Cart.findOne({ guestTokenHash });
    if (session) query = query.session(session);
    return cartRecord(await query.exec());
  }

  async createCart(data, { session } = {}) {
    const [record] = await this.models.Cart.create([data], { session });
    return cartRecord(record);
  }

  async saveCart(cart, expectedVersion, { session } = {}) {
    const patch = {
      items: cart.items.map((item) => ({ productId: new mongoose.Types.ObjectId(item.productId), quantity: item.quantity })),
      expiresAt: cart.expiresAt,
      mergedAt: cart.mergedAt,
    };
    const record = await this.models.Cart.findOneAndUpdate(
      { _id: cart.id, version: expectedVersion },
      { $set: patch, $inc: { version: 1 } },
      { returnDocument: 'after', runValidators: true, session },
    ).exec();
    return cartRecord(record);
  }
}

export { addressDto, cartRecord };
