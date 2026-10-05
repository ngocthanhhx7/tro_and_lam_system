import { Address } from './address.model.js';
import { Cart } from './cart.model.js';

// Index creation is idempotent; production rollout should run this as an explicit migration.
export async function ensureAccountIndexes() {
  await Promise.all([Address.createIndexes(), Cart.createIndexes()]);
}
