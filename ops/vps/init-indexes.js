import mongoose from 'mongoose';
import { env } from '../../backend/src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../../backend/src/config/database.js';
// Register the same schemas as the API without starting its HTTP server or jobs.
import '../../backend/src/composition.js';

try {
  await connectDatabase(env.mongoUri);
  for (const model of Object.values(mongoose.models)) await model.createIndexes();
  console.log('Declared MongoDB indexes created or verified. No collections or indexes were dropped.');
} catch (error) {
  console.error(`Index preparation failed (${error?.code === 11000 ? 'duplicate data' : 'check Atlas access and configuration'}). Backend was not activated.`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
