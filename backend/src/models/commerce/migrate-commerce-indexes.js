import { env } from '../../config/env.js';
import { connectDatabase, disconnectDatabase } from '../../config/database.js';
import { ensureCommerceIndexes } from './indexes.js';

try {
  await connectDatabase(env.mongoUri);
  await ensureCommerceIndexes();
  console.log('P05 commerce indexes created or verified; no existing indexes were dropped.');
} catch (error) {
  if (error?.code === 11000) {
    console.error('P05 unique index preflight failed: duplicate keys exist. Resolve collisions in a backed-up non-production database before retrying.');
  } else {
    console.error(`P05 index migration failed: ${error?.code || error?.name || 'unknown error'}`);
  }
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
