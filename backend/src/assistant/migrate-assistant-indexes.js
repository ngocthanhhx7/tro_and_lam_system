import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { AiConversation } from './assistant.models.js';

try {
  await connectDatabase(env.mongoUri);
  await AiConversation.createIndexes();
  console.log('P10 assistant indexes created or verified.');
} catch (error) {
  console.error(`P10 assistant index migration failed: ${error?.code || error?.name || 'unknown error'}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
