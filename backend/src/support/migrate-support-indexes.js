import { env } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { Review } from '../reviews/review.models.js';
import { Contact, ReturnRequest, SupportAttachment, Ticket, TicketMessage } from './support.models.js';

const supportModels = [Ticket, TicketMessage, Contact, ReturnRequest, SupportAttachment, Review];

try {
  await connectDatabase(env.mongoUri);
  for (const model of supportModels) await model.createIndexes();
  console.log('P07 support and review indexes created or verified; no existing indexes were dropped.');
} catch (error) {
  if (error?.code === 11000) {
    console.error('P07 unique index preflight failed: duplicate keys exist. Resolve collisions in a backed-up non-production database before retrying.');
  } else {
    console.error(`P07 index migration failed: ${error?.code || error?.name || 'unknown error'}`);
  }
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
