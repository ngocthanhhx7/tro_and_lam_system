import { AccountAppeal } from './account-appeal.model.js';
import { AuthChallenge } from './auth-challenge.model.js';
import { IdentityGuard } from './identity-guard.model.js';
import { RestrictedProof } from './restricted-proof.model.js';
import { AuthSession } from './session.model.js';
import { User } from './user.model.js';

// Idempotently creates declared identity indexes; fails before service startup on duplicates.
// It does not drop indexes and is safe to run as an explicit migration step.
export async function ensureIdentityIndexes() {
  await Promise.all([
    User.createIndexes(),
    AuthSession.createIndexes(),
    AuthChallenge.createIndexes(),
    RestrictedProof.createIndexes(),
    AccountAppeal.createIndexes(),
    IdentityGuard.createIndexes(),
  ]);
}
