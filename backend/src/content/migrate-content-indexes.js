import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { NfcTag, Page, Story } from './content.models.js';

try {
  await connectDatabase(env.mongoUri);
  for (const model of [Story, Page, NfcTag]) await model.createIndexes();
  console.log('P08 content indexes created or verified.');
} catch (error) {
  console.error(`P08 index migration failed: ${error?.code || error?.name || 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
