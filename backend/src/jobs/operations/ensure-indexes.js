import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { ensureOperationsIndexes } from '../../models/operations/index.js';

try {
  await mongoose.connect(env.mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
  await ensureOperationsIndexes();
  console.log('P09 indexes created or verified; no existing indexes were dropped.');
} catch (error) {
  if (error?.code === 11000) {
    console.error('P09 unique index preflight failed: duplicate keys exist. Review and resolve duplicates in a backed-up non-production database first.');
  } else {
    console.error('P09 index migration failed. No automatic data cleanup was attempted.');
  }
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
