import { IdentityGuard } from '../models/identity/identity-guard.model.js';

export async function assertIdentityGuardIndex(Model = IdentityGuard) {
  const indexes = await Model.collection.indexes();
  if (!indexes.some(index => index.unique && index.key.key === 1 && Object.keys(index.key).length === 1
    && !index.partialFilterExpression && !index.sparse)) {
    throw new Error('Required identity guard unique index is missing; run the index preparation before activation');
  }
}
