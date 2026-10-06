import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { bootstrapFirstAdmin } from '../services/identity/admin-bootstrap.service.js';

function databaseNameFromUri(uri) {
  try {
    const pathname = new URL(uri).pathname.replace(/^\/+/, '');
    return decodeURIComponent(pathname.split('/')[0] || '');
  } catch {
    return '';
  }
}

export async function runAdminBootstrap(source = process.env) {
  if (env.nodeEnv !== 'production') {
    throw Object.assign(new Error('Admin bootstrap is restricted to NODE_ENV=production.'), { code: 'BOOTSTRAP_ENVIRONMENT_INVALID' });
  }
  const expectedDatabase = databaseNameFromUri(env.mongoUri);
  if (!expectedDatabase || source.BOOTSTRAP_ADMIN_CONFIRM_DATABASE !== expectedDatabase) {
    throw new Error('Set BOOTSTRAP_ADMIN_CONFIRM_DATABASE to the exact database name in MONGODB_URI.');
  }

  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  try {
    const result = await bootstrapFirstAdmin({
      name: source.BOOTSTRAP_ADMIN_NAME,
      email: source.BOOTSTRAP_ADMIN_EMAIL,
      password: source.BOOTSTRAP_ADMIN_PASSWORD,
      confirmedDatabaseName: source.BOOTSTRAP_ADMIN_CONFIRM_DATABASE,
      confirmedEmail: source.BOOTSTRAP_ADMIN_CONFIRM_EMAIL,
    });
    return result;
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runAdminBootstrap();
    console.log(`Initial administrator created. User ID: ${result.userId}. No password or email was printed.`);
  } catch (error) {
    const publicMessage = error?.code === 'ADMIN_ALREADY_BOOTSTRAPPED'
      ? error.message
      : ['BOOTSTRAP_CONFIRMATION_REQUIRED', 'BOOTSTRAP_INPUT_INVALID', 'BOOTSTRAP_ENVIRONMENT_INVALID'].includes(error?.code)
        ? error.message
        : 'Admin bootstrap failed. Check production configuration and database connectivity; sensitive values were not logged.';
    console.error(publicMessage);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => {});
  }
}
