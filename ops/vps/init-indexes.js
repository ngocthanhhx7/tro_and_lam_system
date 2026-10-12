import mongoose from 'mongoose';
import { env } from '../../backend/src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../../backend/src/config/database.js';
// Register the same schemas as the API without starting its HTTP server or jobs.
import '../../backend/src/composition.js';

let stage = 'Atlas connection';
try {
  await connectDatabase(env.mongoUri);
  for (const model of Object.values(mongoose.models)) {
    stage = model.modelName;
    await model.createIndexes();
  }
  console.log('Declared MongoDB indexes created or verified. No collections or indexes were dropped.');
} catch (error) {
  const code = Number.isInteger(error?.code) ? error.code : 'unavailable';
  const hint = error?.code === 11000 ? 'duplicate data'
    : [85, 86].includes(error?.code) ? 'index definition conflict; keep existing data and review the migration'
      : 'check Atlas access and configuration';
  // Never emit raw driver messages: they can contain credentials or document values.
  console.error(`Index preparation failed at ${stage} (MongoDB code ${code}; ${hint}). Backend was not activated.`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
