import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { backfillPendingGuestCodKeys } from '../services/commerce/cod-quota-migration.js';

try {
  if (process.argv.slice(2).some(arg => arg !== '--apply')) throw new Error('INVALID_MIGRATION_ARGUMENT');
  await connectDatabase(env.mongoUri);
  const result = await backfillPendingGuestCodKeys({ apply: process.argv.includes('--apply') });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.unresolved) process.exitCode = 1;
} catch {
  process.stderr.write('COD_QUOTA_MIGRATION_FAILED: inspect attribution and database readiness privately.\n');
  process.exitCode = 1;
} finally { await disconnectDatabase(); }
