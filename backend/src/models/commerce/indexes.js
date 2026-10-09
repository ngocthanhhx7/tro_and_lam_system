import { CodCollection } from './cod-collection.model.js';
import { IdempotencyRecord } from './idempotency-record.model.js';
import { Inventory } from './inventory.model.js';
import { InventoryMovement } from './inventory-movement.model.js';
import { Order } from './order.model.js';
import { OrderAccessChallenge } from './order-access-challenge.model.js';
import { StockReservation } from './stock-reservation.model.js';
import { Voucher } from './voucher.model.js';

const commerceModels = Object.freeze([
  Inventory,
  StockReservation,
  InventoryMovement,
  Order,
  IdempotencyRecord,
  CodCollection,
  OrderAccessChallenge,
  Voucher,
]);

export async function ensureCommerceIndexes() {
  for (const model of commerceModels) await model.createIndexes();
}

export { commerceModels };
